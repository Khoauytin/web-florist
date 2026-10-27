"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { PRESET_LABELS, presetRange, type DatePreset, type Ymd } from "@/lib/dates";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatusKey } from "@/lib/labels";

const PRESETS: DatePreset[] = ["today", "last7", "thisMonth", "lastMonth"];

export function ExportForm({
  today,
  categories,
  customers,
  products,
}: {
  today: Ymd;
  categories: { id: string; name: string }[];
  customers: { id: string; name: string; phone: string }[];
  products: { id: string; code: string; name: string }[];
}) {
  const month = presetRange("thisMonth", today);
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(month.to);
  const [statuses, setStatuses] = useState<OrderStatusKey[]>([]);
  const toggle = (s: OrderStatusKey) => setStatuses((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  return (
    <form action="/api/exports" method="get" className="stack-lg" style={{ maxWidth: 760 }}>
      <section className="stack" aria-labelledby="ex-time">
        <h2 id="ex-time">Thời gian</h2>
        <div className="chips" role="group" aria-label="Chọn nhanh">
          {PRESETS.map((p) => {
            const r = presetRange(p, today);
            const on = r.from === from && r.to === to;
            return (
              <button key={p} type="button" className="chip" aria-pressed={on} onClick={() => { setFrom(r.from); setTo(r.to); }}>
                {PRESET_LABELS[p]}
              </button>
            );
          })}
        </div>
        <div className="row2">
          <div className="field">
            <label htmlFor="ex-from">Từ ngày</label>
            <input id="ex-from" name="from" className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="ex-to">Đến ngày</label>
            <input id="ex-to" name="to" className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} required />
          </div>
        </div>
        <div className="field">
          <span className="label" id="ex-by">Tính theo</span>
          <div className="seg" role="radiogroup" aria-labelledby="ex-by">
            <label>
              <input type="radio" name="by" value="delivery" defaultChecked />
              Ngày giao
            </label>
            <label>
              <input type="radio" name="by" value="created" />
              Ngày tạo đơn
            </label>
          </div>
        </div>
      </section>

      <section className="stack" aria-labelledby="ex-filter">
        <h2 id="ex-filter">Bộ lọc</h2>
        <div className="field">
          <span className="label" id="ex-status">Trạng thái đơn</span>
          <div className="chips" style={{ margin: 0, paddingInline: 2 }} role="group" aria-labelledby="ex-status">
            {ORDER_STATUSES.map((s) => (
              <button key={s} type="button" className="chip" aria-pressed={statuses.includes(s)} onClick={() => toggle(s)}>
                {ORDER_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          {statuses.map((s) => (
            <input key={s} type="hidden" name="status" value={s} />
          ))}
          <span className="hint">Không chọn gì là lấy mọi trạng thái. Doanh thu trong sheet Tổng hợp chỉ tính đơn Hoàn thành.</span>
        </div>
        <div className="row2">
          <div className="field">
            <label htmlFor="ex-cat">Danh mục</label>
            <select id="ex-cat" name="category" className="select" defaultValue="">
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ex-product">Sản phẩm</label>
            <select id="ex-product" name="product" className="select" defaultValue="">
              <option value="">Tất cả sản phẩm</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="ex-customer">Khách hàng</label>
          <select id="ex-customer" name="customer" className="select" defaultValue="">
            <option value="">Tất cả khách</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.phone}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="panel pad">
        <h2 style={{ marginBottom: 8 }}>File sẽ gồm</h2>
        <ul className="small" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
          <li>Tổng hợp: số đơn, doanh thu, đã thu, còn phải thu, số đơn theo trạng thái</li>
          <li>Danh sách đơn hàng</li>
          <li>Chi tiết sản phẩm trong từng đơn</li>
          <li>Khách hàng có đơn trong kỳ</li>
          <li>Sản phẩm và tồn kho hiện tại</li>
        </ul>
      </div>
      <div>
        <button className="btn btn-primary" type="submit">
          <Icon name="download" />
          Xuất Excel
        </button>
      </div>
    </form>
  );
}
