import type { MovementType } from "@/generated/prisma/client";
import { prisma, lockProducts, type Tx } from "@/server/db/prisma";
import { AppError, NotFoundError } from "@/server/errors";
import { audit } from "@/server/services/audit.service";
import { vnDayRange, type Ymd } from "@/lib/dates";
import type { CurrentUser } from "@/server/auth/session";

export interface MovementInput {
  productId: string;
  type: MovementType;
  quantity: number;
  deltaOnHand: number;
  deltaReserved: number;
  actorId: string;
  orderId?: string;
  orderItemId?: string;
  reason?: string;
}

/**
 * The only place that changes products.on_hand / reserved. Caller must hold the product row lock
 * (lockProducts) inside `tx`. DB CHECK constraints reject negative stock as a last line of defence.
 */
export async function applyMovement(tx: Tx, m: MovementInput) {
  if (!Number.isInteger(m.quantity) || m.quantity <= 0) throw new AppError("Số lượng phải là số nguyên dương.");
  let product;
  try {
    product = await tx.product.update({
      where: { id: m.productId },
      data: { onHand: { increment: m.deltaOnHand }, reserved: { increment: m.deltaReserved } },
      select: { onHand: true, reserved: true },
    });
  } catch (err) {
    if (String(err).includes("products_")) throw new AppError("Tồn kho không đủ cho thao tác này.");
    throw err;
  }
  await tx.inventoryMovement.create({
    data: {
      productId: m.productId,
      type: m.type,
      quantity: m.quantity,
      deltaOnHand: m.deltaOnHand,
      deltaReserved: m.deltaReserved,
      onHandAfter: product.onHand,
      reservedAfter: product.reserved,
      orderId: m.orderId,
      orderItemId: m.orderItemId,
      reason: m.reason,
      createdById: m.actorId,
    },
  });
  return product;
}

/** Nhập thêm hàng làm sẵn (owner and staff). */
export async function produceStock(actor: CurrentUser, productId: string, quantity: number, note?: string) {
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10000) {
    throw new AppError("Số lượng phải là số nguyên từ 1 đến 10000.", { quantity: "Số lượng không hợp lệ" });
  }
  return prisma.$transaction(async (tx) => {
    await lockProducts(tx, [productId]);
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError("Không tìm thấy sản phẩm.");
    if (product.fulfillmentMode === "MADE_TO_ORDER") {
      throw new AppError("Sản phẩm làm theo đơn không dùng tồn kho. Đổi phương thức sang Linh hoạt hoặc Có sẵn trước.");
    }
    if (product.status === "ARCHIVED") throw new AppError("Sản phẩm đã lưu trữ.");
    const after = await applyMovement(tx, {
      productId,
      type: "PRODUCE",
      quantity,
      deltaOnHand: quantity,
      deltaReserved: 0,
      actorId: actor.id,
      reason: note?.trim() || undefined,
    });
    await audit(tx, {
      actorId: actor.id,
      action: "inventory.produce",
      entityType: "product",
      entityId: productId,
      summary: `Nhập thêm ${quantity} ${product.name} làm sẵn (đang có ${after.onHand})`,
    });
    return after;
  });
}

/** Điều chỉnh tồn kho (owner only, reason required). `delta` may be negative. */
export async function adjustStock(actor: CurrentUser, productId: string, delta: number, reason: string) {
  if (actor.role !== "owner") throw new AppError("Chỉ chủ shop được điều chỉnh tồn kho.");
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 10000) {
    throw new AppError("Số lượng điều chỉnh phải là số nguyên khác 0.", { delta: "Số lượng không hợp lệ" });
  }
  if (!reason.trim()) throw new AppError("Vui lòng ghi lý do điều chỉnh.", { reason: "Bắt buộc" });
  return prisma.$transaction(async (tx) => {
    await lockProducts(tx, [productId]);
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError("Không tìm thấy sản phẩm.");
    if (product.fulfillmentMode === "MADE_TO_ORDER") throw new AppError("Sản phẩm làm theo đơn không dùng tồn kho.");
    if (product.onHand + delta < product.reserved) {
      throw new AppError(
        `Không thể giảm xuống dưới số đang giữ cho đơn (${product.reserved}). Đang có ${product.onHand}.`,
        { delta: "Vượt quá số có thể giảm" },
      );
    }
    const after = await applyMovement(tx, {
      productId,
      type: "ADJUST",
      quantity: Math.abs(delta),
      deltaOnHand: delta,
      deltaReserved: 0,
      actorId: actor.id,
      reason: reason.trim(),
    });
    await audit(tx, {
      actorId: actor.id,
      action: "inventory.adjust",
      entityType: "product",
      entityId: productId,
      summary: `Điều chỉnh tồn ${product.name} ${delta > 0 ? "+" : ""}${delta} (đang có ${after.onHand}). Lý do: ${reason.trim()}`,
    });
    return after;
  });
}

export async function listMovements(productId: string, range: { from: Ymd; to: Ymd } | null, take = 200) {
  return prisma.inventoryMovement.findMany({
    where: { productId, ...(range ? { createdAt: vnDayRange(range.from, range.to) } : {}) },
    orderBy: { createdAt: "desc" },
    take,
    include: { createdBy: { select: { name: true } }, order: { select: { id: true, code: true } } },
  });
}

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  INITIAL: "Số dư ban đầu",
  PRODUCE: "Làm sẵn",
  RESERVE: "Giữ cho đơn",
  RELEASE: "Trả lại",
  CONSUME: "Xuất cho đơn hoàn thành",
  RESTOCK_FROM_ORDER: "Nhập lại từ đơn hủy",
  WRITE_OFF: "Hư hao",
  ADJUST: "Điều chỉnh",
};
