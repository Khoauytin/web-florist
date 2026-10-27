"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionUser } from "@/server/auth/session";
import { INVALID_ID, toActionState, type ActionState } from "@/server/errors";
import { idsValid } from "@/lib/ids";
import {
  addPayment,
  cancelOrder,
  completeOrder,
  confirmOrder,
  createOrder,
  failDelivery,
  retryDelivery,
  setMade,
  startDelivery,
  unconfirmOrder,
  updateOrderFull,
  updateOrderLogistics,
  voidPayment,
  type Resolution,
} from "@/server/services/orders.service";
import { searchOrderableProducts } from "@/server/services/catalog.service";
import { findCustomerByPhone } from "@/server/services/customers.service";
import { isYmd } from "@/lib/dates";

const money = z.number().int().min(0).max(2_000_000_000);
const optText = (max: number) => z.string().max(max).optional();
const ymd = z.string().refine(isYmd, "Ngày không hợp lệ").nullable().optional();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Giờ không hợp lệ").nullable().optional().or(z.literal(""));

const itemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  productId: z.string().uuid().nullable().optional(),
  name: optText(200),
  unitPrice: money.optional(),
  qty: z.number().int().min(1).max(10000),
  note: optText(500),
});

const logisticsShape = {
  recipientName: z.string().max(120),
  recipientPhone: z.string().max(30),
  receiveType: z.enum(["DELIVERY", "PICKUP"]),
  deliveryAddress: optText(300),
  deliveryDate: ymd,
  deliveryTimeFrom: time,
  deliveryTimeTo: time,
  courierName: optText(120),
  cardMessage: optText(500),
  note: optText(2000),
};

const orderSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().max(120),
  customerPhone: z.string().max(30),
  customerAddress: optText(300),
  channel: z.enum(["FACEBOOK", "ZALO", "PHONE", "IN_STORE", "OTHER"]),
  discount: money,
  shippingFee: money,
  deposit: z.object({ amount: money, method: z.enum(["CASH", "BANK_TRANSFER", "OTHER"]) }).nullable().optional(),
  items: z.array(itemSchema).min(1, "Đơn hàng cần ít nhất một sản phẩm").max(50),
  ...logisticsShape,
});

const logisticsSchema = z.object({ ...logisticsShape, discount: money.optional(), shippingFee: money.optional() });

export type OrderPayload = z.input<typeof orderSchema>;
export type LogisticsPayload = z.input<typeof logisticsSchema>;

type Result = ActionState & { id?: string };

function invalid(err: z.ZodError): Result {
  const first = err.issues[0];
  return { ok: false, error: first?.message && !first.message.startsWith("Invalid") ? first.message : "Dữ liệu không hợp lệ, vui lòng kiểm tra lại." };
}

function refresh(orderId?: string) {
  revalidatePath("/orders");
  revalidatePath("/today");
  revalidatePath("/production");
  if (orderId) revalidatePath(`/orders/${orderId}`);
}

export async function createOrderAction(payload: OrderPayload): Promise<Result> {
  const parsed = orderSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const user = await actionUser();
    const { id, code } = await createOrder(user, { ...parsed.data, deliveryTimeFrom: parsed.data.deliveryTimeFrom || null, deliveryTimeTo: parsed.data.deliveryTimeTo || null });
    refresh(id);
    return { ok: true, id, message: `Đã tạo đơn ${code}` };
  } catch (e) {
    return toActionState(e);
  }
}

export async function updateOrderAction(orderId: string, payload: OrderPayload): Promise<Result> {
  if (!idsValid(orderId)) return INVALID_ID;
  const parsed = orderSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const user = await actionUser();
    await updateOrderFull(user, orderId, { ...parsed.data, deliveryTimeFrom: parsed.data.deliveryTimeFrom || null, deliveryTimeTo: parsed.data.deliveryTimeTo || null });
    refresh(orderId);
    return { ok: true, id: orderId, message: "Đã lưu đơn" };
  } catch (e) {
    return toActionState(e);
  }
}

export async function updateLogisticsAction(orderId: string, payload: LogisticsPayload): Promise<Result> {
  if (!idsValid(orderId)) return INVALID_ID;
  const parsed = logisticsSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const user = await actionUser();
    await updateOrderLogistics(user, orderId, { ...parsed.data, deliveryTimeFrom: parsed.data.deliveryTimeFrom || null, deliveryTimeTo: parsed.data.deliveryTimeTo || null });
    refresh(orderId);
    return { ok: true, id: orderId, message: "Đã lưu thông tin giao nhận" };
  } catch (e) {
    return toActionState(e);
  }
}

async function run(orderId: string, fn: () => Promise<unknown>, message: string): Promise<ActionState> {
  if (!idsValid(orderId)) return INVALID_ID;
  try {
    await fn();
    refresh(orderId);
    return { ok: true, message };
  } catch (e) {
    return toActionState(e);
  }
}

export async function confirmOrderAction(orderId: string) {
  return run(orderId, async () => confirmOrder(await actionUser(), orderId), "Đã xác nhận đơn và giữ hàng");
}

export async function startDeliveryAction(orderId: string) {
  return run(orderId, async () => startDelivery(await actionUser(), orderId), "Đã chuyển sang bước giao");
}

export async function completeOrderAction(orderId: string) {
  return run(orderId, async () => completeOrder(await actionUser(), orderId), "Đã hoàn thành đơn");
}

export async function failDeliveryAction(orderId: string, reason: string) {
  return run(orderId, async () => failDelivery(await actionUser(), orderId, String(reason).slice(0, 500)), "Đã ghi nhận giao thất bại. Hàng vẫn được giữ cho đơn.");
}

export async function retryDeliveryAction(orderId: string) {
  return run(orderId, async () => retryDelivery(await actionUser(), orderId), "Đã chuyển sang giao lại");
}

const resolutionsSchema = z.record(z.string().uuid(), z.enum(["RESTOCK", "WRITE_OFF"]));

export async function cancelOrderAction(orderId: string, reason: string, resolutions: Record<string, Resolution>, writeOffReason?: string) {
  const r = resolutionsSchema.safeParse(resolutions);
  if (!r.success) return { ok: false, error: "Lựa chọn xử lý hàng không hợp lệ." } satisfies ActionState;
  return run(orderId, async () => cancelOrder(await actionUser(), orderId, String(reason).slice(0, 500), r.data, writeOffReason?.slice(0, 500)), "Đã hủy đơn");
}

export async function unconfirmOrderAction(orderId: string, resolutions: Record<string, Resolution>, writeOffReason?: string) {
  const r = resolutionsSchema.safeParse(resolutions);
  if (!r.success) return { ok: false, error: "Lựa chọn xử lý hàng không hợp lệ." } satisfies ActionState;
  return run(orderId, async () => unconfirmOrder(await actionUser(), orderId, r.data, writeOffReason?.slice(0, 500)), "Đã hủy xác nhận. Đơn trở về trạng thái Mới.");
}

export async function setMadeAction(orderId: string, itemId: string, qtyMade: number) {
  if (!z.string().uuid().safeParse(itemId).success || !Number.isInteger(qtyMade)) return { ok: false, error: "Dữ liệu không hợp lệ." } satisfies ActionState;
  return run(orderId, async () => setMade(await actionUser(), itemId, qtyMade), "Đã cập nhật số đã làm");
}

const paymentSchema = z.object({
  type: z.enum(["DEPOSIT", "PAYMENT", "REFUND"]),
  amount: z.number().int().min(1).max(2_000_000_000),
  method: z.enum(["CASH", "BANK_TRANSFER", "OTHER"]),
  note: optText(300),
});

export async function addPaymentAction(orderId: string, payload: z.input<typeof paymentSchema>) {
  const parsed = paymentSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Số tiền không hợp lệ." } satisfies ActionState;
  const label = parsed.data.type === "REFUND" ? "Đã ghi nhận hoàn tiền" : "Đã ghi nhận thanh toán";
  return run(orderId, async () => addPayment(await actionUser(), orderId, parsed.data), label);
}

export async function voidPaymentAction(orderId: string, paymentId: string, reason: string) {
  if (!idsValid(paymentId)) return INVALID_ID;
  return run(orderId, async () => voidPayment(await actionUser(), paymentId, String(reason).slice(0, 300)), "Đã hủy dòng thanh toán");
}

export async function searchProductsAction(q: string) {
  await actionUser();
  const rows = await searchOrderableProducts(String(q).slice(0, 100));
  return rows.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    price: p.price,
    mode: p.fulfillmentMode,
    available: p.onHand - p.reserved,
    imageUrl: p.images[0]?.url ?? null,
  }));
}

export async function findCustomerAction(phone: string) {
  await actionUser();
  const c = await findCustomerByPhone(String(phone).slice(0, 30));
  return c ? { id: c.id, name: c.name, phone: c.phone, address: c.address } : null;
}
