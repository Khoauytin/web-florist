import Link from "next/link";
import { ordersInRange } from "@/server/services/orders.service";
import { Icon } from "@/components/admin/icon";
import { TaskRow } from "@/components/admin/orders";
import { formatYmd, todayVn, weekdayVi } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Hôm nay" };

export default async function TodayPage() {
  await requireUser();
  const today = todayVn();
  const list = (await ordersInRange(today, today)).filter((o) => o.status !== "CANCELLED");
  // Same rule as the overview: only New orders count toward money still to collect.
  const owe = list.filter((o) => o.status === "NEW").reduce((s, o) => s + Math.max(0, o.total - o.deposit), 0);
  return (
    <>
      <Link className="back" href="/admin">
        <Icon name="back" />
        Tổng quan
      </Link>
      <div className="shead" style={{ marginTop: 8 }}>
        <div>
          <h1>Hôm nay</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {weekdayVi(today)}, {formatYmd(today)}
          </p>
        </div>
        <Link className="btn btn-accent" href={`/admin/orders/new?date=${today}`} aria-label="Tạo đơn cho hôm nay">
          <Icon name="plus" />
        </Link>
      </div>
      {list.length ? (
        <>
          <div className="sum" style={{ margin: "16px 0" }}>
            <div>
              <b>{list.length}</b>
              <span>Đơn giao hôm nay</span>
            </div>
            <div>
              <b style={{ color: "var(--danger)" }}>{formatMoney(owe)}</b>
              <span>Còn phải thu hôm nay</span>
            </div>
          </div>
          <div className="card pad">
            <div className="tasks">
              {list.map((o) => (
                <TaskRow key={o.id} o={o} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="card empty" style={{ marginTop: 16 }}>
          <span className="em-ic">
            <Icon name="sun" className="icon-lg" />
          </span>
          <h2>Hôm nay không có đơn</h2>
          <p className="muted small">Xem lịch để chuẩn bị cho những ngày tới.</p>
          <Link className="btn btn-ink" href="/admin/calendar">
            Mở lịch
          </Link>
        </div>
      )}
    </>
  );
}
