import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { dayOverview } from "@/server/services/work.service";
import { DayPicker } from "@/components/date-filters";
import { OrderListHead, OrderRow } from "@/components/orders/order-bits";
import { Icon } from "@/components/icon";
import { isYmd, relativeDayLabel, todayVn } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { one, type SearchParams } from "@/lib/search-params";

export const metadata = { title: "Theo ngày" };

export default async function TodayPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser();
  const sp = await searchParams;
  const today = todayVn();
  const raw = one(sp, "date");
  const day = raw && isYmd(raw) ? raw : today;
  const data = await dayOverview(day);
  const rel = relativeDayLabel(day, today);
  const dayWord = rel ? rel.toLowerCase() : "trong ngày";

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>{rel ?? "Theo ngày"}</h1>
          <p className="sub">Đơn cần giao, việc cần làm và tiền còn phải thu theo ngày giao.</p>
        </div>
        <Link className="btn btn-primary" href="/orders/new">
          <Icon name="plus" />
          Tạo đơn
        </Link>
      </div>
      {one(sp, "pw") ? (
        <div className="alert alert-success" role="status" style={{ marginBottom: 16 }}>
          <Icon name="check" />
          <span>Đã đổi mật khẩu.</span>
        </div>
      ) : null}
      <div className="datebar">
        <DayPicker day={day} today={today} />
      </div>

      <div className="stats">
        <div>
          <div className="v">{data.due.length}</div>
          <div className="l">Đơn cần giao {dayWord}</div>
        </div>
        <div>
          <div className="v">{data.fresh.length}</div>
          <div className="l">Đơn mới chưa xác nhận</div>
        </div>
        <div>
          <div className="v">{data.remaining}</div>
          <div className="l">Sản phẩm còn phải làm</div>
        </div>
        <div>
          <div className="v">{formatMoney(data.owed)}</div>
          <div className="l">Còn phải thu</div>
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>
        Đã hoàn thành {data.done} đơn giao ngày này · {data.createdCount} đơn được tạo trong ngày ·{" "}
        <Link href="/orders?status=NEW">{data.newAnyDay} đơn mới chờ xác nhận (mọi ngày)</Link>
      </p>

      <section className="section" aria-labelledby="h-due">
        <div className="head">
          <h2 id="h-due">Cần giao</h2>
          <Link href={`/orders?from=${day}&to=${day}`}>Xem tất cả đơn của ngày</Link>
        </div>
        {data.due.length ? (
          <div className="olist">
            <OrderListHead />
            {data.due.map((o) => (
              <OrderRow key={o.id} o={o} />
            ))}
          </div>
        ) : (
          <div className="panel empty">
            <p>Không có đơn nào cần giao trong ngày này.</p>
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="h-work">
        <div className="head">
          <h2 id="h-work">Việc cần làm</h2>
          <Link href={`/production?from=${day}&to=${day}`}>Mở bảng sản xuất</Link>
        </div>
        {data.work.length ? (
          <div className="panel divide">
            {data.work.map((g) => (
              <div key={g.key} className="line" style={{ gridTemplateColumns: "56px minmax(0,1fr) auto", alignItems: "center" }}>
                {g.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="thumb" style={{ width: 56, height: 56 }} src={g.imageUrl} alt="" width={56} height={56} loading="lazy" />
                ) : (
                  <div className="thumb thumb-free" style={{ width: 56, height: 56 }}>
                    Tự do
                  </div>
                )}
                <div>
                  <div className="nm">{g.name}</div>
                  <div className="meta">
                    {g.code ? `${g.code} · ` : ""}
                    {g.rows.length} đơn
                  </div>
                </div>
                <div style={{ fontWeight: 600, fontSize: "1.25rem" }} aria-label={`Còn phải làm ${g.remaining}`}>
                  {g.remaining}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel empty">
            <p>Không còn việc cần làm cho đơn giao ngày này.</p>
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="h-new">
        <div className="head">
          <h2 id="h-new">Đơn mới chờ xác nhận</h2>
        </div>
        {data.fresh.length ? (
          <div className="olist">
            <OrderListHead />
            {data.fresh.map((o) => (
              <OrderRow key={o.id} o={o} />
            ))}
          </div>
        ) : (
          <div className="panel empty">
            <p>Không có đơn mới nào hẹn giao ngày này.</p>
          </div>
        )}
      </section>
    </>
  );
}
