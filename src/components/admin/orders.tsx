import Link from "next/link";
import { Icon, STATUS_ICON } from "@/components/admin/icon";
import { OrderMenu } from "@/components/admin/order-menu";
import type { OrderListRow } from "@/server/services/orders.service";
import { dbDateToYmd, formatYmdShort } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { ORDER_STATUS_LABELS, RECEIVE_TYPE_LABELS, type OrderStatusKey } from "@/lib/labels";

const CLS: Record<OrderStatusKey, string> = { NEW: "st-NEW", DELIVERING: "st-DELIVERING", COMPLETED: "st-DONE", CANCELLED: "st-CANCEL" };
const ICON_CLS: Record<OrderStatusKey, string> = { NEW: "NEW", DELIVERING: "DELIVERING", COMPLETED: "DONE", CANCELLED: "CANCEL" };

export function StatusPill({ status }: { status: OrderStatusKey }) {
  return <span className={`pill ${CLS[status]}`}>{ORDER_STATUS_LABELS[status]}</span>;
}

export function timeText(o: { deliveryTimeFrom: string | null; deliveryTimeTo: string | null }) {
  if (!o.deliveryTimeFrom) return "Cả ngày";
  return o.deliveryTimeTo ? `${o.deliveryTimeFrom} - ${o.deliveryTimeTo}` : o.deliveryTimeFrom;
}

const itemsText = (o: OrderListRow) => o.items.map((i) => `${i.qty} ${i.nameSnapshot}`).join(", ");
const qtyOf = (o: OrderListRow) => o.items.reduce((s, i) => s + i.qty, 0);
const left = (o: { total: number; deposit: number }) => Math.max(0, o.total - o.deposit);

/** Card used on the overview and customer pages (mockup "Đơn hàng"). */
export function OrderCard({ o }: { o: OrderListRow }) {
  const owe = left(o);
  return (
    <div className="card ocard">
      <Link className="ocard-link" href={`/admin/orders/${o.id}`} aria-label={`Xem đơn ${o.code} của ${o.customer.name}`} />
      <div className="row">
        <span className="datechip">
          <Icon name="cal" className="icon-sm" />
          {formatYmdShort(dbDateToYmd(o.deliveryDate))} · {timeText(o)}
        </span>
        <OrderMenu id={o.id} code={o.code} status={o.status} />
      </div>
      <div>
        <div className="name">{o.customer.name}</div>
        <div className="items">
          {qtyOf(o)} sản phẩm · {itemsText(o)}
        </div>
      </div>
      <div className="row">
        <span className="money">
          <span>
            Tổng <b>{formatMoney(o.total)}</b>
          </span>
          {o.status === "CANCELLED" ? null : owe ? (
            <span className="owe">
              Còn <b>{formatMoney(owe)}</b>
            </span>
          ) : (
            <span className="muted">Đã thu đủ</span>
          )}
        </span>
        <StatusPill status={o.status} />
      </div>
    </div>
  );
}

/** Row used in the calendar day list and the Today screen (mockup image 2). */
export function TaskRow({ o }: { o: OrderListRow }) {
  const owe = left(o);
  return (
    <Link className={o.status === "CANCELLED" ? "task cancel" : "task"} href={`/admin/orders/${o.id}`}>
      <Icon name={STATUS_ICON[o.status]} className={`ic ${ICON_CLS[o.status]}`} />
      <div>
        <div className="kind">
          {ORDER_STATUS_LABELS[o.status]} · {RECEIVE_TYPE_LABELS[o.receiveType]}
        </div>
        <div className="tt">
          {o.customer.name} · {itemsText(o)}
        </div>
        <div className="time">
          {timeText(o)}
          {o.deliveryAddress ? ` · ${o.deliveryAddress}` : ""}
        </div>
      </div>
      <div className="amt">
        <b>{formatMoney(o.total)}</b>
        {owe && o.status !== "CANCELLED" ? <span className="muted">Còn {formatMoney(owe)}</span> : null}
      </div>
    </Link>
  );
}

export function Thumb({ url, size, alt = "" }: { url: string | null | undefined; size: [number, number]; alt?: string }) {
  if (!url) {
    return (
      <span className="noimg" style={{ width: size[0], height: size[1] }} aria-hidden={alt ? undefined : true}>
        <Icon name="image" className="icon-sm" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} width={size[0]} height={size[1]} loading="lazy" />;
}
