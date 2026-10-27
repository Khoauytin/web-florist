import Link from "next/link";
import { calendarMarks, ordersInRange, todoSummary } from "@/server/services/orders.service";
import { Icon } from "@/components/admin/icon";
import { TaskRow, Thumb } from "@/components/admin/orders";
import { MonthPicker } from "@/components/admin/month-picker";
import { addDays, endOfMonth, formatYmd, formatYmdShort, isYmd, startOfMonth, todayVn, weekdayVi, type Ymd } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { ORDER_STATUS_LABELS, type OrderStatusKey } from "@/lib/labels";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Lịch" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const WDS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DOT: Record<OrderStatusKey, string> = { NEW: "d-NEW", DELIVERING: "d-DELIVERING", COMPLETED: "d-DONE", CANCELLED: "d-CANCEL" };
const dowIdx = (d: Ymd) => (new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7;
const weekStart = (d: Ymd) => addDays(d, -dowIdx(d));
const shiftMonth = (d: Ymd, n: number) => {
  const [y, m] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
};

export default async function CalendarPage({ searchParams }: { searchParams: SP }) {
  await requireUser();
  const sp = await searchParams;
  const today = todayVn();
  const d = typeof sp.d === "string" && isYmd(sp.d) ? sp.d : today;
  const view = sp.view === "week" ? "week" : "month";
  const scope = sp.scope === "day" || sp.scope === "week" || sp.scope === "month" ? sp.scope : view;
  const url = (p: { d?: Ymd; view?: string; scope?: string }) => {
    const q = new URLSearchParams({ d: p.d ?? d, view: p.view ?? view, scope: p.scope ?? (p.view ?? scope) });
    return `/admin/calendar?${q}`;
  };

  const [gridFrom, gridTo] =
    view === "month" ? [weekStart(startOfMonth(d)), addDays(weekStart(endOfMonth(d)), 6)] : [weekStart(d), addDays(weekStart(d), 6)];
  const [sumFrom, sumTo, sumLabel] =
    scope === "day"
      ? [d, d, formatYmd(d)]
      : scope === "week"
        ? [weekStart(d), addDays(weekStart(d), 6), `${formatYmdShort(weekStart(d))} - ${formatYmdShort(addDays(weekStart(d), 6))}`]
        : [startOfMonth(d), endOfMonth(d), `Tháng ${+d.slice(5, 7)}/${d.slice(0, 4)}`];
  const [marks, dayList, sum] = await Promise.all([calendarMarks(gridFrom, gridTo), ordersInRange(d, d), todoSummary(sumFrom, sumTo)]);

  const days: Ymd[] = [];
  for (let x = gridFrom; x <= gridTo; x = addDays(x, 1)) days.push(x);
  const prev = view === "month" ? shiftMonth(d, -1) : addDays(d, -7);
  const next = view === "month" ? shiftMonth(d, 1) : addDays(d, 7);

  const dayCell = (x: Ymd) => {
    const m = marks[x];
    const label = `${weekdayVi(x)} ${formatYmd(x)}${m ? `, ${m.count} đơn` : ""}`;
    const cls = ["day", x === today ? "today" : "", view === "month" && x.slice(0, 7) !== d.slice(0, 7) ? "out" : ""].join(" ");
    return (
      <Link key={x} className={cls} href={url({ d: x })} aria-pressed={x === d} aria-label={label} scroll={false}>
        {view === "week" ? <span className="w">{WDS[dowIdx(x)]}</span> : null}
        <span className="n">{+x.slice(8)}</span>
        {m ? (
          <span className="dots" aria-hidden="true">
            {m.statuses.map((s, index) => (
              <i key={`${s}-${index}`} className={DOT[s]} />
            ))}
          </span>
        ) : view === "week" ? (
          <span className="dots" aria-hidden="true" />
        ) : null}
      </Link>
    );
  };

  return (
    <>
      <div className="card pad">
        <div className="calhead">
          <MonthPicker d={d} view={view} today={today} />
          <div className="navarrows">
            <Link className="icon-btn" href={url({ d: prev })} aria-label={view === "month" ? "Tháng trước" : "Tuần trước"} scroll={false}>
              <Icon name="back" />
            </Link>
            <Link className="icon-btn" href={url({ d: next })} aria-label={view === "month" ? "Tháng sau" : "Tuần sau"} scroll={false}>
              <Icon name="next" />
            </Link>
          </div>
        </div>
        <div className="seg" role="group" aria-label="Kiểu xem" style={{ marginBottom: 12 }}>
          <Link href={url({ view: "month", scope: "month" })} aria-pressed={view === "month"} role="button" scroll={false} className="segbtn">
            Tháng
          </Link>
          <Link href={url({ view: "week", scope: "week" })} aria-pressed={view === "week"} role="button" scroll={false} className="segbtn">
            Tuần
          </Link>
        </div>
        {view === "month" ? (
          <div className="month">
            {WDS.map((w) => (
              <span key={w} className="dow">
                {w}
              </span>
            ))}
            {days.map(dayCell)}
          </div>
        ) : (
          <div className="week">{days.map(dayCell)}</div>
        )}
        <div className="legend">
          {(Object.keys(DOT) as OrderStatusKey[]).map((s) => (
            <span key={s}>
              <i className={DOT[s]} />
              {ORDER_STATUS_LABELS[s]}
            </span>
          ))}
        </div>
      </div>

      <section className="section" aria-labelledby="h-day">
        <div className="shead">
          <h2 id="h-day">{d === today ? "Đơn hôm nay" : `Đơn ngày ${formatYmdShort(d)}`}</h2>
          <Link className="btn btn-accent" href={`/admin/orders/new?date=${d}`} aria-label={`Tạo đơn giao ngày ${formatYmdShort(d)}`}>
            <Icon name="plus" />
          </Link>
        </div>
        <div className="card pad">
          {dayList.length ? (
            <div className="tasks">
              {dayList.map((o) => (
                <TaskRow key={o.id} o={o} />
              ))}
            </div>
          ) : (
            <p className="muted" style={{ padding: "16px 0", textAlign: "center" }}>
              Ngày này chưa có đơn.
            </p>
          )}
        </div>
      </section>

      <section className="card pad section" aria-labelledby="h-sum">
        <div className="shead">
          <h2 id="h-sum">Tổng hợp cần làm</h2>
          <span className="muted small">{sumLabel}</span>
        </div>
        <div className="seg" role="group" aria-label="Khoảng tổng hợp" style={{ marginBottom: 12 }}>
          {(
            [
              ["day", "Ngày"],
              ["week", "Tuần"],
              ["month", "Tháng"],
            ] as const
          ).map(([k, l]) => (
            <Link key={k} href={url({ scope: k })} aria-pressed={scope === k} role="button" scroll={false} className="segbtn">
              {l}
            </Link>
          ))}
        </div>
        <div className="sum">
          <div>
            <b>{sum.count}</b>
            <span>Đơn mới cần làm</span>
          </div>
          <div>
            <b>{formatMoney(sum.total)}</b>
            <span>Tổng tiền</span>
          </div>
          <div>
            <b>{formatMoney(sum.deposit)}</b>
            <span>Đã cọc</span>
          </div>
          <div>
            <b style={{ color: "var(--danger)" }}>{formatMoney(sum.remaining)}</b>
            <span>Còn lại</span>
          </div>
        </div>
        {sum.products.length ? (
          <>
            <h3 style={{ marginTop: 16 }}>Cần làm theo mẫu</h3>
            <div className="permodel">
              {sum.products.map((p) => (
                <div key={p.productId}>
                  <Thumb url={p.imageUrl} size={[40, 40]} />
                  <span>
                    {p.name}
                    <br />
                    <span className="muted xs">{p.code}</span>
                  </span>
                  <b>{p.qty}</b>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="muted small" style={{ marginTop: 12 }}>
            Không có đơn mới trong khoảng này.
          </p>
        )}
        <p className="muted xs" style={{ marginTop: 12 }}>
          Chỉ tính đơn Mới. Đơn Đang giao, Hoàn thành và Hủy không nằm trong tổng.
        </p>
      </section>
    </>
  );
}
