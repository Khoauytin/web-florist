import { getCurrentUser } from "@/server/auth/session";
import { buildWorkbook, exportFileName, type ExportFilter } from "@/server/services/exports.service";
import { parseRange, presetRange } from "@/lib/dates";
import { ORDER_STATUSES, type OrderStatusKey } from "@/lib/labels";

const UUID = /^[0-9a-f-]{36}$/i;

/** Owner-only download of the .xlsx report for the requested filters. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "owner") return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const p = url.searchParams;
  const range = parseRange(p.get("from") ?? undefined, p.get("to") ?? undefined, presetRange("thisMonth"))!;
  const statuses = p.getAll("status").filter((s): s is OrderStatusKey => (ORDER_STATUSES as string[]).includes(s));
  const pick = (k: string) => {
    const v = p.get(k);
    return v && UUID.test(v) ? v : undefined;
  };
  const filter: ExportFilter = {
    from: range.from,
    to: range.to,
    dateField: p.get("by") === "created" ? "created" : "delivery",
    statuses: statuses.length ? statuses : undefined,
    customerId: pick("customer"),
    categoryId: pick("category"),
    productId: pick("product"),
  };
  const body = await buildWorkbook(filter);
  const name = exportFileName(filter);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
