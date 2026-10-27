import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { listOrders, statusCounts, type DateField } from "@/server/services/orders.service";
import { ParamSegment, RangeFilter, SearchBox } from "@/components/date-filters";
import { OrderListHead, OrderRow, Pager } from "@/components/orders/order-bits";
import { Icon } from "@/components/icon";
import { formatRange, parseRange, todayVn } from "@/lib/dates";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatusKey } from "@/lib/labels";
import { one, pageOf, withParam, type SearchParams } from "@/lib/search-params";

export const metadata = { title: "Đơn hàng" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser();
  const sp = await searchParams;
  const today = todayVn();
  const range = parseRange(one(sp, "from"), one(sp, "to"), null);
  const dateField: DateField = one(sp, "by") === "created" ? "created" : "delivery";
  const status = one(sp, "status");
  const statuses = status && (ORDER_STATUSES as string[]).includes(status) ? [status as OrderStatusKey] : undefined;
  const q = one(sp, "q") ?? "";
  const page = pageOf(sp);
  const filter = { from: range?.from, to: range?.to, dateField, statuses, q };
  const [{ rows, total, pageSize }, counts] = await Promise.all([listOrders(filter, page), statusCounts(filter)]);
  const all = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Đơn hàng</h1>
          <p className="sub">
            {range ? `${dateField === "created" ? "Tạo" : "Giao"} ${formatRange(range.from, range.to)}` : "Tất cả thời gian"}
          </p>
        </div>
        <Link className="btn btn-primary" href="/orders/new">
          <Icon name="plus" />
          Tạo đơn
        </Link>
      </div>

      <div className="filters">
        <SearchBox value={q} placeholder="Tìm theo mã đơn, tên hoặc số điện thoại" label="Tìm đơn" />
        <ParamSegment
          name="by"
          value={dateField}
          label="Lọc ngày theo"
          options={[
            { value: "delivery", label: "Theo ngày giao" },
            { value: "created", label: "Theo ngày tạo" },
          ]}
        />
        <RangeFilter
          from={range?.from ?? null}
          to={range?.to ?? null}
          today={today}
          allowAll
          allLabel="Mọi ngày"
          presets={dateField === "created" ? ["today", "last7", "thisMonth", "lastMonth"] : ["today", "tomorrow", "next7", "thisMonth"]}
        />
        <div className="chips" role="group" aria-label="Lọc theo trạng thái">
          <Link className="chip" href={withParam("/orders", { ...sp, page: undefined }, "status", null)} aria-current={!statuses ? "true" : undefined}>
            Tất cả<span className="n">{all}</span>
          </Link>
          {ORDER_STATUSES.map((s) => (
            <Link key={s} className="chip" href={withParam("/orders", { ...sp, page: undefined }, "status", s)} aria-current={statuses?.[0] === s ? "true" : undefined}>
              {ORDER_STATUS_LABELS[s]}
              <span className="n">{counts[s] ?? 0}</span>
            </Link>
          ))}
        </div>
      </div>

      {rows.length ? (
        <div className="olist">
          <OrderListHead />
          {rows.map((o) => (
            <OrderRow key={o.id} o={o} />
          ))}
        </div>
      ) : (
        <div className="panel empty">
          <p>Không có đơn nào khớp bộ lọc.</p>
          <Link className="btn btn-secondary" href="/orders">
            Xóa bộ lọc
          </Link>
        </div>
      )}
      <Pager page={page} total={total} pageSize={pageSize} hrefFor={(p) => withParam("/orders", sp, "page", p)} />
    </>
  );
}
