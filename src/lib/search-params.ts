export type SearchParams = Record<string, string | string[] | undefined>;

export function one(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export function pageOf(sp: SearchParams): number {
  const n = Number(one(sp, "page"));
  return Number.isInteger(n) && n > 0 && n < 10000 ? n : 1;
}

/** Rebuild a URL with one param changed, keeping the rest. */
export function withParam(path: string, sp: SearchParams, key: string, value: string | number | null): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val !== undefined && k !== key) next.set(k, val);
  }
  if (value !== null && value !== "") next.set(key, String(value));
  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}
