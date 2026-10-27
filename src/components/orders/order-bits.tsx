import Link from "next/link";
import type { OrderListRow } from "@/server/services/orders.service";
import { dbDateToYmd, formatYmdShort } from "@/lib/dates";
import { formatMoney, timeWindow } from "@/lib/format";
import { ORDER_STATUS_CLASS, PAYMENT_STATE_LABELS, PRODUCTION_LABELS, orderStatusLabel, type OrderStatusKey } from "@/lib/labels";

export function StatusBadge({ status, receiveType }: { status: OrderStatusKey; receiveType?: "DELIVERY" | "PICKUP" }) {
  return <span className={`badge ${ORDER_STATUS_CLASS[status]}`}>{orderStatusLabel(status, receiveType)}</span>;
}

export function OrderListHead() {
  return (
    <div className="ohead" aria-hidden="true">
      <span>Mã đơn</span>
      <span>Người nhận, ngày giao</span>
      <span>Trạng thái</span>
      <span>Sản xuất</span>
      <span>Thanh toán</span>
      <span style={{ textAlign: "right" }}>Tổng tiền</span>
    </div>
  );
}

export function OrderRow({ o }: { o: OrderListRow }) {
  const date = o.deliveryDate ? formatYmdShort(dbDateToYmd(o.deliveryDate)) : "Chưa hẹn ngày";
  const time = timeWindow(o.deliveryTimeFrom, o.deliveryTimeTo);
  let prod: React.ReactNode = null;
  if (o.production) {
    prod = (
      <span className="mini">
        {PRODUCTION_LABELS[o.production]}
        {o.needMake > 0 ? (
          <>
            <span className="bar" aria-hidden="true">
              <i style={{ width: `${Math.round((o.made / o.needMake) * 100)}%` }} />
            </span>
            {o.made}/{o.needMake}
          </>
        ) : null}
      </span>
    );
  } else if (o.status === "NEW") prod = "Chưa phân bổ";
  return (
    <Link className="orow" href={`/orders/${o.id}`}>
      <span className="c-code">{o.code}</span>
      <span className="c-status">
        <StatusBadge status={o.status} receiveType={o.receiveType} />
      </span>
      <span className="c-who">
        <b>{o.recipientName}</b>
        <br />
        <span className="muted small">
          {date}
          {time ? ` · ${time}` : ""}
          {o.receiveType === "PICKUP" ? " · Đến lấy" : ""}
        </span>
      </span>
      <span className="c-prod">{prod}</span>
      <span className="c-pay">
        {PAYMENT_STATE_LABELS[o.payState]}
        {o.owed > 0 && o.status !== "CANCELLED" ? (
          <>
            <br />
            Còn {formatMoney(o.owed)}
          </>
        ) : null}
      </span>
      <span className="c-total">{formatMoney(o.total)}</span>
    </Link>
  );
}

export function AllocBar({ ordered, fromStock, toMake, made, allocated }: { ordered: number; fromStock: number; toMake: number; made: number; allocated: boolean }) {
  if (!allocated) {
    return (
      <p className="small muted" style={{ marginTop: 8 }}>
        Chưa giữ hàng. Khi xác nhận, hệ thống tự lấy hàng có sẵn trước và tính phần cần làm.
      </p>
    );
  }
  const todo = Math.max(0, toMake - made);
  return (
    <div style={{ marginTop: 8 }}>
      <div className="alloc" role="img" aria-label={`Đặt ${ordered}: lấy từ kho ${fromStock}, đã làm ${made}, còn phải làm ${todo}`}>
        <i className="a-stock" style={{ flexGrow: fromStock }} />
        <i className="a-made" style={{ flexGrow: made }} />
        <i className="a-todo" style={{ flexGrow: todo }} />
      </div>
      <div className="legend">
        {fromStock ? (
          <span className="k lg-stock">
            Lấy từ kho <b>{fromStock}</b>
          </span>
        ) : null}
        {made ? (
          <span className="k lg-made">
            Đã làm <b>{made}</b>
          </span>
        ) : null}
        {todo ? (
          <span className="k lg-todo">
            Còn phải làm <b>{todo}</b>
          </span>
        ) : null}
        {!fromStock && !made && !todo ? <span>Không cần làm thêm</span> : null}
      </div>
    </div>
  );
}

export function Pager({ page, total, pageSize, hrefFor }: { page: number; total: number; pageSize: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="pager">{total} kết quả</p>;
  return (
    <nav className="pager" aria-label="Phân trang">
      <span>
        Trang {page}/{pages} · {total} kết quả
      </span>
      <span className="actions">
        {page > 1 ? (
          <Link className="btn btn-secondary btn-sm" href={hrefFor(page - 1)}>
            Trang trước
          </Link>
        ) : null}
        {page < pages ? (
          <Link className="btn btn-secondary btn-sm" href={hrefFor(page + 1)}>
            Trang sau
          </Link>
        ) : null}
      </span>
    </nav>
  );
}
