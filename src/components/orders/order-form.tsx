"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { ErrorAlert, MoneyInput, toast } from "@/components/ui";
import {
  createOrderAction,
  findCustomerAction,
  searchProductsAction,
  updateLogisticsAction,
  updateOrderAction,
  type OrderPayload,
} from "@/server/actions/orders.actions";
import { formatMoney } from "@/lib/format";
import { CHANNEL_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/labels";
import type { FormLine, OrderFormInitial, ProductOption } from "@/components/orders/order-form-model";

type Channel = keyof typeof CHANNEL_LABELS;
type Method = keyof typeof PAYMENT_METHOD_LABELS;

let keySeq = 0;
const newKey = () => `l${++keySeq}`;

/** Preview of what confirmation will do, per line (mirrors server allocate()). */
function previewAllocation(lines: FormLine[]) {
  const left = new Map<string, number>();
  return lines.map((l) => {
    if (!l.product) return { fromStock: 0, toMake: l.qty, short: false };
    const p = l.product;
    const avail = left.get(p.id) ?? Math.max(0, p.available);
    if (p.mode === "MADE_TO_ORDER") return { fromStock: 0, toMake: l.qty, short: false };
    const fromStock = Math.min(l.qty, avail);
    left.set(p.id, avail - fromStock);
    if (p.mode === "STOCK_ONLY") return { fromStock, toMake: 0, short: fromStock < l.qty };
    return { fromStock, toMake: l.qty - fromStock, short: false };
  });
}

export function OrderForm({
  variant,
  initial,
  orderId,
  role,
  code,
}: {
  variant: "create" | "edit" | "logistics";
  initial: OrderFormInitial;
  orderId?: string;
  role: "owner" | "staff";
  code?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState<number | null>(null);
  const [depositMethod, setDepositMethod] = useState<Method>("BANK_TRANSFER");
  const [lookup, setLookup] = useState<"idle" | "found" | "new">(initial.customerId ? "found" : "idle");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductOption[]>([]);
  const searchSeq = useRef(0);
  const set = <K extends keyof OrderFormInitial>(k: K, val: OrderFormInitial[K]) => setV((s) => ({ ...s, [k]: val }));
  const lockLines = variant === "logistics";
  const moneyLocked = variant === "logistics" && role !== "owner";

  useEffect(() => {
    if (lockLines) return;
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      const rows = await searchProductsAction(q);
      if (seq === searchSeq.current) setResults(rows);
    }, 200);
    return () => clearTimeout(t);
  }, [q, lockLines]);

  const subtotal = v.lines.reduce((s, l) => s + (l.unitPrice ?? 0) * l.qty, 0);
  const total = Math.max(0, subtotal - v.discount) + v.shippingFee;
  const preview = useMemo(() => previewAllocation(v.lines), [v.lines]);

  const lookupCustomer = async () => {
    if (variant === "logistics" || v.customerPhone.replace(/\D/g, "").length < 9) return;
    const c = await findCustomerAction(v.customerPhone);
    if (c) {
      setV((s) => ({ ...s, customerId: c.id, customerName: c.name, customerAddress: c.address ?? "", deliveryAddress: s.deliveryAddress || c.address || "" }));
      setLookup("found");
    } else {
      setV((s) => ({ ...s, customerId: null }));
      setLookup("new");
    }
  };

  const addProduct = (p: ProductOption) => {
    if (p.price === null) return;
    setV((s) => ({ ...s, lines: [...s.lines, { key: newKey(), product: p, name: p.name, unitPrice: p.price, qty: 1, note: "" }] }));
    setQ("");
  };
  const addFree = () => setV((s) => ({ ...s, lines: [...s.lines, { key: newKey(), product: null, name: "", unitPrice: null, qty: 1, note: "" }] }));
  const updateLine = (key: string, patch: Partial<FormLine>) => setV((s) => ({ ...s, lines: s.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  const removeLine = (key: string) => setV((s) => ({ ...s, lines: s.lines.filter((l) => l.key !== key) }));

  const submit = () =>
    start(async () => {
      setError(null);
      // The logistics form always shows the recipient fields, so it always sends them.
      const same = variant !== "logistics" && v.sameRecipient;
      const logistics = {
        recipientName: same ? v.customerName : v.recipientName,
        recipientPhone: same ? v.customerPhone : v.recipientPhone,
        receiveType: v.receiveType,
        deliveryAddress: v.deliveryAddress,
        deliveryDate: v.deliveryDate || null,
        deliveryTimeFrom: v.deliveryTimeFrom || null,
        deliveryTimeTo: v.deliveryTimeTo || null,
        courierName: v.courierName,
        cardMessage: v.cardMessage,
        note: v.note,
      };
      let r;
      if (variant === "logistics") {
        r = await updateLogisticsAction(orderId!, { ...logistics, ...(role === "owner" ? { discount: v.discount, shippingFee: v.shippingFee } : {}) });
      } else {
        if (v.lines.some((l) => !l.product && (!l.name.trim() || l.unitPrice === null))) {
          setError("Dòng tự do cần có tên và đơn giá.");
          return;
        }
        const payload: OrderPayload = {
          ...logistics,
          customerId: v.customerId,
          customerName: v.customerName,
          customerPhone: v.customerPhone,
          customerAddress: v.customerAddress || v.deliveryAddress,
          channel: v.channel,
          discount: v.discount,
          shippingFee: v.shippingFee,
          deposit: variant === "create" && depositAmount ? { amount: depositAmount, method: depositMethod } : null,
          items: v.lines.map((l) => ({
            id: l.id ?? null,
            productId: l.product?.id ?? null,
            name: l.product ? undefined : l.name,
            unitPrice: l.product ? undefined : (l.unitPrice ?? 0),
            qty: l.qty,
            note: l.note || undefined,
          })),
        };
        r = variant === "create" ? await createOrderAction(payload) : await updateOrderAction(orderId!, payload);
      }
      if (r.ok) {
        toast(r.message ?? "Đã lưu");
        router.push(`/orders/${r.id ?? orderId}`);
        router.refresh();
      } else {
        setError(r.error ?? "Có lỗi xảy ra");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Link className="back" href={orderId ? `/orders/${orderId}` : "/orders"}>
        <Icon name="back" />
        Hủy
      </Link>
      <div className="pagehead" style={{ marginTop: 4 }}>
        <div>
          <h1>{variant === "create" ? "Tạo đơn mới" : variant === "edit" ? `Sửa đơn ${code}` : `Sửa giao nhận ${code}`}</h1>
          <p className="sub">
            {variant === "create"
              ? "Mã đơn sẽ được cấp khi lưu. Tồn kho chỉ bị giữ khi xác nhận đơn."
              : variant === "logistics"
                ? "Đơn đã xác nhận: chỉ sửa được thông tin giao nhận. Muốn đổi sản phẩm, chủ shop cần hủy xác nhận trước."
                : "Đơn chưa xác nhận nên sửa được toàn bộ."}
          </p>
        </div>
      </div>

      <div className="stack-lg" style={{ maxWidth: 760 }}>
        <ErrorAlert message={error} />

        {variant !== "logistics" ? (
          <section aria-labelledby="f-customer" className="stack">
            <h2 id="f-customer">Khách hàng</h2>
            <div className="field">
              <label htmlFor="customerPhone">
                Số điện thoại<span className="req" aria-hidden="true">*</span>
              </label>
              <div className="input-wrap">
                <Icon name="search" />
                <input
                  id="customerPhone"
                  className="input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={v.customerPhone}
                  onChange={(e) => {
                    set("customerPhone", e.target.value);
                    if (lookup !== "idle") {
                      setLookup("idle");
                      set("customerId", null);
                    }
                  }}
                  onBlur={lookupCustomer}
                  required
                  aria-describedby="phone-hint"
                />
              </div>
              <span className="hint" id="phone-hint">
                Nhập số điện thoại để tìm khách cũ. Khách mới sẽ được tạo khi lưu đơn.
              </span>
            </div>
            {lookup === "found" ? (
              <div className="found" role="status">
                <div>
                  <b>{v.customerName}</b>
                  <div className="small muted">Khách cũ{v.customerAddress ? ` · ${v.customerAddress}` : ""}</div>
                </div>
                <Link className="btn btn-ghost btn-sm" href={`/customers/${v.customerId}`} target="_blank">
                  Xem khách
                </Link>
              </div>
            ) : (
              <div className="row2">
                <div className="field">
                  <label htmlFor="customerName">
                    Tên khách<span className="req" aria-hidden="true">*</span>
                  </label>
                  <input id="customerName" className="input" value={v.customerName} onChange={(e) => set("customerName", e.target.value)} required maxLength={120} />
                </div>
                <div className="field">
                  <label htmlFor="channel">Kênh đặt</label>
                  <select id="channel" className="select" value={v.channel} onChange={(e) => set("channel", e.target.value as Channel)}>
                    {(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => (
                      <option key={c} value={c}>
                        {CHANNEL_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {lookup === "found" ? (
              <div className="field" style={{ maxWidth: 360 }}>
                <label htmlFor="channel">Kênh đặt</label>
                <select id="channel" className="select" value={v.channel} onChange={(e) => set("channel", e.target.value as Channel)}>
                  {(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => (
                    <option key={c} value={c}>
                      {CHANNEL_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </section>
        ) : null}

        <section aria-labelledby="f-ship" className="stack">
          <h2 id="f-ship">Giao nhận</h2>
          <div className="seg" role="radiogroup" aria-label="Hình thức nhận">
            <label>
              <input type="radio" name="receiveType" checked={v.receiveType === "DELIVERY"} onChange={() => set("receiveType", "DELIVERY")} />
              Giao tận nơi
            </label>
            <label>
              <input type="radio" name="receiveType" checked={v.receiveType === "PICKUP"} onChange={() => set("receiveType", "PICKUP")} />
              Đến lấy
            </label>
          </div>
          {variant !== "logistics" ? (
            <label className="checkbox">
              <input type="checkbox" checked={v.sameRecipient} onChange={(e) => set("sameRecipient", e.target.checked)} />
              Người nhận là người đặt
            </label>
          ) : null}
          {!v.sameRecipient || variant === "logistics" ? (
            <div className="row2">
              <div className="field">
                <label htmlFor="recipientName">
                  Người nhận<span className="req" aria-hidden="true">*</span>
                </label>
                <input id="recipientName" className="input" value={v.recipientName} onChange={(e) => set("recipientName", e.target.value)} maxLength={120} required />
              </div>
              <div className="field">
                <label htmlFor="recipientPhone">
                  Số điện thoại người nhận<span className="req" aria-hidden="true">*</span>
                </label>
                <input id="recipientPhone" className="input" type="tel" inputMode="tel" value={v.recipientPhone} onChange={(e) => set("recipientPhone", e.target.value)} required />
              </div>
            </div>
          ) : null}
          {v.receiveType === "DELIVERY" ? (
            <div className="field">
              <label htmlFor="deliveryAddress">Địa chỉ giao</label>
              <input id="deliveryAddress" className="input" value={v.deliveryAddress} onChange={(e) => set("deliveryAddress", e.target.value)} maxLength={300} autoComplete="street-address" />
            </div>
          ) : null}
          <div className="row3">
            <div className="field">
              <label htmlFor="deliveryDate">{v.receiveType === "PICKUP" ? "Ngày nhận" : "Ngày giao"}</label>
              <input id="deliveryDate" className="input" type="date" value={v.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="deliveryTimeFrom">Từ giờ</label>
              <input id="deliveryTimeFrom" className="input" type="time" step={900} value={v.deliveryTimeFrom} onChange={(e) => set("deliveryTimeFrom", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="deliveryTimeTo">Đến giờ</label>
              <input id="deliveryTimeTo" className="input" type="time" step={900} value={v.deliveryTimeTo} onChange={(e) => set("deliveryTimeTo", e.target.value)} />
            </div>
          </div>
          {v.receiveType === "DELIVERY" ? (
            <div className="field" style={{ maxWidth: 360 }}>
              <label htmlFor="courierName">Người giao</label>
              <input id="courierName" className="input" value={v.courierName} onChange={(e) => set("courierName", e.target.value)} maxLength={120} />
            </div>
          ) : null}
          <p className="small muted">Cần có ngày giao (và địa chỉ nếu giao tận nơi) trước khi xác nhận đơn.</p>
        </section>

        {!lockLines ? (
          <section aria-labelledby="f-items" className="stack">
            <h2 id="f-items">Sản phẩm</h2>
            <div className="field">
              <label className="sr" htmlFor="product-search">
                Thêm sản phẩm
              </label>
              <div className="input-wrap">
                <Icon name="search" />
                <input
                  id="product-search"
                  className="input"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Tìm sản phẩm theo tên hoặc mã"
                  autoComplete="off"
                  aria-controls="product-results"
                />
              </div>
              {q || v.lines.length === 0 ? (
                <div className="panel suggest" id="product-results" role="listbox" aria-label="Kết quả tìm sản phẩm">
                  {results.length ? (
                    results.map((p) => (
                      <button key={p.id} type="button" role="option" aria-selected={false} onClick={() => addProduct(p)} disabled={p.price === null}>
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" width={48} height={48} loading="lazy" />
                        ) : (
                          <span className="noimg">
                            <Icon name="image" />
                          </span>
                        )}
                        <span>
                          <b>{p.name}</b>
                          <br />
                          <span className="small muted">
                            {p.code} · {p.mode === "MADE_TO_ORDER" ? "Làm theo đơn" : `Sẵn sàng bán ${p.available}`}
                          </span>
                        </span>
                        <span className={p.price === null ? "tag tag-warn" : "small"}>{p.price === null ? "Chưa có giá" : formatMoney(p.price)}</span>
                      </button>
                    ))
                  ) : (
                    <p className="pad small muted">Không tìm thấy sản phẩm đang bán.</p>
                  )}
                </div>
              ) : null}
            </div>

            {v.lines.length ? (
              <div className="panel divide">
                {v.lines.map((l, i) => {
                  const pv = preview[i];
                  return (
                    <div key={l.key} className="line">
                      {l.product?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="thumb" src={l.product.imageUrl} alt="" width={64} height={64} />
                      ) : (
                        <div className="thumb thumb-free">{l.product ? "Không có ảnh" : "Dòng tự do"}</div>
                      )}
                      <div className="stack" style={{ gap: 8 }}>
                        {l.product ? (
                          <div className="top">
                            <div>
                              <div className="nm">{l.product.name}</div>
                              <div className="meta">
                                {l.product.code} · {formatMoney(l.unitPrice)}
                              </div>
                            </div>
                            <div className="nm">{formatMoney((l.unitPrice ?? 0) * l.qty)}</div>
                          </div>
                        ) : (
                          <div className="row2">
                            <div className="field">
                              <label htmlFor={`name-${l.key}`}>Tên dòng tự do</label>
                              <input id={`name-${l.key}`} className="input" value={l.name} onChange={(e) => updateLine(l.key, { name: e.target.value })} placeholder="Ví dụ: bó theo mẫu khách gửi" maxLength={200} />
                            </div>
                            <div className="field">
                              <label htmlFor={`price-${l.key}`}>Đơn giá (đ)</label>
                              <MoneyInput id={`price-${l.key}`} value={l.unitPrice} onChange={(n) => updateLine(l.key, { unitPrice: n })} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="work">
                        <div className="actions">
                          <div className="qty" role="group" aria-label={`Số lượng ${l.name || "dòng tự do"}`}>
                            <button type="button" aria-label="Giảm" onClick={() => updateLine(l.key, { qty: Math.max(1, l.qty - 1) })} disabled={l.qty <= 1}>
                              <Icon name="minus" />
                            </button>
                            <input
                              aria-label="Số lượng"
                              inputMode="numeric"
                              value={l.qty}
                              onChange={(e) => {
                                const n = Number(e.target.value.replace(/\D/g, ""));
                                updateLine(l.key, { qty: Math.min(10000, Math.max(1, n || 1)) });
                              }}
                            />
                            <button type="button" aria-label="Tăng" onClick={() => updateLine(l.key, { qty: Math.min(10000, l.qty + 1) })}>
                              <Icon name="plus" />
                            </button>
                          </div>
                          <button className="btn btn-ghost" type="button" onClick={() => removeLine(l.key)}>
                            Xóa
                          </button>
                        </div>
                        <p className={pv.short ? "small" : "small muted"} style={{ marginTop: 8, color: pv.short ? "var(--danger)" : undefined }}>
                          {!l.product
                            ? "Dòng tự do: luôn làm theo đơn, không dùng tồn kho."
                            : pv.short
                              ? `Sản phẩm "Có sẵn" chỉ còn ${pv.fromStock}. Đơn sẽ không xác nhận được nếu thiếu hàng.`
                              : `Dự kiến khi xác nhận: ${pv.fromStock ? `lấy ${pv.fromStock} từ kho` : "không có hàng sẵn"}${pv.toMake ? `, làm thêm ${pv.toMake}` : ""}.`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div>
              <button className="btn btn-secondary" type="button" onClick={addFree}>
                <Icon name="plus" />
                Thêm dòng tự do
              </button>
            </div>
          </section>
        ) : null}

        <section aria-labelledby="f-money" className="stack">
          <h2 id="f-money">Thanh toán và ghi chú</h2>
          <div className="row2">
            <div className="field">
              <label htmlFor="discount">Giảm giá (đ)</label>
              {moneyLocked ? (
                <input id="discount" className="input" value={formatMoney(v.discount)} disabled />
              ) : (
                <MoneyInput id="discount" value={v.discount} onChange={(n) => set("discount", n ?? 0)} />
              )}
            </div>
            <div className="field">
              <label htmlFor="shippingFee">Phí giao (đ)</label>
              {moneyLocked ? (
                <input id="shippingFee" className="input" value={formatMoney(v.shippingFee)} disabled />
              ) : (
                <MoneyInput id="shippingFee" value={v.shippingFee} onChange={(n) => set("shippingFee", n ?? 0)} />
              )}
            </div>
          </div>
          {moneyLocked ? <p className="small muted">Chỉ chủ shop được sửa giảm giá và phí giao của đơn đã xác nhận.</p> : null}
          {variant === "create" ? (
            <div className="row2">
              <div className="field">
                <label htmlFor="deposit">Tiền cọc (đ)</label>
                <MoneyInput id="deposit" value={depositAmount} onChange={setDepositAmount} describedBy="deposit-hint" placeholder="0" />
                <span className="hint" id="deposit-hint">
                  Ghi thêm các lần thanh toán sau trong chi tiết đơn.
                </span>
              </div>
              <div className="field">
                <label htmlFor="depositMethod">Hình thức cọc</label>
                <select id="depositMethod" className="select" value={depositMethod} onChange={(e) => setDepositMethod(e.target.value as Method)}>
                  {(Object.keys(PAYMENT_METHOD_LABELS) as Method[]).map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="cardMessage">Lời chúc trên thiệp</label>
            <input id="cardMessage" className="input" value={v.cardMessage} onChange={(e) => set("cardMessage", e.target.value)} maxLength={500} placeholder="Không bắt buộc" />
          </div>
          <div className="field">
            <label htmlFor="note">Ghi chú nội bộ</label>
            <textarea id="note" className="textarea" value={v.note} onChange={(e) => set("note", e.target.value)} maxLength={2000} />
          </div>
        </section>
      </div>

      <div className="stickybar">
        <div>
          <div className="t">{lockLines ? "Tổng tiền (theo sản phẩm đã chốt)" : `Tổng tiền · ${v.lines.length} dòng`}</div>
          <div className="v">{lockLines ? formatMoney(Math.max(0, initialSubtotal(initial) - v.discount) + v.shippingFee) : formatMoney(total)}</div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={pending || (!lockLines && v.lines.length === 0)}>
          {pending ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Đang lưu...
            </>
          ) : variant === "create" ? (
            "Lưu đơn"
          ) : (
            "Lưu thay đổi"
          )}
        </button>
      </div>
    </form>
  );
}

function initialSubtotal(initial: OrderFormInitial) {
  return initial.lines.reduce((s, l) => s + (l.unitPrice ?? 0) * l.qty, 0);
}
