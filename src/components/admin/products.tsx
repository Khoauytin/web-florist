"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/admin/icon";
import { ErrorAlert, Switch, toast } from "@/components/admin/ui";
import { quickUpdateAction, setProductVisibleAction } from "@/server/actions/catalog.actions";
import { formatMoney } from "@/lib/format";

export interface ProductRow {
  id: string;
  code: string;
  name: string;
  price: number | null;
  isVisible: boolean;
  imageUrl: string | null;
}

function Pic({ url, alt, w, h }: { url: string | null; alt: string; w: number; h: number }) {
  if (!url)
    return (
      <span className="noimg" style={w === 0 ? undefined : { width: w, height: h }} aria-hidden="true">
        <Icon name="image" />
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} width={w || 300} height={h || 400} loading="lazy" />;
}

export function ProductGrid({ rows }: { rows: ProductRow[] }) {
  const router = useRouter();
  const [vis, setVis] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((r) => [r.id, r.isVisible])));
  const [, start] = useTransition();
  const toggle = (r: ProductRow, b: boolean) => {
    setVis((s) => ({ ...s, [r.id]: b }));
    start(async () => {
      const res = await setProductVisibleAction(r.id, b);
      if (!res.ok) {
        setVis((s) => ({ ...s, [r.id]: !b }));
        toast(res.error ?? "Không lưu được");
      } else toast(res.message ?? "Đã lưu");
      router.refresh();
    });
  };
  if (!rows.length) return <div className="card empty"><p className="muted">Không có mẫu nào khớp bộ lọc.</p></div>;
  return (
    <div className="pgrid">
      {rows.map((r) => (
        <div key={r.id} className={vis[r.id] ? "card pcard" : "card pcard hidden"}>
          <Link className="pcard-photo" href={`/admin/products/${r.id}`} aria-label={`Sửa ${r.name}`}>
            <Pic url={r.imageUrl} alt={r.name} w={0} h={0} />
          </Link>
          <div className="body">
            <span className="code">{r.code}</span>
            <Link className="nm" href={`/admin/products/${r.id}`}>
              {r.name}
            </Link>
            {r.price === null ? <span className="tag">Chưa có giá</span> : <span className="pr">{formatMoney(r.price)}</span>}
            <label className="vis">
              Hiện trên web
              <Switch checked={vis[r.id]} onChange={(b) => toggle(r, b)} label={`Hiện ${r.name} trên web`} />
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}

export function QuickEdit({ rows }: { rows: ProductRow[] }) {
  const router = useRouter();
  const [data, setData] = useState(() => rows.map((r) => ({ ...r, priceText: r.price === null ? "" : new Intl.NumberFormat("vi-VN").format(r.price) })));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Last saved values, so only edited rows are sent.
  const [base, setBase] = useState(() => new Map(data.map((r) => [r.id, `${r.name}|${r.priceText}|${r.isVisible}`])));
  const dirty = data.filter((r) => base.get(r.id) !== `${r.name}|${r.priceText}|${r.isVisible}`);
  const update = (id: string, patch: Partial<(typeof data)[number]>) => setData((d) => d.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const save = () =>
    start(async () => {
      setError(null);
      const payload = [];
      for (const r of dirty) {
        const digits = r.priceText.replace(/[^\d]/g, "");
        if (r.priceText.trim() && !digits) return setError(`Giá của ${r.code} không hợp lệ.`);
        payload.push({ id: r.id, name: r.name, price: digits ? Number(digits) : null, isVisible: r.isVisible });
      }
      const res = await quickUpdateAction(payload);
      if (!res.ok) return setError(res.error ?? "Không lưu được");
      setBase((b) => new Map([...b, ...dirty.map((r) => [r.id, `${r.name}|${r.priceText}|${r.isVisible}`] as const)]));
      toast(res.message ?? "Đã lưu");
      router.refresh();
    });
  if (!rows.length) return <div className="card empty"><p className="muted">Không có mẫu nào khớp bộ lọc.</p></div>;
  return (
    <div className="card pad">
      <ErrorAlert message={error} />
      <div className="qe">
        {data.map((r) => (
          <div key={r.id} className="qerow">
            <Pic url={r.imageUrl} alt="" w={48} h={60} />
            <div>
              <span className="code">{r.code}</span>
              <label className="sr" htmlFor={`qn-${r.id}`}>
                Tên {r.code}
              </label>
              <input className="input" id={`qn-${r.id}`} value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} maxLength={200} />
            </div>
            <div className="price">
              <label className="sr" htmlFor={`qp-${r.id}`}>
                Giá {r.code}
              </label>
              <input className="input" id={`qp-${r.id}`} inputMode="numeric" placeholder="Liên hệ" value={r.priceText} onChange={(e) => update(r.id, { priceText: e.target.value })} />
            </div>
            <Switch checked={r.isVisible} onChange={(b) => update(r.id, { isVisible: b })} label={`Hiện ${r.code} trên web`} />
          </div>
        ))}
      </div>
      <button className="btn btn-ink btn-block" type="button" style={{ marginTop: 12 }} onClick={save} disabled={pending || !dirty.length}>
        {pending ? "Đang lưu..." : dirty.length ? `Lưu ${dirty.length} thay đổi` : "Chưa có thay đổi"}
      </button>
    </div>
  );
}
