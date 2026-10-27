export interface PricedLine {
  unitPrice: number;
  qty: number;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
}

export class TotalsError extends Error {}

/** Server-side source of truth for order money (spec 3.6). */
export function computeTotals(lines: PricedLine[], discount: number, shippingFee: number): OrderTotals {
  for (const n of [discount, shippingFee]) {
    if (!Number.isInteger(n) || n < 0) throw new TotalsError("Giảm giá và phí giao phải là số tiền không âm");
  }
  const subtotal = lines.reduce((sum, l) => {
    if (!Number.isInteger(l.unitPrice) || l.unitPrice < 0) throw new TotalsError("Đơn giá không hợp lệ");
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw new TotalsError("Số lượng phải là số nguyên dương");
    return sum + l.unitPrice * l.qty;
  }, 0);
  if (discount > subtotal) throw new TotalsError("Giảm giá không được lớn hơn tạm tính");
  return { subtotal, discount, shippingFee, total: subtotal - discount + shippingFee };
}

export interface PaymentRow {
  type: "DEPOSIT" | "PAYMENT" | "REFUND";
  amount: number;
  voidedAt: Date | null;
}

/** Đã thu ròng: deposits + payments - refunds, ignoring voided rows. */
export function netPaid(payments: PaymentRow[]): number {
  return payments.reduce((sum, p) => {
    if (p.voidedAt) return sum;
    return p.type === "REFUND" ? sum - p.amount : sum + p.amount;
  }, 0);
}

export type PaymentState = "UNPAID" | "DEPOSITED" | "PAID";

export function paymentState(total: number, paid: number): PaymentState {
  if (paid <= 0) return "UNPAID";
  return paid >= total ? "PAID" : "DEPOSITED";
}
