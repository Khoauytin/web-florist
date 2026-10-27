import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { productionList } from "@/server/services/work.service";
import { RangeFilter } from "@/components/date-filters";
import { AllocBar } from "@/components/orders/order-bits";
import { MadeStepper } from "@/components/orders/made-stepper";
import { dbDateToYmd, formatRange, formatYmdShort, parseRange, todayVn } from "@/lib/dates";
import { timeWindow } from "@/lib/format";
import { one, withParam, type SearchParams } from "@/lib/search-params";

export const metadata = { title: "Sản xuất" };

export default async function ProductionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser();
  const sp = await searchParams;
  const today = todayVn();
  const range = parseRange(one(sp, "from"), one(sp, "to"), null);
  const includeDone = one(sp, "done") === "1";
  const groups = await productionList({ from: range?.from, to: range?.to, includeDone });
  const remaining = groups.reduce((s, g) => s + g.remaining, 0);

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Sản xuất</h1>
          <p className="sub">
            Việc cần làm từ các đơn đã xác nhận · {range ? `giao ${formatRange(range.from, range.to)}` : "mọi ngày giao"} · còn {remaining} sản phẩm
          </p>
        </div>
      </div>
      <div className="filters">
        <RangeFilter from={range?.from ?? null} to={range?.to ?? null} today={today} allowAll allLabel="Tất cả" presets={["today", "tomorrow", "next7"]} label="Lọc theo ngày giao" />
        <div className="chips">
          <Link className="chip" href={withParam("/production", sp, "done", includeDone ? null : "1")} aria-pressed={includeDone}>
            Hiện cả việc đã làm xong
          </Link>
        </div>
      </div>
      {groups.length ? (
        groups.map((g) => (
          <section key={g.key} className="group panel" aria-label={g.name}>
            <div className="ghead">
              {g.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.imageUrl} alt="" width={56} height={56} loading="lazy" />
              ) : (
                <div className="thumb-free">Tự do</div>
              )}
              <div>
                <h2>{g.productId ? <Link href={`/products/${g.productId}`} style={{ color: "inherit" }}>{g.name}</Link> : g.name}</h2>
                <div className="small muted">{g.code ?? "Dòng tự do"}</div>
              </div>
              <div className="left">
                {g.remaining}
                <small>còn phải làm</small>
              </div>
            </div>
            {g.rows.map((r) => (
              <div key={r.itemId} className="prow">
                <div className="top">
                  <div>
                    <Link href={`/orders/${r.orderId}`}>
                      <b>{r.orderCode}</b>
                    </Link>{" "}
                    · {r.recipientName}
                    <div className="small muted">
                      Giao {r.deliveryDate ? formatYmdShort(dbDateToYmd(r.deliveryDate)) : "chưa hẹn"}
                      {timeWindow(r.deliveryTimeFrom, r.deliveryTimeTo) ? ` · ${timeWindow(r.deliveryTimeFrom, r.deliveryTimeTo)}` : ""}
                      {r.orderStatus === "DELIVERY_FAILED" ? " · Giao thất bại" : ""}
                    </div>
                  </div>
                  <div className="small muted">
                    Đặt {r.qtyOrdered}, lấy kho {r.qtyFromStock}
                  </div>
                </div>
                <AllocBar ordered={r.qtyOrdered} fromStock={r.qtyFromStock} toMake={r.qtyToMake} made={r.qtyMade} allocated />
                <MadeStepper orderId={r.orderId} itemId={r.itemId} made={r.qtyMade} toMake={r.qtyToMake} label={`${g.name} cho ${r.orderCode}`} />
              </div>
            ))}
          </section>
        ))
      ) : (
        <div className="panel empty">
          <p>Chưa có việc cần làm. Khi một đơn được xác nhận và cần làm thêm, việc sẽ hiện ở đây.</p>
        </div>
      )}
    </>
  );
}
