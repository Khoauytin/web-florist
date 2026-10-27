import type {
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  PaymentType,
  Prisma,
  ReceiveType,
} from "@/generated/prisma/client";
import { prisma, lockOrder, lockProducts, type Tx } from "@/server/db/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/server/errors";
import { allocate, type AllocationProduct } from "@/server/domain/allocate";
import { computeTotals, netPaid, paymentState, TotalsError } from "@/server/domain/order-totals";
import {
  ACTIVE_STATUSES,
  canPerform,
  productionState,
  remainingToMake,
  type OrderAction,
} from "@/server/domain/order-status";
import { formatOrderCode } from "@/server/domain/order-code";
import { normalizePhone } from "@/server/domain/phone";
import { applyMovement } from "@/server/services/inventory.service";
import { audit } from "@/server/services/audit.service";
import { todayVn, vnDayRange, ymdToDbDate, type Ymd } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import type { CurrentUser } from "@/server/auth/session";

// ===== Inputs =====

export interface OrderItemInput {
  /** existing order_items.id when editing; omitted for new lines */
  id?: string | null;
  productId?: string | null;
  /** free-text line only */
  name?: string;
  /** free-text line only */
  unitPrice?: number;
  qty: number;
  note?: string;
}

export interface OrderInput {
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  recipientName?: string;
  recipientPhone?: string;
  channel: OrderChannel;
  receiveType: ReceiveType;
  deliveryAddress?: string;
  deliveryDate?: Ymd | null;
  deliveryTimeFrom?: string | null;
  deliveryTimeTo?: string | null;
  courierName?: string;
  discount: number;
  shippingFee: number;
  cardMessage?: string;
  note?: string;
  deposit?: { amount: number; method: PaymentMethod } | null;
  items: OrderItemInput[];
}

export interface LogisticsInput {
  recipientName: string;
  recipientPhone: string;
  receiveType: ReceiveType;
  deliveryAddress?: string;
  deliveryDate?: Ymd | null;
  deliveryTimeFrom?: string | null;
  deliveryTimeTo?: string | null;
  courierName?: string;
  cardMessage?: string;
  note?: string;
  /** owner only, ignored for staff */
  discount?: number;
  shippingFee?: number;
}

export type Resolution = "RESTOCK" | "WRITE_OFF";

const blank = (s?: string | null) => (s && s.trim() ? s.trim() : null);

function requirePhone(raw: string, field: string) {
  const phone = normalizePhone(raw);
  if (!phone) throw new AppError("Số điện thoại không hợp lệ.", { [field]: "Số điện thoại không hợp lệ" });
  return phone;
}

function checkTimes(from?: string | null, to?: string | null) {
  const re = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (from && !re.test(from)) throw new AppError("Giờ giao không hợp lệ.", { deliveryTimeFrom: "Giờ không hợp lệ" });
  if (to && !re.test(to)) throw new AppError("Giờ giao không hợp lệ.", { deliveryTimeTo: "Giờ không hợp lệ" });
  if (from && to && to < from) throw new AppError("Giờ kết thúc phải sau giờ bắt đầu.", { deliveryTimeTo: "Phải sau giờ bắt đầu" });
}

function totalsOrThrow(lines: { unitPrice: number; qty: number }[], discount: number, shippingFee: number) {
  try {
    return computeTotals(lines, discount, shippingFee);
  } catch (e) {
    if (e instanceof TotalsError) throw new AppError(e.message, { discount: e.message });
    throw e;
  }
}

async function nextOrderCode(tx: Tx): Promise<string> {
  const day = todayVn();
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO order_counters (day, last_seq) VALUES (${ymdToDbDate(day)}::date, 1)
    ON CONFLICT (day) DO UPDATE SET last_seq = order_counters.last_seq + 1
    RETURNING last_seq`;
  return formatOrderCode(day, rows[0].last_seq);
}

/** Find by normalized phone or create. Keeps an existing customer's name; fills an empty address. */
async function resolveCustomer(tx: Tx, actor: CurrentUser, input: OrderInput) {
  const phone = requirePhone(input.customerPhone, "customerPhone");
  const name = blank(input.customerName);
  if (input.customerId) {
    const c = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!c) throw new NotFoundError("Không tìm thấy khách hàng.");
    return c;
  }
  const existing = await tx.customer.findUnique({ where: { phone } });
  if (existing) {
    if (!existing.address && blank(input.customerAddress)) {
      return tx.customer.update({ where: { id: existing.id }, data: { address: blank(input.customerAddress), updatedById: actor.id } });
    }
    return existing;
  }
  if (!name) throw new AppError("Vui lòng nhập tên khách hàng.", { customerName: "Bắt buộc" });
  // Two orders for the same new phone can arrive together: insert-or-ignore, then read back.
  const inserted = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO customers (id, name, phone, address, created_by, updated_by, created_at, updated_at)
    VALUES (gen_random_uuid(), ${name}, ${phone}, ${blank(input.customerAddress)}, ${actor.id}, ${actor.id}, now(), now())
    ON CONFLICT (phone) DO NOTHING
    RETURNING id`;
  const customer = await tx.customer.findUniqueOrThrow({ where: { phone } });
  if (inserted.length) {
    await audit(tx, { actorId: actor.id, action: "customer.create", entityType: "customer", entityId: customer.id, summary: `Tạo khách ${name} khi tạo đơn` });
  }
  return customer;
}

/** Builds item rows with name/price snapshots. Only ACTIVE products with a price can be ordered. */
async function buildItems(tx: Tx, items: OrderItemInput[]) {
  if (items.length > 50) throw new AppError("Một đơn tối đa 50 dòng.");
  const ids = items.map((i) => i.productId).filter((x): x is string => Boolean(x));
  const products = await tx.product.findMany({ where: { id: { in: ids } } });
  const byId = new Map(products.map((p) => [p.id, p]));
  return items.map((item, index) => {
    if (!Number.isInteger(item.qty) || item.qty <= 0 || item.qty > 10000) {
      throw new AppError("Số lượng phải là số nguyên từ 1 đến 10000.", { [`items.${index}.qty`]: "Không hợp lệ" });
    }
    if (item.productId) {
      const p = byId.get(item.productId);
      if (!p) throw new AppError("Có sản phẩm không còn tồn tại.");
      if (p.status !== "ACTIVE") throw new AppError(`Sản phẩm "${p.name}" đang không bán.`);
      if (p.price === null) throw new AppError(`Sản phẩm "${p.name}" chưa có giá. Chủ shop cần nhập giá trước.`);
      return {
        productId: p.id,
        productCodeSnapshot: p.code,
        nameSnapshot: p.name,
        unitPriceSnapshot: p.price,
        unitCostSnapshot: p.costPrice,
        qtyOrdered: item.qty,
        note: blank(item.note),
        sortOrder: index,
      };
    }
    const name = blank(item.name);
    if (!name) throw new AppError("Dòng tự do cần có tên.", { [`items.${index}.name`]: "Bắt buộc" });
    const price = item.unitPrice ?? -1;
    if (!Number.isInteger(price) || price < 0) throw new AppError("Dòng tự do cần đơn giá hợp lệ.", { [`items.${index}.unitPrice`]: "Không hợp lệ" });
    return {
      productId: null,
      productCodeSnapshot: null,
      nameSnapshot: name,
      unitPriceSnapshot: price,
      unitCostSnapshot: null,
      qtyOrdered: item.qty,
      note: blank(item.note),
      sortOrder: index,
    };
  });
}

function logisticsData(input: {
  receiveType: ReceiveType;
  deliveryAddress?: string;
  deliveryDate?: Ymd | null;
  deliveryTimeFrom?: string | null;
  deliveryTimeTo?: string | null;
  courierName?: string;
  cardMessage?: string;
  note?: string;
}) {
  checkTimes(input.deliveryTimeFrom, input.deliveryTimeTo);
  return {
    receiveType: input.receiveType,
    deliveryAddress: input.receiveType === "DELIVERY" ? blank(input.deliveryAddress) : null,
    deliveryDate: input.deliveryDate ? ymdToDbDate(input.deliveryDate) : null,
    deliveryTimeFrom: input.deliveryTimeFrom || null,
    deliveryTimeTo: input.deliveryTimeTo || null,
    courierName: blank(input.courierName),
    cardMessage: blank(input.cardMessage),
    note: blank(input.note),
  };
}

// ===== Create / update =====

export async function createOrder(actor: CurrentUser, input: OrderInput): Promise<{ id: string; code: string }> {
  if (!input.items.length) throw new AppError("Đơn hàng cần ít nhất một sản phẩm.", { items: "Chưa có sản phẩm" });
  return prisma.$transaction(async (tx) => {
    const customer = await resolveCustomer(tx, actor, input);
    const items = await buildItems(tx, input.items);
    const totals = totalsOrThrow(items.map((i) => ({ unitPrice: i.unitPriceSnapshot, qty: i.qtyOrdered })), input.discount, input.shippingFee);
    const recipientPhone = input.recipientPhone ? requirePhone(input.recipientPhone, "recipientPhone") : customer.phone;
    const code = await nextOrderCode(tx);
    const order = await tx.order.create({
      data: {
        code,
        customerId: customer.id,
        recipientName: blank(input.recipientName) ?? customer.name,
        recipientPhone,
        channel: input.channel,
        ...logisticsData(input),
        ...totals,
        createdById: actor.id,
        updatedById: actor.id,
        items: { create: items },
      },
    });
    if (input.deposit && input.deposit.amount > 0) {
      if (!Number.isInteger(input.deposit.amount) || input.deposit.amount > totals.total) {
        throw new AppError("Tiền cọc không được lớn hơn tổng tiền.", { depositAmount: "Lớn hơn tổng tiền" });
      }
      await tx.payment.create({
        data: { orderId: order.id, type: "DEPOSIT", amount: input.deposit.amount, method: input.deposit.method, createdById: actor.id },
      });
    }
    await audit(tx, {
      actorId: actor.id,
      action: "order.create",
      entityType: "order",
      entityId: order.id,
      summary: `Tạo đơn ${code} cho ${customer.name}, tổng ${formatMoney(totals.total)}${input.deposit?.amount ? `, cọc ${formatMoney(input.deposit.amount)}` : ""}`,
    });
    return { id: order.id, code };
  });
}

async function loadPaid(tx: Tx, orderId: string) {
  const payments = await tx.payment.findMany({ where: { orderId }, select: { type: true, amount: true, voidedAt: true } });
  return netPaid(payments);
}

/**
 * Full edit, only while the order is NEW (no stock held yet). Lines are updated in place:
 * existing product lines keep their name/price snapshot (only quantity and note change), new lines
 * are snapshotted at today's price, and removed lines are deleted.
 */
export async function updateOrderFull(actor: CurrentUser, orderId: string, input: OrderInput) {
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new NotFoundError("Không tìm thấy đơn.");
    if (order.status !== "NEW") throw new AppError("Chỉ sửa toàn bộ được đơn ở trạng thái Mới. Hủy xác nhận trước khi đổi sản phẩm.");
    if (!input.items.length) throw new AppError("Đơn hàng cần ít nhất một sản phẩm.", { items: "Chưa có sản phẩm" });
    if (input.items.length > 50) throw new AppError("Một đơn tối đa 50 dòng.");
    const customer = await resolveCustomer(tx, actor, input);
    const existing = new Map(order.items.map((i) => [i.id, i]));
    const fresh = input.items.map((item, index) => ({ item, index })).filter(({ item }) => !item.id || !existing.has(item.id));
    const built = await buildItems(tx, fresh.map((f) => f.item));
    const lines = input.items.map((item, index) => {
      const old = item.id ? existing.get(item.id) : undefined;
      if (!old) return { kind: "new" as const, data: { ...built[fresh.findIndex((f) => f.index === index)], sortOrder: index } };
      if (!Number.isInteger(item.qty) || item.qty <= 0 || item.qty > 10000) throw new AppError("Số lượng phải là số nguyên từ 1 đến 10000.");
      if (old.productId) {
        return { kind: "keep" as const, id: old.id, data: { qtyOrdered: item.qty, note: blank(item.note), sortOrder: index }, unitPrice: old.unitPriceSnapshot };
      }
      const name = blank(item.name) ?? old.nameSnapshot;
      const price = item.unitPrice ?? old.unitPriceSnapshot;
      if (!Number.isInteger(price) || price < 0) throw new AppError("Dòng tự do cần đơn giá hợp lệ.");
      return { kind: "keep" as const, id: old.id, data: { nameSnapshot: name, unitPriceSnapshot: price, qtyOrdered: item.qty, note: blank(item.note), sortOrder: index }, unitPrice: price };
    });
    const totals = totalsOrThrow(
      lines.map((l) => (l.kind === "new" ? { unitPrice: l.data.unitPriceSnapshot, qty: l.data.qtyOrdered } : { unitPrice: l.unitPrice, qty: l.data.qtyOrdered })),
      input.discount,
      input.shippingFee,
    );
    const paid = await loadPaid(tx, orderId);
    if (totals.total < paid) throw new AppError(`Tổng tiền mới (${formatMoney(totals.total)}) nhỏ hơn số đã thu (${formatMoney(paid)}). Hoàn tiền trước.`);
    const keepIds = new Set(lines.flatMap((l) => (l.kind === "keep" ? [l.id] : [])));
    await tx.orderItem.deleteMany({ where: { orderId, id: { notIn: [...keepIds] } } });
    for (const l of lines) {
      if (l.kind === "keep") await tx.orderItem.update({ where: { id: l.id }, data: l.data });
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        customerId: customer.id,
        recipientName: blank(input.recipientName) ?? customer.name,
        recipientPhone: input.recipientPhone ? requirePhone(input.recipientPhone, "recipientPhone") : customer.phone,
        channel: input.channel,
        ...logisticsData(input),
        ...totals,
        updatedById: actor.id,
        items: { create: lines.flatMap((l) => (l.kind === "new" ? [l.data] : [])) },
      },
    });
    await audit(tx, { actorId: actor.id, action: "order.update", entityType: "order", entityId: orderId, summary: `Sửa đơn ${order.code}, tổng ${formatMoney(totals.total)}` });
  });
}

/** Logistics edit for NEW/active orders. Discount and shipping change only for the owner. */
export async function updateOrderLogistics(actor: CurrentUser, orderId: string, input: LogisticsInput) {
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError("Không tìm thấy đơn.");
    if (order.status === "COMPLETED" || order.status === "CANCELLED") throw new AppError("Đơn đã kết thúc, không sửa được.");
    if (order.status !== "NEW") {
      // Confirmed orders were required to have these; keep them so day views stay correct.
      if (!input.deliveryDate) throw new AppError("Đơn đã xác nhận cần có ngày giao.", { deliveryDate: "Bắt buộc" });
      if (input.receiveType === "DELIVERY" && !blank(input.deliveryAddress)) {
        throw new AppError("Đơn giao tận nơi cần có địa chỉ.", { deliveryAddress: "Bắt buộc" });
      }
    }
    let money = {};
    const wantsMoney =
      (input.discount !== undefined && input.discount !== order.discount) ||
      (input.shippingFee !== undefined && input.shippingFee !== order.shippingFee);
    if (wantsMoney) {
      if (actor.role !== "owner") throw new ForbiddenError("Chỉ chủ shop được sửa giảm giá và phí giao của đơn đã xác nhận.");
      const discount = input.discount ?? order.discount;
      const shippingFee = input.shippingFee ?? order.shippingFee;
      const totals = totalsOrThrow([{ unitPrice: order.subtotal, qty: 1 }], discount, shippingFee);
      const paid = await loadPaid(tx, orderId);
      if (totals.total < paid) throw new AppError(`Tổng tiền mới nhỏ hơn số đã thu (${formatMoney(paid)}). Hoàn tiền trước.`);
      money = { discount, shippingFee, total: totals.total };
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        recipientName: blank(input.recipientName) ?? order.recipientName,
        recipientPhone: requirePhone(input.recipientPhone, "recipientPhone"),
        ...logisticsData(input),
        ...money,
        updatedById: actor.id,
      },
    });
    await audit(tx, { actorId: actor.id, action: "order.update_logistics", entityType: "order", entityId: orderId, summary: `Cập nhật giao nhận đơn ${order.code}` });
  });
}

// ===== Status transitions =====

async function loadForTransition(tx: Tx, orderId: string, action: OrderAction, actor: CurrentUser) {
  await lockOrder(tx, orderId);
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!order) throw new NotFoundError("Không tìm thấy đơn.");
  if (!canPerform(action, order.status, actor.role)) {
    throw new AppError(actor.role === "staff" ? "Bạn không có quyền hoặc đơn không ở trạng thái phù hợp." : "Đơn không ở trạng thái phù hợp cho thao tác này.");
  }
  return order;
}

export async function confirmOrder(actor: CurrentUser, orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await loadForTransition(tx, orderId, "confirm", actor);
    if (!order.items.length) throw new AppError("Đơn chưa có sản phẩm.");
    if (!order.deliveryDate) throw new AppError("Cần có ngày giao hoặc ngày nhận trước khi xác nhận.");
    if (order.receiveType === "DELIVERY" && !order.deliveryAddress) throw new AppError("Cần có địa chỉ giao trước khi xác nhận.");
    const productIds = order.items.map((i) => i.productId).filter((x): x is string => Boolean(x));
    await lockProducts(tx, productIds);
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const map = new Map<string, AllocationProduct>(
      products.map((p) => [p.id, { mode: p.fulfillmentMode, available: p.onHand - p.reserved, name: p.name }]),
    );
    const result = allocate(order.items.map((i) => ({ productId: i.productId, qty: i.qtyOrdered })), map);
    if (!result.ok) {
      const list = result.shortages.map((s) => `${s.name}: cần ${s.requested}, còn ${s.available}`).join("; ");
      throw new AppError(`Không đủ hàng có sẵn để xác nhận. ${list}.`);
    }
    const now = new Date();
    let held = 0;
    let toMake = 0;
    for (const [idx, item] of order.items.entries()) {
      const a = result.lines[idx];
      held += a.fromStock;
      toMake += a.toMake;
      if (a.fromStock > 0 && item.productId) {
        await applyMovement(tx, {
          productId: item.productId,
          type: "RESERVE",
          quantity: a.fromStock,
          deltaOnHand: 0,
          deltaReserved: a.fromStock,
          actorId: actor.id,
          orderId,
          orderItemId: item.id,
        });
      }
      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          qtyFromStock: a.fromStock,
          qtyToMake: a.toMake,
          qtyMade: 0,
          allocatedAt: now,
          stockState: a.fromStock > 0 ? "RESERVED" : "NONE",
        },
      });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: "CONFIRMED", confirmedAt: now, updatedById: actor.id } });
    await audit(tx, {
      actorId: actor.id,
      action: "order.confirm",
      entityType: "order",
      entityId: orderId,
      summary: `Xác nhận đơn ${order.code}: giữ ${held} từ kho, cần làm ${toMake}`,
    });
    return { held, toMake };
  });
}

/** Spec 5.8: production quantity, only while confirmed or after a failed delivery. */
export async function setMade(actor: CurrentUser, orderItemId: string, qtyMade: number) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findUnique({ where: { id: orderItemId }, select: { orderId: true } });
    if (!item) throw new NotFoundError("Không tìm thấy dòng hàng.");
    await lockOrder(tx, item.orderId);
    const fresh = await tx.orderItem.findUniqueOrThrow({ where: { id: orderItemId }, include: { order: true } });
    if (!["CONFIRMED", "DELIVERY_FAILED"].includes(fresh.order.status)) throw new AppError("Chỉ cập nhật số đã làm cho đơn đã xác nhận.");
    if (!Number.isInteger(qtyMade) || qtyMade < 0 || qtyMade > fresh.qtyToMake) {
      throw new AppError(`Số đã làm phải từ 0 đến ${fresh.qtyToMake}.`);
    }
    if (qtyMade === fresh.qtyMade) return fresh;
    const updated = await tx.orderItem.update({ where: { id: orderItemId }, data: { qtyMade } });
    await tx.order.update({ where: { id: fresh.orderId }, data: { updatedById: actor.id } });
    await audit(tx, {
      actorId: actor.id,
      action: "order.production",
      entityType: "order",
      entityId: fresh.orderId,
      summary: `Cập nhật đã làm ${fresh.nameSnapshot}: ${qtyMade}/${fresh.qtyToMake} (đơn ${fresh.order.code})`,
    });
    return updated;
  });
}

export async function startDelivery(actor: CurrentUser, orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await loadForTransition(tx, orderId, "start_delivery", actor);
    const left = remainingToMake(order.items);
    if (left > 0) throw new AppError(`Còn ${left} sản phẩm chưa làm xong.`);
    await tx.order.update({ where: { id: orderId }, data: { status: "DELIVERING", updatedById: actor.id } });
    await audit(tx, {
      actorId: actor.id,
      action: "order.start_delivery",
      entityType: "order",
      entityId: orderId,
      summary: order.receiveType === "PICKUP" ? `Đơn ${order.code} sẵn sàng nhận` : `Bắt đầu giao đơn ${order.code}`,
    });
  });
}

export async function completeOrder(actor: CurrentUser, orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await loadForTransition(tx, orderId, "complete", actor);
    await lockProducts(tx, order.items.map((i) => i.productId).filter((x): x is string => Boolean(x)));
    for (const item of order.items) {
      if (item.stockState === "RESERVED" && item.qtyFromStock > 0 && item.productId) {
        await applyMovement(tx, {
          productId: item.productId,
          type: "CONSUME",
          quantity: item.qtyFromStock,
          deltaOnHand: -item.qtyFromStock,
          deltaReserved: -item.qtyFromStock,
          actorId: actor.id,
          orderId,
          orderItemId: item.id,
        });
        await tx.orderItem.update({ where: { id: item.id }, data: { stockState: "CONSUMED" } });
      }
    }
    await tx.order.update({ where: { id: orderId }, data: { status: "COMPLETED", completedAt: new Date(), updatedById: actor.id } });
    const owed = order.total - (await loadPaid(tx, orderId));
    await audit(tx, {
      actorId: actor.id,
      action: "order.complete",
      entityType: "order",
      entityId: orderId,
      summary: `Hoàn thành đơn ${order.code}${owed > 0 ? `, còn nợ ${formatMoney(owed)}` : ""}`,
    });
    return { owed: Math.max(0, owed) };
  });
}

export async function failDelivery(actor: CurrentUser, orderId: string, reason: string) {
  if (!reason.trim()) throw new AppError("Vui lòng ghi lý do giao thất bại.", { reason: "Bắt buộc" });
  return prisma.$transaction(async (tx) => {
    const order = await loadForTransition(tx, orderId, "fail_delivery", actor);
    await tx.order.update({ where: { id: orderId }, data: { status: "DELIVERY_FAILED", failReason: reason.trim(), updatedById: actor.id } });
    await audit(tx, { actorId: actor.id, action: "order.fail_delivery", entityType: "order", entityId: orderId, summary: `Giao thất bại đơn ${order.code}: ${reason.trim()}` });
  });
}

export async function retryDelivery(actor: CurrentUser, orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await loadForTransition(tx, orderId, "retry_delivery", actor);
    const left = remainingToMake(order.items);
    if (left > 0) throw new AppError(`Còn ${left} sản phẩm chưa làm xong.`);
    await tx.order.update({ where: { id: orderId }, data: { status: "DELIVERING", updatedById: actor.id } });
    await audit(tx, { actorId: actor.id, action: "order.retry_delivery", entityType: "order", entityId: orderId, summary: `Giao lại đơn ${order.code}` });
  });
}

/**
 * Releases held stock and settles made items (spec 5.4). Shared by cancel and unconfirm.
 * `resolutions` must cover every product line with qtyMade > 0.
 */
async function releaseOrder(
  tx: Tx,
  actor: CurrentUser,
  order: Prisma.OrderGetPayload<{ include: { items: true } }>,
  resolutions: Record<string, Resolution>,
  writeOffReason: string | undefined,
  context: string,
) {
  const productIds = order.items.map((i) => i.productId).filter((x): x is string => Boolean(x));
  await lockProducts(tx, productIds);
  const products = new Map((await tx.product.findMany({ where: { id: { in: productIds } } })).map((p) => [p.id, p]));
  const notes: string[] = [];
  for (const item of order.items) {
    if (item.stockState === "RESERVED" && item.qtyFromStock > 0 && item.productId) {
      await applyMovement(tx, {
        productId: item.productId,
        type: "RELEASE",
        quantity: item.qtyFromStock,
        deltaOnHand: 0,
        deltaReserved: -item.qtyFromStock,
        actorId: actor.id,
        orderId: order.id,
        orderItemId: item.id,
        reason: context,
      });
      await tx.orderItem.update({ where: { id: item.id }, data: { stockState: "RELEASED" } });
      notes.push(`trả ${item.qtyFromStock} ${item.nameSnapshot} về kho`);
    }
    if (item.qtyMade > 0 && item.productId) {
      const choice = resolutions[item.id];
      if (!choice) throw new AppError(`Chọn nhập kho hay hư hao cho ${item.qtyMade} ${item.nameSnapshot} đã làm.`);
      const product = products.get(item.productId)!;
      if (choice === "RESTOCK") {
        if (product.fulfillmentMode === "MADE_TO_ORDER") {
          throw new AppError(`"${product.name}" làm theo đơn nên không nhập kho được. Chọn hư hao, hoặc đổi phương thức sản phẩm sang Linh hoạt trước.`);
        }
        await applyMovement(tx, {
          productId: item.productId,
          type: "RESTOCK_FROM_ORDER",
          quantity: item.qtyMade,
          deltaOnHand: item.qtyMade,
          deltaReserved: 0,
          actorId: actor.id,
          orderId: order.id,
          orderItemId: item.id,
          reason: context,
        });
        notes.push(`nhập ${item.qtyMade} ${item.nameSnapshot} đã làm vào kho`);
      } else {
        const reason = writeOffReason?.trim();
        if (!reason) throw new AppError("Vui lòng ghi lý do hư hao.", { writeOffReason: "Bắt buộc" });
        await applyMovement(tx, {
          productId: item.productId,
          type: "WRITE_OFF",
          quantity: item.qtyMade,
          deltaOnHand: 0,
          deltaReserved: 0,
          actorId: actor.id,
          orderId: order.id,
          orderItemId: item.id,
          reason,
        });
        notes.push(`ghi hư hao ${item.qtyMade} ${item.nameSnapshot}`);
      }
    }
  }
  return notes;
}

export async function cancelOrder(
  actor: CurrentUser,
  orderId: string,
  reason: string,
  resolutions: Record<string, Resolution> = {},
  writeOffReason?: string,
) {
  if (!reason.trim()) throw new AppError("Vui lòng ghi lý do hủy đơn.", { reason: "Bắt buộc" });
  return prisma.$transaction(async (tx) => {
    const order = await loadForTransition(tx, orderId, "cancel", actor);
    const notes = order.status === "NEW" ? [] : await releaseOrder(tx, actor, order, resolutions, writeOffReason, `Hủy đơn ${order.code}`);
    await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason.trim(), updatedById: actor.id },
    });
    const paid = await loadPaid(tx, orderId);
    await audit(tx, {
      actorId: actor.id,
      action: "order.cancel",
      entityType: "order",
      entityId: orderId,
      summary: `Hủy đơn ${order.code}: ${reason.trim()}${notes.length ? `; ${notes.join(", ")}` : ""}`,
    });
    return { paid };
  });
}

export async function unconfirmOrder(actor: CurrentUser, orderId: string, resolutions: Record<string, Resolution> = {}, writeOffReason?: string) {
  return prisma.$transaction(async (tx) => {
    const order = await loadForTransition(tx, orderId, "unconfirm", actor);
    const notes = await releaseOrder(tx, actor, order, resolutions, writeOffReason, `Hủy xác nhận đơn ${order.code}`);
    await tx.orderItem.updateMany({
      where: { orderId },
      data: { qtyFromStock: 0, qtyToMake: 0, qtyMade: 0, allocatedAt: null, stockState: "NONE" },
    });
    await tx.order.update({ where: { id: orderId }, data: { status: "NEW", confirmedAt: null, updatedById: actor.id } });
    await audit(tx, {
      actorId: actor.id,
      action: "order.unconfirm",
      entityType: "order",
      entityId: orderId,
      summary: `Hủy xác nhận đơn ${order.code}${notes.length ? `; ${notes.join(", ")}` : ""}`,
    });
  });
}

// ===== Payments =====

export async function addPayment(
  actor: CurrentUser,
  orderId: string,
  input: { type: PaymentType; amount: number; method: PaymentMethod; note?: string },
) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new AppError("Số tiền phải lớn hơn 0.", { amount: "Không hợp lệ" });
  if (input.type === "REFUND" && actor.role !== "owner") throw new ForbiddenError("Chỉ chủ shop được hoàn tiền.");
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError("Không tìm thấy đơn.");
    const paid = await loadPaid(tx, orderId);
    if (input.type === "REFUND") {
      if (input.amount > paid) throw new AppError(`Số hoàn không được lớn hơn số đã thu (${formatMoney(paid)}).`, { amount: "Quá số đã thu" });
    } else {
      if (order.status === "CANCELLED") throw new AppError("Đơn đã hủy, chỉ có thể hoàn tiền.");
      const owed = order.total - paid;
      if (input.amount > owed) throw new AppError(`Số tiền vượt quá phần còn lại (${formatMoney(Math.max(0, owed))}).`, { amount: "Vượt quá phần còn lại" });
    }
    const payment = await tx.payment.create({
      data: { orderId, type: input.type, amount: input.amount, method: input.method, note: blank(input.note), createdById: actor.id },
    });
    const label = input.type === "REFUND" ? "Hoàn tiền" : input.type === "DEPOSIT" ? "Ghi nhận cọc" : "Ghi nhận thanh toán";
    await audit(tx, { actorId: actor.id, action: `payment.${input.type.toLowerCase()}`, entityType: "order", entityId: orderId, summary: `${label} ${formatMoney(input.amount)} cho đơn ${order.code}` });
    return payment;
  });
}

export async function voidPayment(actor: CurrentUser, paymentId: string, reason: string) {
  if (actor.role !== "owner") throw new ForbiddenError("Chỉ chủ shop được hủy dòng thanh toán.");
  if (!reason.trim()) throw new AppError("Vui lòng ghi lý do.", { reason: "Bắt buộc" });
  return prisma.$transaction(async (tx) => {
    const found = await tx.payment.findUnique({ where: { id: paymentId }, select: { orderId: true } });
    if (!found) throw new NotFoundError("Không tìm thấy dòng thanh toán.");
    await lockOrder(tx, found.orderId);
    // Re-read under the order lock so two concurrent voids cannot both pass.
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
    if (payment.voidedAt) throw new AppError("Dòng này đã được hủy trước đó.");
    if (payment.type !== "REFUND") {
      // Voiding a receipt must not leave refunds larger than what remains collected.
      const paidAfter = (await loadPaid(tx, payment.orderId)) - payment.amount;
      if (paidAfter < 0) throw new AppError("Không thể hủy: số đã hoàn sẽ lớn hơn số đã thu.");
    }
    await tx.payment.update({ where: { id: paymentId }, data: { voidedAt: new Date(), voidedById: actor.id, voidReason: reason.trim() } });
    await audit(tx, {
      actorId: actor.id,
      action: "payment.void",
      entityType: "order",
      entityId: payment.orderId,
      summary: `Hủy dòng thanh toán ${formatMoney(payment.amount)} của đơn ${payment.order.code}: ${reason.trim()}`,
    });
  });
}

// ===== Queries =====

export type DateField = "delivery" | "created";

export interface OrderListFilter {
  from?: Ymd;
  to?: Ymd;
  dateField: DateField;
  statuses?: OrderStatus[];
  q?: string;
  customerId?: string;
}

function listWhere(f: OrderListFilter, withStatus = true): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  if (f.from && f.to) {
    and.push(
      f.dateField === "created"
        ? { createdAt: vnDayRange(f.from, f.to) }
        : { deliveryDate: { gte: ymdToDbDate(f.from), lte: ymdToDbDate(f.to) } },
    );
  }
  if (withStatus && f.statuses?.length) and.push({ status: { in: f.statuses } });
  if (f.customerId) and.push({ customerId: f.customerId });
  const q = f.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    const or: Prisma.OrderWhereInput[] = [
      { code: { contains: q, mode: "insensitive" } },
      { recipientName: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
    ];
    if (digits.length >= 3) {
      const local = digits.startsWith("84") ? "0" + digits.slice(2) : digits;
      or.push({ recipientPhone: { contains: local } }, { customer: { phone: { contains: local } } });
    }
    and.push({ OR: or });
  }
  return and.length ? { AND: and } : {};
}

const listInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  items: { select: { qtyToMake: true, qtyMade: true } },
  payments: { select: { type: true, amount: true, voidedAt: true } },
} satisfies Prisma.OrderInclude;

export type OrderListRow = Awaited<ReturnType<typeof listOrders>>["rows"][number];

export async function listOrders(f: OrderListFilter, page: number, pageSize = 30) {
  const where = listWhere(f);
  // Without a date range, newest first; a delivery-date range reads like a schedule.
  const orderBy: Prisma.OrderOrderByWithRelationInput[] =
    f.dateField === "created" || !f.from
      ? [{ createdAt: "desc" }]
      : [{ deliveryDate: { sort: "asc", nulls: "last" } }, { deliveryTimeFrom: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }];
  const [rows, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, include: listInclude }),
    prisma.order.count({ where }),
  ]);
  return { rows: rows.map(decorate), total, pageSize };
}

export async function statusCounts(f: OrderListFilter) {
  const groups = await prisma.order.groupBy({ by: ["status"], where: listWhere(f, false), _count: { _all: true } });
  const counts: Partial<Record<OrderStatus, number>> = {};
  for (const g of groups) counts[g.status] = g._count._all;
  return counts;
}

function decorate<T extends Prisma.OrderGetPayload<{ include: typeof listInclude }>>(o: T) {
  const paid = netPaid(o.payments);
  const needMake = o.items.reduce((s, i) => s + i.qtyToMake, 0);
  const made = o.items.reduce((s, i) => s + Math.min(i.qtyMade, i.qtyToMake), 0);
  return {
    ...o,
    paid,
    owed: Math.max(0, o.total - paid),
    payState: paymentState(o.total, paid),
    production: productionState(o.status, o.items),
    needMake,
    made,
  };
}

/** `includeCost` must be false for staff: cost snapshots are removed here, not only hidden in the UI. */
export async function getOrder(id: string, opts: { includeCost: boolean }) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            select: { id: true, fulfillmentMode: true, status: true, images: { where: { isPrimary: true }, select: { url: true }, take: 1 } },
          },
        },
      },
      payments: { orderBy: { paidAt: "asc" }, include: { createdBy: { select: { name: true } }, voidedBy: { select: { name: true } } } },
    },
  });
  if (!order) return null;
  const paid = netPaid(order.payments);
  return {
    ...order,
    items: opts.includeCost ? order.items : order.items.map((i) => ({ ...i, unitCostSnapshot: null })),
    paid,
    owed: Math.max(0, order.total - paid),
    payState: paymentState(order.total, paid),
    production: productionState(order.status, order.items),
    remaining: ACTIVE_STATUSES.includes(order.status) ? remainingToMake(order.items) : 0,
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>;
