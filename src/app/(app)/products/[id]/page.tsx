import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getProduct } from "@/server/services/catalog.service";
import { MOVEMENT_LABELS, listMovements } from "@/server/services/inventory.service";
import { StockActions } from "@/components/products/stock-actions";
import { ImageManager } from "@/components/products/image-manager";
import { RangeFilter } from "@/components/date-filters";
import { Icon } from "@/components/icon";
import { formatDateTime, formatRange, parseRange, todayVn } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { FULFILLMENT_HINTS, FULFILLMENT_LABELS, PRODUCT_STATUS_LABELS } from "@/lib/labels";
import { one, type SearchParams } from "@/lib/search-params";

export const metadata = { title: "Chi tiết sản phẩm" };

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const product = await getProduct(id, { includeCost: user.role === "owner" });
  if (!product) notFound();
  const today = todayVn();
  const range = parseRange(one(sp, "from"), one(sp, "to"), null);
  const moves = await listMovements(id, range);
  const owner = user.role === "owner";
  const available = product.onHand - product.reserved;
  const mto = product.fulfillmentMode === "MADE_TO_ORDER";
  const primary = product.images.find((i) => i.isPrimary) ?? product.images[0];

  return (
    <>
      <Link className="back" href="/products">
        <Icon name="back" />
        Sản phẩm
      </Link>
      <div className="pagehead" style={{ marginTop: 4 }}>
        <div>
          <h1>{product.name}</h1>
          <p className="sub">
            {product.code} · {product.category.name}
            {product.status !== "ACTIVE" ? ` · ${PRODUCT_STATUS_LABELS[product.status]}` : ""}
          </p>
        </div>
        <div className="actions">
          <StockActions productId={product.id} role={user.role} onHand={product.onHand} reserved={product.reserved} madeToOrder={mto} />
          {owner ? (
            <Link className="btn btn-secondary" href={`/products/${product.id}/edit`}>
              <Icon name="edit" />
              Sửa sản phẩm
            </Link>
          ) : null}
        </div>
      </div>

      <div className="pdetail">
        <div className="stack">
          {primary ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="photo" src={primary.url} alt={product.name} width={640} height={800} />
          ) : (
            <div className="photo noimg">
              <Icon name="image" />
            </div>
          )}
          {owner ? <ImageManager productId={product.id} images={product.images.map((i) => ({ id: i.id, url: i.url, isPrimary: i.isPrimary }))} /> : null}
        </div>
        <div className="stack-lg" style={{ minWidth: 0 }}>
          {mto ? (
            <div className="alert alert-info" role="note">
              <Icon name="info" />
              <span>Sản phẩm làm theo đơn nên không dùng tồn kho. Số lượng cần làm được tính trên từng đơn.</span>
            </div>
          ) : (
            <div>
              <div className="bigtrio">
                <div>
                  <div className="v">{product.onHand}</div>
                  <div className="l">Đang có</div>
                </div>
                <div>
                  <div className="v">{product.reserved}</div>
                  <div className="l">Đã giữ cho đơn</div>
                </div>
                <div className="hl">
                  <div className="v">{available}</div>
                  <div className="l">Sẵn sàng bán</div>
                </div>
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>
                Sẵn sàng bán = Đang có - Đã giữ cho đơn
              </p>
            </div>
          )}
          <dl className="panel kv">
            <dt>Giá bán</dt>
            <dd>{product.price === null ? <span className="tag tag-warn">Chưa có giá</span> : formatMoney(product.price)}</dd>
            {owner ? (
              <>
                <dt>Giá vốn</dt>
                <dd>{product.costPrice === null ? "Chưa nhập" : formatMoney(product.costPrice)}</dd>
              </>
            ) : null}
            <dt>Phương thức</dt>
            <dd>
              {FULFILLMENT_LABELS[product.fulfillmentMode]}
              <span className="small muted" style={{ display: "block" }}>
                {FULFILLMENT_HINTS[product.fulfillmentMode]}
              </span>
            </dd>
            <dt>Trạng thái</dt>
            <dd>{PRODUCT_STATUS_LABELS[product.status]}</dd>
            {product.size ? (
              <>
                <dt>Kích thước</dt>
                <dd>{product.size}</dd>
              </>
            ) : null}
            {product.color ? (
              <>
                <dt>Màu sắc</dt>
                <dd>{product.color}</dd>
              </>
            ) : null}
            {product.description ? (
              <>
                <dt>Mô tả</dt>
                <dd style={{ whiteSpace: "pre-wrap" }}>{product.description}</dd>
              </>
            ) : null}
          </dl>

          {!mto || moves.length ? (
            <section aria-labelledby="h-mv">
              <div className="section" style={{ marginTop: 0 }}>
                <div className="head">
                  <h2 id="h-mv">Lịch sử tồn kho</h2>
                  <span className="small muted">{range ? formatRange(range.from, range.to) : "200 thay đổi gần nhất"}</span>
                </div>
              </div>
              <RangeFilter from={range?.from ?? null} to={range?.to ?? null} today={today} allowAll allLabel="Gần nhất" presets={["today", "last7", "thisMonth", "lastMonth"]} />
              {moves.length ? (
                <div className="panel scroll">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>Loại</th>
                        <th className="r">SL</th>
                        <th className="r">Đang có</th>
                        <th className="r">Đã giữ</th>
                        <th>Người làm</th>
                        <th>Đơn hoặc lý do</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moves.map((m) => (
                        <tr key={m.id}>
                          <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(m.createdAt)}</td>
                          <td>{MOVEMENT_LABELS[m.type]}</td>
                          <td className="r">{m.deltaOnHand > 0 ? `+${m.deltaOnHand}` : m.deltaOnHand < 0 ? m.deltaOnHand : m.type === "WRITE_OFF" ? m.quantity : `${m.deltaReserved > 0 ? "+" : ""}${m.deltaReserved}`}</td>
                          <td className="r">{m.onHandAfter}</td>
                          <td className="r">{m.reservedAfter}</td>
                          <td>{m.createdBy.name}</td>
                          <td>
                            {m.order ? <Link href={`/orders/${m.order.id}`}>{m.order.code}</Link> : null}
                            {m.order && m.reason ? " · " : null}
                            {m.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="panel empty">
                  <p>Chưa có thay đổi tồn kho trong khoảng này.</p>
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
