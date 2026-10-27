"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/admin/icon";

/** Month title that opens month/year selects (mockup: tap "Tháng 10, 2026"). */
export function MonthPicker({ d, view, today }: { d: string; view: string; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const y = +d.slice(0, 4);
  const m = +d.slice(5, 7);
  const go = (yy: number, mm: number) => router.push(`/admin/calendar?d=${yy}-${String(mm).padStart(2, "0")}-01&view=${view}`, { scroll: false });
  const years = [y - 1, y, y + 1];
  return (
    <div style={{ minWidth: 0 }}>
      <button className="title" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Tháng {m}, {y}
        <Icon name="down" className="icon-sm" />
      </button>
      {open ? (
        <div className="picker">
          <label className="sr" htmlFor="pm">
            Tháng
          </label>
          <select className="select" id="pm" value={m} onChange={(e) => go(y, +e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i + 1}>
                Tháng {i + 1}
              </option>
            ))}
          </select>
          <label className="sr" htmlFor="py">
            Năm
          </label>
          <select className="select" id="py" value={y} onChange={(e) => go(+e.target.value, m)}>
            {years.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <Link className="btn btn-light btn-sm" href={`/admin/calendar?d=${today}&view=${view}`} scroll={false} onClick={() => setOpen(false)}>
            Hôm nay
          </Link>
        </div>
      ) : null}
    </div>
  );
}
