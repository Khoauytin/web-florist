/**
 * Calendar-day helpers fixed to Asia/Ho_Chi_Minh (UTC+7, no daylight saving).
 * A "Ymd" is a Vietnam calendar date written "YYYY-MM-DD". Safe on client and server.
 */
export type Ymd = string;

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isYmd(value: unknown): value is Ymd {
  if (typeof value !== "string" || !YMD_RE.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Vietnam calendar date of an instant. */
export function toVnYmd(instant: Date): Ymd {
  return new Date(instant.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

export function todayVn(now: Date = new Date()): Ymd {
  return toVnYmd(now);
}

export function addDays(ymd: Ymd, days: number): Ymd {
  return new Date(Date.parse(ymd + "T00:00:00Z") + days * DAY_MS).toISOString().slice(0, 10);
}

export function diffDays(from: Ymd, to: Ymd): number {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / DAY_MS);
}

/** Value for a Postgres DATE column (Prisma @db.Date). */
export function ymdToDbDate(ymd: Ymd): Date {
  return new Date(ymd + "T00:00:00.000Z");
}

export function dbDateToYmd(date: Date): Ymd {
  return date.toISOString().slice(0, 10);
}

/** First instant (UTC) of a Vietnam calendar day. */
export function vnDayStart(ymd: Ymd): Date {
  return new Date(Date.parse(ymd + "T00:00:00Z") - VN_OFFSET_MS);
}

/** Half-open UTC range [gte, lt) covering Vietnam days from..to inclusive, for timestamp columns. */
export function vnDayRange(from: Ymd, to: Ymd): { gte: Date; lt: Date } {
  return { gte: vnDayStart(from), lt: vnDayStart(addDays(to, 1)) };
}

export function startOfMonth(ymd: Ymd): Ymd {
  return ymd.slice(0, 8) + "01";
}

export function endOfMonth(ymd: Ymd): Ymd {
  const [y, m] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export type DatePreset = "today" | "tomorrow" | "next7" | "last7" | "thisMonth" | "lastMonth";

export const PRESET_LABELS: Record<DatePreset, string> = {
  today: "Hôm nay",
  tomorrow: "Ngày mai",
  next7: "7 ngày tới",
  last7: "7 ngày qua",
  thisMonth: "Tháng này",
  lastMonth: "Tháng trước",
};

export function presetRange(preset: DatePreset, today: Ymd = todayVn()): { from: Ymd; to: Ymd } {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "tomorrow":
      return { from: addDays(today, 1), to: addDays(today, 1) };
    case "next7":
      return { from: today, to: addDays(today, 6) };
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "thisMonth":
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case "lastMonth": {
      const prev = addDays(startOfMonth(today), -1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
  }
}

export function matchPreset(from: Ymd, to: Ymd, today: Ymd = todayVn()): DatePreset | null {
  for (const p of Object.keys(PRESET_LABELS) as DatePreset[]) {
    const r = presetRange(p, today);
    if (r.from === from && r.to === to) return p;
  }
  return null;
}

/** Longest range a list or export may span. */
export const MAX_RANGE_DAYS = 366;

/**
 * Reads ?from=&to= safely. Invalid values fall back to `fallback`; reversed ranges are swapped;
 * over-long ranges are cut to MAX_RANGE_DAYS from `from`.
 */
export function parseRange(
  from: string | string[] | undefined,
  to: string | string[] | undefined,
  fallback: { from: Ymd; to: Ymd } | null,
): { from: Ymd; to: Ymd } | null {
  const f = typeof from === "string" && isYmd(from) ? from : null;
  const t = typeof to === "string" && isYmd(to) ? to : null;
  if (!f && !t) return fallback;
  let a = f ?? t!;
  let b = t ?? f!;
  if (a > b) [a, b] = [b, a];
  if (diffDays(a, b) >= MAX_RANGE_DAYS) b = addDays(a, MAX_RANGE_DAYS - 1);
  return { from: a, to: b };
}

const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export function weekdayVi(ymd: Ymd): string {
  return WEEKDAYS[new Date(ymd + "T00:00:00Z").getUTCDay()];
}

/** "2026-10-26" -> "26/10/2026" */
export function formatYmd(ymd: Ymd): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-10-26" -> "26/10" */
export function formatYmdShort(ymd: Ymd): string {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

/** Instant -> "26/10/2026 08:30" in Vietnam time */
export function formatDateTime(instant: Date): string {
  const s = new Date(instant.getTime() + VN_OFFSET_MS).toISOString();
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} ${s.slice(11, 16)}`;
}

/** Human label for a range: "26/10/2026" or "01/10/2026 - 31/10/2026". */
export function formatRange(from: Ymd, to: Ymd): string {
  return from === to ? formatYmd(from) : `${formatYmd(from)} - ${formatYmd(to)}`;
}

/** Relative day name for the Today screen: "Hôm nay", "Ngày mai", "Hôm qua" or null. */
export function relativeDayLabel(ymd: Ymd, today: Ymd = todayVn()): string | null {
  const d = diffDays(today, ymd);
  if (d === 0) return "Hôm nay";
  if (d === 1) return "Ngày mai";
  if (d === -1) return "Hôm qua";
  return null;
}
