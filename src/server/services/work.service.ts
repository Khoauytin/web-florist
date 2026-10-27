import type { OrderStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { DELIVERY_DUE_STATUSES } from "@/server/domain/order-status";
import { netPaid } from "@/server/domain/order-totals";
import { listOrders } from "@/server/services/orders.service";
import { vnDayRange, ymdToDbDate, type Ymd } from "@/lib/dates";

/** "Theo ngày" overview: everything the shop needs for one Vietnam calendar day. */
export async function dayOverview(day: Ymd) {
  const date = ymdToDbDate(day);
  const [due, fresh, done, createdCount, newAnyDay] = await Promise.all([
    // One shop's day never comes close to this; it only bounds a runaway query.
    listOrders({ from: day, to: day, dateField: "delivery", statuses: DELIVERY_DUE_STATUSES as OrderStatus[] }, 1, 1000),
    listOrders({ from: day, to: day, dateField: "delivery", statuses: ["NEW"] }, 1, 1000),
    prisma.order.count({ where: { deliveryDate: date, status: "COMPLETED" } }),
    prisma.order.count({ where: { createdAt: vnDayRange(day, day) } }),
    prisma.order.count({ where: { status: "NEW" } }),
  ]);
  const work = await productionList({ from: day, to: day, includeDone: false });
  const remaining = work.reduce((s, g) => s + g.remaining, 0);
  const owed = due.rows.reduce((s, o) => s + o.owed, 0);
  return { due: due.rows, fresh: fresh.rows, done, createdCount, newAnyDay, work, remaining, owed };
}

export interface ProductionRow {
  itemId: string;
  orderId: string;
  orderCode: string;
  orderStatus: OrderStatus;
  recipientName: string;
  deliveryDate: Date | null;
  deliveryTimeFrom: string | null;
  deliveryTimeTo: string | null;
  qtyOrdered: number;
  qtyFromStock: number;
  qtyToMake: number;
  qtyMade: number;
}

export interface ProductionGroup {
  key: string;
  productId: string | null;
  code: string | null;
  name: string;
  imageUrl: string | null;
  remaining: number;
  rows: ProductionRow[];
}

/**
 * Work to do from confirmed orders, grouped by product. Range filters on delivery date;
 * orders without a date are included only when no range is given.
 */
export async function productionList(opts: { from?: Ymd; to?: Ymd; includeDone: boolean }) {
  const items = await prisma.orderItem.findMany({
    where: {
      qtyToMake: { gt: 0 },
      order: {
        status: { in: ["CONFIRMED", "DELIVERY_FAILED"] },
        ...(opts.from && opts.to ? { deliveryDate: { gte: ymdToDbDate(opts.from), lte: ymdToDbDate(opts.to) } } : {}),
      },
    },
    include: {
      order: { select: { id: true, code: true, status: true, recipientName: true, deliveryDate: true, deliveryTimeFrom: true, deliveryTimeTo: true } },
      product: { select: { images: { where: { isPrimary: true }, select: { url: true }, take: 1 } } },
    },
    orderBy: [{ order: { deliveryDate: "asc" } }, { order: { deliveryTimeFrom: "asc" } }],
  });
  const groups = new Map<string, ProductionGroup>();
  for (const it of items) {
    if (!opts.includeDone && it.qtyMade >= it.qtyToMake) continue;
    const key = it.productId ?? `free:${it.nameSnapshot}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        productId: it.productId,
        code: it.productCodeSnapshot,
        name: it.nameSnapshot,
        imageUrl: it.product?.images[0]?.url ?? null,
        remaining: 0,
        rows: [],
      };
      groups.set(key, g);
    }
    g.remaining += Math.max(0, it.qtyToMake - it.qtyMade);
    g.rows.push({
      itemId: it.id,
      orderId: it.order.id,
      orderCode: it.order.code,
      orderStatus: it.order.status,
      recipientName: it.order.recipientName,
      deliveryDate: it.order.deliveryDate,
      deliveryTimeFrom: it.order.deliveryTimeFrom,
      deliveryTimeTo: it.order.deliveryTimeTo,
      qtyOrdered: it.qtyOrdered,
      qtyFromStock: it.qtyFromStock,
      qtyToMake: it.qtyToMake,
      qtyMade: it.qtyMade,
    });
  }
  return [...groups.values()].sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name, "vi"));
}

/** Sum still to collect over a set of orders (used by exports and summaries). */
export function owedOf(order: { total: number; payments: { type: "DEPOSIT" | "PAYMENT" | "REFUND"; amount: number; voidedAt: Date | null }[] }) {
  return Math.max(0, order.total - netPaid(order.payments));
}
