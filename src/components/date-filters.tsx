"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import {
  PRESET_LABELS,
  addDays,
  formatYmd,
  matchPreset,
  presetRange,
  relativeDayLabel,
  weekdayVi,
  type DatePreset,
  type Ymd,
} from "@/lib/dates";

function useHref() {
  const pathname = usePathname();
  const params = useSearchParams();
  return (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
}

/** One day at a time: back, forward, today, or pick any date. Writes ?date=. */
export function DayPicker({ day, today }: { day: Ymd; today: Ymd }) {
  const href = useHref();
  const router = useRouter();
  const rel = relativeDayLabel(day, today);
  return (
    <div className="daypick">
      <Link className="icon-btn" href={href({ date: addDays(day, -1) })} aria-label="Ngày trước">
        <Icon name="back" />
      </Link>
      <label className="sr" htmlFor="day-input">
        Chọn ngày
      </label>
      <input
        id="day-input"
        className="input"
        type="date"
        value={day}
        onChange={(e) => e.target.value && router.push(href({ date: e.target.value === today ? null : e.target.value }))}
      />
      <Link className="icon-btn" href={href({ date: addDays(day, 1) })} aria-label="Ngày sau">
        <Icon name="next" />
      </Link>
      {day !== today ? (
        <Link className="btn btn-secondary btn-sm" href={href({ date: null })}>
          Về hôm nay
        </Link>
      ) : null}
      <span className="daylabel">
        {weekdayVi(day)}, {formatYmd(day)}
        {rel ? <span className="muted"> · {rel}</span> : null}
      </span>
    </div>
  );
}

type RangeFilterProps = {
  from: Ymd | null;
  to: Ymd | null;
  today: Ymd;
  presets: DatePreset[];
  allowAll?: boolean;
  allLabel?: string;
  label?: string;
};

/**
 * Date range with quick presets and a custom from/to. Writes ?from=&to= (and keeps other params).
 * `allowAll` adds an "all time" chip that clears the range. Re-mounts when the URL range changes
 * so the custom inputs never show a stale range after navigation.
 */
export function RangeFilter(props: RangeFilterProps) {
  return <RangeFilterInner key={`${props.from}|${props.to}`} {...props} />;
}

function RangeFilterInner({
  from,
  to,
  today,
  presets,
  allowAll = false,
  allLabel = "Tất cả",
  label = "Khoảng ngày",
}: RangeFilterProps) {
  const href = useHref();
  const router = useRouter();
  const active = from && to ? matchPreset(from, to, today) : null;
  const [open, setOpen] = useState(Boolean(from && to && !active));
  const [f, setF] = useState(from ?? today);
  const [t, setT] = useState(to ?? today);
  return (
    <div className="datebar">
      <div className="chips" role="group" aria-label={label}>
        {allowAll ? (
          <Link className="chip" href={href({ from: null, to: null })} aria-current={!from ? "true" : undefined}>
            {allLabel}
          </Link>
        ) : null}
        {presets.map((p) => {
          const r = presetRange(p, today);
          return (
            <Link key={p} className="chip" href={href({ from: r.from, to: r.to })} aria-current={active === p ? "true" : undefined}>
              {PRESET_LABELS[p]}
            </Link>
          );
        })}
        <button className="chip" type="button" aria-expanded={open} aria-pressed={Boolean(from && !active)} onClick={() => setOpen((o) => !o)}>
          {from && to && !active ? `${formatYmd(from)} - ${formatYmd(to)}` : "Chọn ngày"}
        </button>
      </div>
      {open ? (
        <form
          className="range-inputs"
          onSubmit={(e) => {
            e.preventDefault();
            const [a, b] = f <= t ? [f, t] : [t, f];
            router.push(href({ from: a, to: b }));
          }}
        >
          <div className="field">
            <label htmlFor="range-from">Từ ngày</label>
            <input id="range-from" className="input" type="date" value={f} onChange={(e) => setF(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="range-to">Đến ngày</label>
            <input id="range-to" className="input" type="date" value={t} onChange={(e) => setT(e.target.value)} required />
          </div>
          <button className="btn btn-secondary" type="submit">
            Áp dụng
          </button>
        </form>
      ) : null}
    </div>
  );
}

/** Segmented links that set one query param (e.g. by=delivery|created). */
export function ParamSegment({ name, value, options, label }: { name: string; value: string; options: { value: string; label: string }[]; label: string }) {
  const href = useHref();
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o, i) => (
        <Link key={o.value} href={href({ [name]: i === 0 ? null : o.value })} aria-current={value === o.value ? "true" : undefined}>
          {o.label}
        </Link>
      ))}
    </div>
  );
}

type SearchBoxProps = { name?: string; value: string; placeholder: string; label: string };

/** Search box that keeps the other filters; re-mounts when the URL value changes. */
export function SearchBox(props: SearchBoxProps) {
  return <SearchBoxInner key={props.value} {...props} />;
}

function SearchBoxInner({ name = "q", value, placeholder, label }: SearchBoxProps) {
  const href = useHref();
  const router = useRouter();
  const [q, setQ] = useState(value);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(href({ [name]: q.trim() || null }));
      }}
    >
      <label className="sr" htmlFor={`search-${name}`}>
        {label}
      </label>
      <div className="input-wrap">
        <Icon name="search" />
        <input id={`search-${name}`} className="input" type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} enterKeyHint="search" />
      </div>
    </form>
  );
}
