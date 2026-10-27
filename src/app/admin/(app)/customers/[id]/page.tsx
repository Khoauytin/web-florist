import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer } from "@/server/services/customers.service";
import { customerOrders } from "@/server/services/orders.service";
import { formatPhone } from "@/server/domain/phone";
import { NotFoundError } from "@/server/errors";
import { Icon } from "@/components/admin/icon";
import { OrderCard } from "@/components/admin/orders";
import { formatMoney } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Khách hàng" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const c = await getCustomer(id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const orders = await customerOrders(id);
  return (
    <>
      <Link className="back" href="/admin/customers">
        <Icon name="back" />
        Khách hàng
      </Link>
      <div className="shead" style={{ marginTop: 8 }}>
        <div>
          <h1>{c.name}</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {formatPhone(c.phone)}
          </p>
        </div>
        <div className="actions" style={{ flexWrap: "nowrap" }}>
          <a className="round-btn" href={`tel:${c.phone}`} aria-label={`Gọi ${c.name}`}>
            <Icon name="phone" />
          </a>
          <Link className="round-btn" href={`/admin/customers/${id}/edit`} aria-label="Sửa thông tin khách">
            <Icon name="edit" />
          </Link>
        </div>
      </div>
      <div className="sum" style={{ margin: "16px 0" }}>
        <div>
          <b>{c.stats.orders}</b>
          <span>Số đơn (trừ đơn hủy)</span>
        </div>
        <div>
          <b>{formatMoney(c.stats.spent)}</b>
          <span>Đã mua (đơn hoàn thành)</span>
        </div>
      </div>
      <div className="card pad">
        <dl className="kv">
          <dt>Địa chỉ</dt>
          <dd>{c.address ?? <span className="muted">Chưa có</span>}</dd>
          <dt>Ghi chú</dt>
          <dd style={{ whiteSpace: "pre-wrap" }}>{c.note ?? <span className="muted">Không có</span>}</dd>
        </dl>
      </div>
      <section className="section" aria-labelledby="h-orders">
        <div className="shead">
          <h2 id="h-orders">Lịch sử đơn</h2>
          <Link className="btn btn-light btn-sm" href={`/admin/orders/new?phone=${c.phone}`}>
            <Icon name="plus" className="icon-sm" />
            Tạo đơn
          </Link>
        </div>
        <div className="olist">
          {orders.length ? orders.map((o) => <OrderCard key={o.id} o={o} />) : <div className="card empty"><p className="muted">Khách này chưa có đơn.</p></div>}
        </div>
      </section>
    </>
  );
}
