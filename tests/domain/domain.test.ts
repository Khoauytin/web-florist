import { describe, expect, it } from "vitest";
import { MoneyError, computeMoney, remaining } from "@/server/domain/order-totals";
import { canDelete, moveStatus } from "@/server/domain/order-status";
import { formatProductCode, suggestPrefix } from "@/server/domain/product-code";
import { formatOrderCode } from "@/server/domain/order-code";
import { formatPhone, normalizePhone } from "@/server/domain/phone";

describe("order money", () => {
  it("computes total and remaining from lines, discount, shipping and deposit", () => {
    const m = computeMoney([{ unitPrice: 380000, qty: 20 }, { unitPrice: 650000, qty: 1 }], 350000, 50000, 3000000);
    expect(m).toEqual({ subtotal: 8250000, discount: 350000, shippingFee: 50000, total: 7950000, deposit: 3000000 });
    expect(remaining(m)).toBe(4950000);
  });
  it("rejects a deposit above the total and a discount above the subtotal", () => {
    expect(() => computeMoney([{ unitPrice: 100000, qty: 1 }], 0, 0, 100001)).toThrow(MoneyError);
    expect(() => computeMoney([{ unitPrice: 100000, qty: 1 }], 100001, 0, 0)).toThrow(/Giảm giá/);
  });
  it("rejects negative or fractional money and bad quantities", () => {
    expect(() => computeMoney([{ unitPrice: 100, qty: 1 }], -1, 0, 0)).toThrow();
    expect(() => computeMoney([{ unitPrice: 10.5, qty: 1 }], 0, 0, 0)).toThrow();
    expect(() => computeMoney([{ unitPrice: 100, qty: 0 }], 0, 0, 0)).toThrow();
  });
  it("never reports a negative remaining", () => {
    expect(remaining({ total: 100, deposit: 100 })).toBe(0);
  });
});

describe("order status", () => {
  it("moves forward New -> Delivering -> Completed", () => {
    expect(moveStatus("NEW", "next")).toBe("DELIVERING");
    expect(moveStatus("DELIVERING", "next")).toBe("COMPLETED");
    expect(moveStatus("COMPLETED", "next")).toBeNull();
  });
  it("goes back one step to fix a mistaken tap", () => {
    expect(moveStatus("COMPLETED", "back")).toBe("DELIVERING");
    expect(moveStatus("DELIVERING", "back")).toBe("NEW");
    expect(moveStatus("NEW", "back")).toBeNull();
  });
  it("cancels only new or delivering orders and restores cancelled ones to New", () => {
    expect(moveStatus("NEW", "cancel")).toBe("CANCELLED");
    expect(moveStatus("DELIVERING", "cancel")).toBe("CANCELLED");
    expect(moveStatus("COMPLETED", "cancel")).toBeNull();
    expect(moveStatus("CANCELLED", "restore")).toBe("NEW");
    expect(moveStatus("NEW", "restore")).toBeNull();
  });
  it("deletes only new or cancelled orders", () => {
    expect(canDelete("NEW")).toBe(true);
    expect(canDelete("CANCELLED")).toBe(true);
    expect(canDelete("DELIVERING")).toBe(false);
    expect(canDelete("COMPLETED")).toBe(false);
  });
});

describe("codes and phones", () => {
  it("formats product and order codes", () => {
    expect(formatProductCode("BO", 55)).toBe("BO-055");
    expect(formatProductCode("HC", 1234)).toBe("HC-1234");
    expect(formatOrderCode("2026-10-27", 3)).toBe("DH-261027-003");
  });
  it("suggests a prefix from a category name", () => {
    expect(suggestPrefix("Hoa cưới")).toBe("HC");
    expect(suggestPrefix("Bó hoa sinh nhật")).toBe("BHSN");
    expect(suggestPrefix("Đèn")).toBe("DEN");
    expect(suggestPrefix("  ")).toBe("SP");
  });
  it("normalizes Vietnamese phone numbers", () => {
    expect(normalizePhone("+84 935 662 019")).toBe("0935662019");
    expect(normalizePhone("0935.662.019")).toBe("0935662019");
    expect(normalizePhone("123")).toBeNull();
    expect(formatPhone("0935662019")).toBe("0935 662 019");
  });
});
