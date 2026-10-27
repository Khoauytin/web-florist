const money = new Intl.NumberFormat("vi-VN");

/** 7350000 -> "7.350.000đ" */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Chưa có giá";
  return money.format(value) + "đ";
}

export function formatNumber(value: number): string {
  return money.format(value);
}

/** "7.350.000", "7350000", "7,350,000đ" -> 7350000. Returns null when not a non-negative integer. */
export function parseMoney(input: FormDataEntryValue | string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).replace(/[.,\sđ₫]/gi, "");
  if (s === "") return 0;
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

export function timeWindow(from: string | null, to: string | null): string {
  if (from && to) return `${from} - ${to}`;
  return from ?? to ?? "";
}
