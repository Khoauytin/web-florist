import { describe, expect, it } from "vitest";
import { computeTotals, netPaid, paymentState, TotalsError } from "@/server/domain/order-totals";
import { canPerform, productionState, remainingToMake } from "@/server/domain/order-status";
import { formatOrderCode } from "@/server/domain/order-code";
import { formatPhone, normalizePhone } from "@/server/domain/phone";

describe("computeTotals", () => {
  it("matches the order DH-261026-003 example", () => {
    const t = computeTotals([{ unitPrice: 350000, qty: 20 }, { unitPrice: 650000, qty: 1 }], 350000, 50000);
    expect(t).toEqual({ subtotal: 7650000, discount: 350000, shippingFee: 50000, total: 7350000 });
  });
  it("rejects a discount above the subtotal", () => {
    expect(() => computeTotals([{ unitPrice: 100, qty: 1 }], 200, 0)).toThrow(TotalsError);
  });
  it("rejects negative and fractional money", () => {
    expect(() => computeTotals([{ unitPrice: 100, qty: 1 }], -1, 0)).toThrow(TotalsError);
    expect(() => computeTotals([{ unitPrice: 10.5, qty: 1 }], 0, 0)).toThrow(TotalsError);
  });
});

describe("payments", () => {
  const p = (type: "DEPOSIT" | "PAYMENT" | "REFUND", amount: number, voided = false) => ({ type, amount, voidedAt: voided ? new Date() : null });
  it("nets deposits, payments and refunds, ignoring voided rows", () => {
    expect(netPaid([p("DEPOSIT", 3000000), p("PAYMENT", 1000000), p("REFUND", 500000), p("PAYMENT", 999, true)])).toBe(3500000);
  });
  it("derives the payment state", () => {
    expect(paymentState(1000, 0)).toBe("UNPAID");
    expect(paymentState(1000, 400)).toBe("DEPOSITED");
    expect(paymentState(1000, 1000)).toBe("PAID");
  });
});

describe("order transitions", () => {
  it("lets staff confirm and cancel only new orders", () => {
    expect(canPerform("confirm", "NEW", "staff")).toBe(true);
    expect(canPerform("cancel", "NEW", "staff")).toBe(true);
    expect(canPerform("cancel", "CONFIRMED", "staff")).toBe(false);
    expect(canPerform("cancel", "CONFIRMED", "owner")).toBe(true);
  });
  it("keeps unconfirm owner-only and blocks invalid jumps", () => {
    expect(canPerform("unconfirm", "CONFIRMED", "staff")).toBe(false);
    expect(canPerform("unconfirm", "CONFIRMED", "owner")).toBe(true);
    expect(canPerform("complete", "CONFIRMED", "owner")).toBe(false);
    expect(canPerform("cancel", "COMPLETED", "owner")).toBe(false);
  });
  it("allows retrying a failed delivery or cancelling it (owner)", () => {
    expect(canPerform("retry_delivery", "DELIVERY_FAILED", "staff")).toBe(true);
    expect(canPerform("cancel", "DELIVERY_FAILED", "staff")).toBe(false);
    expect(canPerform("cancel", "DELIVERY_FAILED", "owner")).toBe(true);
  });
});

describe("production state", () => {
  it("is null before confirmation and after completion", () => {
    expect(productionState("NEW", [{ qtyToMake: 1, qtyMade: 0 }])).toBeNull();
    expect(productionState("COMPLETED", [{ qtyToMake: 1, qtyMade: 1 }])).toBeNull();
  });
  it("moves from not started to ready", () => {
    expect(productionState("CONFIRMED", [{ qtyToMake: 17, qtyMade: 0 }])).toBe("NOT_STARTED");
    expect(productionState("CONFIRMED", [{ qtyToMake: 17, qtyMade: 12 }])).toBe("IN_PROGRESS");
    expect(productionState("CONFIRMED", [{ qtyToMake: 17, qtyMade: 17 }, { qtyToMake: 0, qtyMade: 0 }])).toBe("READY");
    expect(remainingToMake([{ qtyToMake: 17, qtyMade: 12 }, { qtyToMake: 2, qtyMade: 0 }])).toBe(7);
  });
});

describe("codes and phones", () => {
  it("formats order codes", () => {
    expect(formatOrderCode("2026-10-26", 3)).toBe("DH-261026-003");
    expect(formatOrderCode("2026-10-26", 1234)).toBe("DH-261026-1234");
  });
  it("normalizes Vietnamese phone numbers", () => {
    expect(normalizePhone("+84 935 662 019")).toBe("0935662019");
    expect(normalizePhone("84935662019")).toBe("0935662019");
    expect(normalizePhone("0935.662.019")).toBe("0935662019");
    expect(normalizePhone("024 3826 1234")).toBe("02438261234");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(formatPhone("0935662019")).toBe("0935 662 019");
  });
});
