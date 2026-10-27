import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getOrder } from "@/server/services/orders.service";
import { entityHistory } from "@/server/services/audit.service";
import { formatPhone } from "@/server/domain/phone";
import { AllocBar, StatusBadge } from "@/components/orders/order-bits";
import { OrderActions } from "@/components/orders/order-actions";
import { MadeStepper } from "@/components/orders/made-stepper";
import { PaymentPanel } from "@/components/orders/payment-panel";
import { Icon } from "@/components/icon";
import { dbDateToYmd, formatDateTime, formatYmd, weekdayVi } from "@/lib/dates";
import { formatMoney, timeWindow } from "@/lib/format";
import { CHANNEL_LABELS, PAYMENT_STATE_LABELS, PRODUCTION_LABELS, RECEIVE_TYPE_LABELS } from "@/lib/labels";

export const metadata = { title: "Chi tiết đơn" };

const FLOW = ["NEW", "CONFIRMED", "DELIVERING", "COMPLETED"] as const;

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const order = await getOrder(id, { includeCost: user.role === "owner" });
  if (!order) notFound();
  const history = await entityHistory("order", id);
  const owner = user.role === "owner";
  const allocated = order.status !== "NEW" && order.items.some((i) => i.allocatedAt);
  const canMake = order.status === "CONFIRMED" || order.status === "DELIVERY_FAILED";
  const idx = FLOW.indexOf(order.status as (typeof FLOW)[number]);
  const steps = ["Mới", "Đã xác nhận", order.receiveType === "PICKUP" ? "Sẵn sàng nhận" : "Đang giao", "Hoàn thành"];
  const deliveryYmd = order.deliveryDate ? dbDateToYmd(order.deliveryDate) : null;
  const madeItems = canMake || order.status === "DELIVERING"
    ? order.items
        .filter((i) => i.productId && i.qtyMade > 0)
        .map((i) => ({ id: i.id, name: i.nameSnapshot, qtyMade: i.qtyMade, restockable: i.product?.fulfillmentMode !== "MADE_TO_ORDER" }))
    : [];
  const ended = order.status === "COMPLETED" || order.status === "CANCELLED";

  return (
    <>
      <Link className="back" href="/orders">
        <Icon name="back" />
        Đơn hàng
      </Link>
      <div className="pagehead" style={{ marginTop: 4 }}>
        <div>
          <h1>{order.code}</h1>
          <p className="sub">
            {order.customer.name} · Kênh {CHANNEL_LABELS[order.channel]} · Tạo bởi {order.createdBy.name} lúc {formatDateTime(order.createdAt)}
          </p>
        </div>
        <StatusBadge status={order.status} receiveType={order.receiveType} />
      </div>

      <div className="twocol">
        <div>
          <div className="panel pad">
            {idx >= 0 ? (
              <ol className="steps" aria-label="Tiến trình đơn">
                {steps.map((s, k) => (
                  <li key={s} className={k < idx ? "done" : k === idx ? "now" : undefined} aria-current={k === idx ? "step" : undefined}>
                    {s}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="small">
                {order.status === "CANCELLED" ? (
                  <>
                    Đã hủy lúc {order.cancelledAt ? formatDateTime(order.cancelledAt) : ""}. Lý do: {order.cancelReason}
                  </>
                ) : (
                  <>Giao thất bại. Lý do: {order.failReason}. Hàng vẫn được giữ cho đơn.</>
                )}
              </p>
            )}
          </div>

          {!ended ? (
            <div style={{ marginTop: 16 }}>
              <OrderActions
                orderId={order.id}
                status={order.status}
                role={user.role}
                receiveType={order.receiveType}
                remaining={order.remaining}
                owed={order.owed}
                paid={order.paid}
                madeItems={madeItems}
              />
            </div>
          ) : null}

          <section className="section" aria-labelledby="h-lines">
            <div className="head">
              <h2 id="h-lines">Sản phẩm</h2>
              {order.production ? <span className="tag">{PRODUCTION_LABELS[order.production]}</span> : null}
            </div>
            <div className="panel divide">
              {order.items.map((it) => {
                const img = it.product?.images[0]?.url;
                return (
                  <div key={it.id} className="line">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="thumb" src={img} alt="" width={64} height={64} loading="lazy" />
                    ) : (
                      <div className="thumb thumb-free">{it.productId ? "Không có ảnh" : "Dòng tự do"}</div>
                    )}
                    <div>
                      <div className="top">
                        <div>
                          <div className="nm">{it.productId ? <Link href={`/products/${it.productId}`} style={{ color: "inherit" }}>{it.nameSnapshot}</Link> : it.nameSnapshot}</div>
                          <div className="meta">
                            {it.productCodeSnapshot ? `${it.productCodeSnapshot} · ` : ""}
                            {formatMoney(it.unitPriceSnapshot)} × {it.qtyOrdered}
                            {owner && it.unitCostSnapshot !== null ? ` · vốn ${formatMoney(it.unitCostSnapshot)}` : ""}
                          </div>
                          {it.note ? <div className="meta">{it.note}</div> : null}
                        </div>
                        <div className="nm">{formatMoney(it.unitPriceSnapshot * it.qtyOrdered)}</div>
                      </div>
                    </div>
                    <div className="work">
                      <AllocBar ordered={it.qtyOrdered} fromStock={it.qtyFromStock} toMake={it.qtyToMake} made={it.qtyMade} allocated={allocated && Boolean(it.allocatedAt)} />
                      {canMake && it.qtyToMake > 0 ? (
                        <div style={{ marginTop: 12 }}>
                          <MadeStepper orderId={order.id} itemId={it.id} made={it.qtyMade} toMake={it.qtyToMake} label={it.nameSnapshot} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="section" aria-labelledby="h-ship">
            <div className="head">
              <h2 id="h-ship">Giao nhận</h2>
              {!ended ? (
                <Link className="btn btn-ghost btn-sm" href={`/orders/${order.id}/edit`}>
                  <Icon name="edit" className="icon-sm" />
                  {order.status === "NEW" ? "Sửa đơn" : "Sửa giao nhận"}
                </Link>
              ) : null}
            </div>
            <dl className="panel kv">
              <dt>Người đặt</dt>
              <dd>
                <Link href={`/customers/${order.customer.id}`}>{order.customer.name}</Link> · {formatPhone(order.customer.phone)}
              </dd>
              <dt>Người nhận</dt>
              <dd>
                {order.recipientName} · <a href={`tel:${order.recipientPhone}`}>{formatPhone(order.recipientPhone)}</a>
              </dd>
              <dt>Hình thức</dt>
              <dd>{RECEIVE_TYPE_LABELS[order.receiveType]}</dd>
              {order.deliveryAddress ? (
                <>
                  <dt>Địa chỉ</dt>
                  <dd>{order.deliveryAddress}</dd>
                </>
              ) : null}
              <dt>Thời gian</dt>
              <dd>
                {deliveryYmd ? `${weekdayVi(deliveryYmd)}, ${formatYmd(deliveryYmd)}` : "Chưa hẹn ngày"}
                {timeWindow(order.deliveryTimeFrom, order.deliveryTimeTo) ? ` · ${timeWindow(order.deliveryTimeFrom, order.deliveryTimeTo)}` : ""}
              </dd>
              {order.courierName ? (
                <>
                  <dt>Người giao</dt>
                  <dd>{order.courierName}</dd>
                </>
              ) : null}
              {order.cardMessage ? (
                <>
                  <dt>Lời chúc</dt>
                  <dd>{order.cardMessage}</dd>
                </>
              ) : null}
              {order.note ? (
                <>
                  <dt>Ghi chú</dt>
                  <dd style={{ whiteSpace: "pre-wrap" }}>{order.note}</dd>
                </>
              ) : null}
            </dl>
          </section>
        </div>

        <aside>
          <section aria-labelledby="h-pay">
            <div className="section" style={{ marginTop: 0 }}>
              <div className="head">
                <h2 id="h-pay">Thanh toán</h2>
                <span className="tag">{PAYMENT_STATE_LABELS[order.payState]}</span>
              </div>
            </div>
            <div className="panel">
              <div className="money">
                <div>
                  <span className="muted">Tạm tính</span>
                  <span>{formatMoney(order.subtotal)}</span>
                </div>
                <div>
                  <span className="muted">Giảm giá</span>
                  <span>{order.discount ? `-${formatMoney(order.discount)}` : "0đ"}</span>
                </div>
                <div>
                  <span className="muted">Phí giao</span>
                  <span>{formatMoney(order.shippingFee)}</span>
                </div>
                <div className="total">
                  <span>Tổng tiền</span>
                  <span>{formatMoney(order.total)}</span>
                </div>
                <div>
                  <span className="muted">Đã thu</span>
                  <span className="ok">{formatMoney(order.paid)}</span>
                </div>
                <div>
                  <span className="muted">Còn lại</span>
                  <span className={order.owed > 0 && order.status !== "CANCELLED" ? "owe" : "ok"}>{formatMoney(order.status === "CANCELLED" ? 0 : order.owed)}</span>
                </div>
              </div>
              <PaymentPanel
                orderId={order.id}
                role={user.role}
                owed={order.owed}
                paid={order.paid}
                cancelled={order.status === "CANCELLED"}
                payments={order.payments.map((p) => ({
                  id: p.id,
                  type: p.type,
                  amount: p.amount,
                  method: p.method,
                  paidAt: formatDateTime(p.paidAt),
                  by: p.createdBy.name,
                  note: p.note,
                  voided: Boolean(p.voidedAt),
                  voidReason: p.voidReason,
                }))}
              />
            </div>
          </section>

          <section className="section" aria-labelledby="h-log">
            <div className="head">
              <h2 id="h-log">Lịch sử</h2>
            </div>
            <div className="panel">
              <ul className="timeline">
                {history.map((h) => (
                  <li key={h.id}>
                    <span>
                      {h.summary}
                      <br />
                      <span className="when">
                        {formatDateTime(h.createdAt)} · {h.actor.name}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
