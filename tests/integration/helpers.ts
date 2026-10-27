import { randomUUID } from "node:crypto";
import type { FulfillmentMode } from "@/generated/prisma/client";
import { prisma, lockProducts } from "@/server/db/prisma";
import { applyMovement } from "@/server/services/inventory.service";
import type { CurrentUser } from "@/server/auth/session";
import type { OrderInput } from "@/server/services/orders.service";
import { addDays, todayVn } from "@/lib/dates";

if (!process.env.DATABASE_URL?.includes("florist_test")) {
  throw new Error("Integration tests must run against the florist_test database (TEST_DATABASE_URL).");
}

export async function resetDb() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE
    audit_logs, inventory_movements, payments, order_items, orders, order_counters,
    product_images, products, categories, customers, sessions, accounts, verifications, users
    RESTART IDENTITY CASCADE`);
}

export async function makeUser(role: "owner" | "staff", name = role === "owner" ? "Chủ shop" : "Nhân viên"): Promise<CurrentUser> {
  const id = randomUUID();
  const username = `${role}${id.slice(0, 6)}`;
  await prisma.user.create({ data: { id, name, email: `${username}@test.invalid`, username, role } });
  return { id, name, username, role, mustChangePassword: false };
}

let seq = 0;
export async function makeProduct(owner: CurrentUser, opts: { mode?: FulfillmentMode; onHand?: number; price?: number; name?: string } = {}) {
  seq += 1;
  const category = await prisma.category.upsert({ where: { name: "Hoa bó" }, update: {}, create: { name: "Hoa bó" } });
  const product = await prisma.product.create({
    data: {
      code: `T-${seq}-${randomUUID().slice(0, 4)}`,
      name: opts.name ?? `Sản phẩm ${seq}`,
      categoryId: category.id,
      price: opts.price ?? 350000,
      costPrice: 180000,
      fulfillmentMode: opts.mode ?? "FLEXIBLE",
    },
  });
  if (opts.onHand) {
    await prisma.$transaction(async (tx) => {
      await lockProducts(tx, [product.id]);
      await applyMovement(tx, { productId: product.id, type: "INITIAL", quantity: opts.onHand!, deltaOnHand: opts.onHand!, deltaReserved: 0, actorId: owner.id });
    });
  }
  return product;
}

export function orderInput(items: OrderInput["items"], extra: Partial<OrderInput> = {}): OrderInput {
  return {
    customerName: "Lê Thị Lan",
    customerPhone: "0935 662 019",
    channel: "FACEBOOK",
    receiveType: "DELIVERY",
    deliveryAddress: "9 Trần Duy Hưng, Cầu Giấy, Hà Nội",
    deliveryDate: addDays(todayVn(), 1),
    deliveryTimeFrom: "14:00",
    deliveryTimeTo: "15:00",
    discount: 0,
    shippingFee: 0,
    items,
    ...extra,
  };
}

export async function stockOf(productId: string) {
  const p = await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { onHand: true, reserved: true } });
  return p;
}

/** Spec 3.9 invariant: product counters equal the sums of their movement deltas. */
export async function expectLedgerMatches(productId: string) {
  const p = await stockOf(productId);
  const sums = await prisma.inventoryMovement.aggregate({ where: { productId }, _sum: { deltaOnHand: true, deltaReserved: true } });
  return { ok: p.onHand === (sums._sum.deltaOnHand ?? 0) && p.reserved === (sums._sum.deltaReserved ?? 0), product: p, sums: sums._sum };
}
