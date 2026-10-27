export interface PricedLine {
  unitPrice: number;
  qty: number;
}

export interface OrderMoney {
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  deposit: number;
}

export class MoneyError extends Error {
  constructor(
    message: string,
    public readonly field: "discount" | "shippingFee" | "deposit" | "items",
  ) {
    super(message);
  }
}

const isMoney = (n: number) => Number.isInteger(n) && n >= 0 && n <= 2_000_000_000;

/** Server-side source of truth for order money (spec 4, "Tiền"). */
export function computeMoney(lines: PricedLine[], discount: number, shippingFee: number, deposit: number): OrderMoney {
  if (!isMoney(discount)) throw new MoneyError("Giảm giá không hợp lệ.", "discount");
  if (!isMoney(shippingFee)) throw new MoneyError("Phí ship không hợp lệ.", "shippingFee");
  if (!isMoney(deposit)) throw new MoneyError("Tiền cọc không hợp lệ.", "deposit");
  const subtotal = lines.reduce((sum, l) => {
    if (!isMoney(l.unitPrice)) throw new MoneyError("Đơn giá không hợp lệ.", "items");
    if (!Number.isInteger(l.qty) || l.qty <= 0 || l.qty > 10000) throw new MoneyError("Số lượng phải là số nguyên từ 1 đến 10000.", "items");
    return sum + l.unitPrice * l.qty;
  }, 0);
  if (discount > subtotal) throw new MoneyError("Giảm giá không được lớn hơn tạm tính.", "discount");
  const total = subtotal - discount + shippingFee;
  if (deposit > total) throw new MoneyError("Tiền cọc không được lớn hơn tổng tiền.", "deposit");
  return { subtotal, discount, shippingFee, total, deposit };
}

export const remaining = (o: { total: number; deposit: number }) => Math.max(0, o.total - o.deposit);
