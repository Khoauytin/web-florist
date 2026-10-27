const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids from the client are checked before reaching SQL casts (::uuid) or Prisma. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Every argument must be a UUID (null allowed for "create" calls). */
export function idsValid(...values: (string | null | undefined)[]): boolean {
  return values.every((v) => v === null || isUuid(v));
}
