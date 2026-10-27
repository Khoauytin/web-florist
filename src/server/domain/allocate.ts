/**
 * Stock allocation at order confirmation (spec 5.3). Pure: the caller loads `available`
 * under row locks and applies the result inside the same transaction.
 */
export type FulfillmentMode = "STOCK_ONLY" | "MADE_TO_ORDER" | "FLEXIBLE";

export interface AllocationLine {
  /** null = free-text line */
  productId: string | null;
  qty: number;
}

export interface AllocationProduct {
  mode: FulfillmentMode;
  /** on_hand - reserved at the time of confirmation */
  available: number;
  name: string;
}

export interface LineAllocation {
  fromStock: number;
  toMake: number;
}

export interface Shortage {
  productId: string;
  name: string;
  requested: number;
  available: number;
}

export type AllocationResult =
  | { ok: true; lines: LineAllocation[] }
  | { ok: false; shortages: Shortage[] };

export function allocate(
  lines: AllocationLine[],
  products: ReadonlyMap<string, AllocationProduct>,
): AllocationResult {
  const remaining = new Map<string, number>();
  const requestedStockOnly = new Map<string, number>();
  const result: LineAllocation[] = [];

  for (const line of lines) {
    if (!Number.isInteger(line.qty) || line.qty <= 0) throw new Error("Số lượng phải là số nguyên dương");
    if (line.productId === null) {
      result.push({ fromStock: 0, toMake: line.qty });
      continue;
    }
    const product = products.get(line.productId);
    if (!product) throw new Error(`Không tìm thấy sản phẩm ${line.productId}`);
    const left = remaining.get(line.productId) ?? Math.max(0, product.available);

    if (product.mode === "MADE_TO_ORDER") {
      result.push({ fromStock: 0, toMake: line.qty });
    } else if (product.mode === "FLEXIBLE") {
      const fromStock = Math.min(line.qty, left);
      remaining.set(line.productId, left - fromStock);
      result.push({ fromStock, toMake: line.qty - fromStock });
    } else {
      requestedStockOnly.set(line.productId, (requestedStockOnly.get(line.productId) ?? 0) + line.qty);
      const fromStock = Math.min(line.qty, left);
      remaining.set(line.productId, left - fromStock);
      result.push({ fromStock, toMake: 0 });
    }
  }

  const shortages: Shortage[] = [];
  for (const [productId, requested] of requestedStockOnly) {
    const product = products.get(productId)!;
    if (requested > Math.max(0, product.available)) {
      shortages.push({ productId, name: product.name, requested, available: Math.max(0, product.available) });
    }
  }
  return shortages.length ? { ok: false, shortages } : { ok: true, lines: result };
}
