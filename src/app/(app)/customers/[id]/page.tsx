import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getCustomer } from "@/server/services/customers.service";
import { listOrders } from "@/server/services/orders.service";
import { formatPhone } from "@/server/domain/phone";
import { NotFoundError } from "@/server/errors";
import { RangeFilter } from "@/components/date-filters";
import { OrderListHead, OrderRow, Pager } from "@/components/orders/order-bits";
import { Icon } from "@/components/icon";
import { formatDateTime, formatRange, parseRange, todayVn } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { one, pageOf, withParam, type SearchParams } from "@/lib/search-params";

export const metadata = { title: "Khách hàng" };

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const customer = await getCustomer(id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const range = parseRange(one(sp, "from"), one(sp, "to"), null);
  const page = pageOf(sp);
  const { rows, total, pageSize } = await listOrders({ customerId: id, from: range?.from, to: range?.to, dateField: "created" }, page, 20);

  return (
    <>
      <Link className="back" href="/customers">
        <Icon name="back" />
        Khách hàng
      </Link>
      <div className="pagehead" style={{ marginTop: 4 }}>
        <div>
          <h1>{customer.name}</h1>
          <p className="sub">
            <a href={`tel:${customer.phone}`}>{formatPhone(customer.phone)}</a>
            {customer.email ? ` · ${customer.email}` : ""}
          </p>
        </div>
        <div className="actions">
          <Link className="btn btn-primary" href={`/orders/new?phone=${customer.phone}`}>
            <Icon name="plus" />
            Tạo đơn
          </Link>
          <Link className="btn btn-secondary" href={`/customers/${id}/edit`}>
            <Icon name="edit" />
            Sửa
          </Link>
        </div>
      </div>
      <div className="stats">
        <div>
          <div className="v">{customer.stats.count}</div>
          <div className="l">Đơn hoàn thành</div>
        </div>
        <div>
          <div className="v">{formatMoney(customer.stats.spent)}</div>
          <div className="l">Tổng tiền đã mua</div>
        </div>
        <div>
          <div className="v">{customer.stats.last ? formatDateTime(customer.stats.last).slice(0, 10) : "Chưa có"}</div>
          <div className="l">Mua gần nhất</div>
        </div>
        <div>
          <div className="v">{total}</div>
          <div className="l">Đơn trong khoảng đang xem</div>
        </div>
      </div>
      {customer.address || customer.note ? (
        <dl className="panel kv" style={{ marginTop: 16 }}>
          {customer.address ? (
            <>
              <dt>Địa chỉ</dt>
              <dd>{customer.address}</dd>
            </>
          ) : null}
          {customer.note ? (
            <>
              <dt>Ghi chú</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>{customer.note}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
      <section className="section" aria-labelledby="h-orders">
        <div className="head">
          <h2 id="h-orders">Lịch sử đơn</h2>
          <span className="small muted">{range ? `Tạo ${formatRange(range.from, range.to)}` : "Mọi ngày"}</span>
        </div>
        <RangeFilter from={range?.from ?? null} to={range?.to ?? null} today={todayVn()} allowAll allLabel="Mọi ngày" presets={["thisMonth", "lastMonth", "last7"]} />
        {rows.length ? (
          <div className="olist">
            <OrderListHead />
            {rows.map((o) => (
              <OrderRow key={o.id} o={o} />
            ))}
          </div>
        ) : (
          <div className="panel empty">
            <p>Không có đơn nào trong khoảng này.</p>
          </div>
        )}
        <Pager page={page} total={total} pageSize={pageSize} hrefFor={(p) => withParam(`/customers/${id}`, sp, "page", p)} />
      </section>
    </>
  );
}
