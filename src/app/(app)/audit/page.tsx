import Link from "next/link";
import { requireOwnerPage } from "@/server/auth/session";
import { AUDIT_ENTITY_LABELS, listAudit } from "@/server/services/audit.service";
import { RangeFilter } from "@/components/date-filters";
import { Pager } from "@/components/orders/order-bits";
import { formatDateTime, formatRange, parseRange, presetRange, todayVn } from "@/lib/dates";
import { one, pageOf, withParam, type SearchParams } from "@/lib/search-params";

export const metadata = { title: "Lịch sử thao tác" };

const LINKS: Record<string, (id: string) => string | null> = {
  order: (id) => `/orders/${id}`,
  product: (id) => `/products/${id}`,
  customer: (id) => `/customers/${id}`,
  category: () => "/categories",
  user: () => "/staff",
  payment: () => null,
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireOwnerPage();
  const sp = await searchParams;
  const today = todayVn();
  const range = parseRange(one(sp, "from"), one(sp, "to"), presetRange("last7", today))!;
  const type = one(sp, "type");
  const entityType = type && type in AUDIT_ENTITY_LABELS ? type : undefined;
  const page = pageOf(sp);
  const { rows, total, pageSize } = await listAudit({ from: range.from, to: range.to, entityType, page });

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Lịch sử thao tác</h1>
          <p className="sub">Ai làm gì, lúc nào · {formatRange(range.from, range.to)}</p>
        </div>
      </div>
      <div className="filters">
        <RangeFilter from={range.from} to={range.to} today={today} presets={["today", "last7", "thisMonth", "lastMonth"]} />
        <div className="chips" role="group" aria-label="Lọc theo loại">
          <Link className="chip" href={withParam("/audit", { ...sp, page: undefined }, "type", null)} aria-current={!entityType ? "true" : undefined}>
            Tất cả
          </Link>
          {Object.entries(AUDIT_ENTITY_LABELS).map(([k, label]) => (
            <Link key={k} className="chip" href={withParam("/audit", { ...sp, page: undefined }, "type", k)} aria-current={entityType === k ? "true" : undefined}>
              {label}
            </Link>
          ))}
        </div>
      </div>
      {rows.length ? (
        <div className="panel scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người làm</th>
                <th>Loại</th>
                <th>Nội dung</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const href = LINKS[r.entityType]?.(r.entityId) ?? null;
                return (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.createdAt)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{r.actor.name}</td>
                    <td>{AUDIT_ENTITY_LABELS[r.entityType as keyof typeof AUDIT_ENTITY_LABELS] ?? r.entityType}</td>
                    <td>{href ? <Link href={href}>{r.summary}</Link> : r.summary}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel empty">
          <p>Không có thao tác nào trong khoảng này.</p>
        </div>
      )}
      <Pager page={page} total={total} pageSize={pageSize} hrefFor={(p) => withParam("/audit", sp, "page", p)} />
    </>
  );
}
