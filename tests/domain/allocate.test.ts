import { describe, expect, it } from "vitest";
import { allocate, type AllocationProduct } from "@/server/domain/allocate";

const products = (entries: Record<string, AllocationProduct>) => new Map(Object.entries(entries));

describe("allocate", () => {
  it("flexible: 20 ordered with 3 in stock takes 3 and makes 17", () => {
    const r = allocate([{ productId: "red", qty: 20 }], products({ red: { mode: "FLEXIBLE", available: 3, name: "Bó hoa sáp đỏ" } }));
    expect(r).toEqual({ ok: true, lines: [{ fromStock: 3, toMake: 17 }] });
  });

  it("flexible: 10 ordered with nothing in stock makes all 10 and never goes negative", () => {
    const r = allocate([{ productId: "red", qty: 10 }], products({ red: { mode: "FLEXIBLE", available: 0, name: "Đỏ" } }));
    expect(r).toEqual({ ok: true, lines: [{ fromStock: 0, toMake: 10 }] });
  });

  it("flexible: enough stock takes everything from stock", () => {
    const r = allocate([{ productId: "red", qty: 10 }], products({ red: { mode: "FLEXIBLE", available: 15, name: "Đỏ" } }));
    expect(r).toEqual({ ok: true, lines: [{ fromStock: 10, toMake: 0 }] });
  });

  it("made to order never uses stock", () => {
    const r = allocate([{ productId: "g", qty: 2 }], products({ g: { mode: "MADE_TO_ORDER", available: 9, name: "Giỏ" } }));
    expect(r).toEqual({ ok: true, lines: [{ fromStock: 0, toMake: 2 }] });
  });

  it("free-text lines are always made", () => {
    const r = allocate([{ productId: null, qty: 1 }], new Map());
    expect(r).toEqual({ ok: true, lines: [{ fromStock: 0, toMake: 1 }] });
  });

  it("stock only: blocks confirmation when short, reporting requested and available", () => {
    const r = allocate([{ productId: "box", qty: 3 }], products({ box: { mode: "STOCK_ONLY", available: 2, name: "Hộp hoa" } }));
    expect(r).toEqual({ ok: false, shortages: [{ productId: "box", name: "Hộp hoa", requested: 3, available: 2 }] });
  });

  it("stock only: enough stock takes everything", () => {
    const r = allocate([{ productId: "box", qty: 2 }], products({ box: { mode: "STOCK_ONLY", available: 2, name: "Hộp" } }));
    expect(r).toEqual({ ok: true, lines: [{ fromStock: 2, toMake: 0 }] });
  });

  it("same product on several lines draws down the same stock", () => {
    const r = allocate(
      [
        { productId: "red", qty: 2 },
        { productId: "red", qty: 4 },
      ],
      products({ red: { mode: "FLEXIBLE", available: 3, name: "Đỏ" } }),
    );
    expect(r).toEqual({ ok: true, lines: [{ fromStock: 2, toMake: 0 }, { fromStock: 1, toMake: 3 }] });
  });

  it("stock only split across lines is checked on the total", () => {
    const r = allocate(
      [
        { productId: "box", qty: 1 },
        { productId: "box", qty: 2 },
      ],
      products({ box: { mode: "STOCK_ONLY", available: 2, name: "Hộp" } }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.shortages[0]).toMatchObject({ requested: 3, available: 2 });
  });

  it("treats negative availability as zero", () => {
    const r = allocate([{ productId: "red", qty: 1 }], products({ red: { mode: "FLEXIBLE", available: -2, name: "Đỏ" } }));
    expect(r).toEqual({ ok: true, lines: [{ fromStock: 0, toMake: 1 }] });
  });

  it("rejects non-positive quantities", () => {
    expect(() => allocate([{ productId: null, qty: 0 }], new Map())).toThrow();
  });
});
