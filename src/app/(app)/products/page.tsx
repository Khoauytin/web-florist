import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { listCategories, listProducts, productCountsByCategory } from "@/server/services/catalog.service";
import { SearchBox } from "@/components/date-filters";
import { Pager } from "@/components/orders/order-bits";
import { Icon } from "@/components/icon";
import { formatMoney } from "@/lib/format";
import { FULFILLMENT_LABELS, PRODUCT_STATUS_LABELS } from "@/lib/labels";
import { one, pageOf, withParam, type SearchParams } from "@/lib/search-params";
import { isUuid } from "@/lib/ids";

export const metadata = { title: "Sản phẩm" };

const STATUS_FILTERS = [
  { value: "", label: "Đang bán và tạm ẩn" },
  { value: "ACTIVE", label: "Đang bán" },
  { value: "HIDDEN", label: "Tạm ẩn" },
  { value: "ARCHIVED", label: "Lưu trữ" },
] as const;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = one(sp, "q") ?? "";
  const rawCategory = one(sp, "category");
  const categoryId = isUuid(rawCategory) ? rawCategory : undefined;
  const status = one(sp, "status") as "ACTIVE" | "HIDDEN" | "ARCHIVED" | undefined;
  const noPrice = one(sp, "noprice") === "1";
  const page = pageOf(sp);
  const [categories, counts, { rows, total, pageSize }] = await Promise.all([
    listCategories(),
    productCountsByCategory(),
    listProducts({ q, categoryId, noPrice, status: status && ["ACTIVE", "HIDDEN", "ARCHIVED"].includes(status) ? status : undefined }, page),
  ]);
  const shown = rows;
  const allCount = [...counts.values()].reduce((a, b) => a + b, 0);
  const base = { ...sp, page: undefined };

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Sản phẩm</h1>
          <p className="sub">Tồn kho là thành phẩm đã làm sẵn. Sẵn sàng bán = Đang có - Đã giữ cho đơn.</p>
        </div>
        {user.role === "owner" ? (
          <Link className="btn btn-primary" href="/products/new">
            <Icon name="plus" />
            Thêm sản phẩm
          </Link>
        ) : null}
      </div>
      <div className="filters">
        <SearchBox value={q} placeholder="Tìm theo tên hoặc mã sản phẩm" label="Tìm sản phẩm" />
        <div className="chips" role="group" aria-label="Lọc theo danh mục">
          <Link className="chip" href={withParam("/products", base, "category", null)} aria-current={!categoryId ? "true" : undefined}>
            Tất cả<span className="n">{allCount}</span>
          </Link>
          {categories.map((c) => (
            <Link key={c.id} className="chip" href={withParam("/products", base, "category", c.id)} aria-current={categoryId === c.id ? "true" : undefined}>
              {c.name}
              <span className="n">{counts.get(c.id) ?? 0}</span>
            </Link>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Lọc theo trạng thái">
          {STATUS_FILTERS.map((s) => (
            <Link key={s.value} className="chip" href={withParam("/products", { ...base, noprice: undefined }, "status", s.value || null)} aria-current={(status ?? "") === s.value && !noPrice ? "true" : undefined}>
              {s.label}
            </Link>
          ))}
          <Link className="chip" href={withParam("/products", base, "noprice", noPrice ? null : "1")} aria-current={noPrice ? "true" : undefined}>
            Chưa có giá
          </Link>
        </div>
      </div>
      {shown.length ? (
        <div className="pgrid">
          {shown.map((p) => {
            const avail = p.onHand - p.reserved;
            return (
              <Link key={p.id} className="pcard" href={`/products/${p.id}`}>
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0].url} alt="" width={96} height={120} loading="lazy" />
                ) : (
                  <span className="noimg">
                    <Icon name="image" />
                  </span>
                )}
                <div>
                  <div className="nm">{p.name}</div>
                  <div className="code">
                    {p.code} · {p.category.name}
                  </div>
                  <div className="price">{p.price === null ? <span className="tag tag-warn">Chưa có giá</span> : formatMoney(p.price)}</div>
                  {p.fulfillmentMode === "MADE_TO_ORDER" ? (
                    <p className="small muted" style={{ marginTop: 8 }}>
                      Làm theo đơn, không dùng tồn kho
                    </p>
                  ) : (
                    <div className="stocktrio">
                      <div>
                        Đang có<b>{p.onHand}</b>
                      </div>
                      <div>
                        Đã giữ<b>{p.reserved}</b>
                      </div>
                      <div className={avail === 0 ? "avail zero" : "avail"}>
                        Sẵn sàng bán<b>{avail}</b>
                      </div>
                    </div>
                  )}
                  <div className="actions" style={{ marginTop: 8, gap: 4 }}>
                    <span className="tag">{FULFILLMENT_LABELS[p.fulfillmentMode]}</span>
                    {p.status !== "ACTIVE" ? <span className="tag">{PRODUCT_STATUS_LABELS[p.status]}</span> : null}
                    {p.fulfillmentMode === "STOCK_ONLY" && avail === 0 ? <span className="tag tag-danger">Hết hàng</span> : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="panel empty">
          <p>Không có sản phẩm nào khớp bộ lọc.</p>
        </div>
      )}
      <Pager page={page} total={total} pageSize={pageSize} hrefFor={(p) => withParam("/products", sp, "page", p)} />
    </>
  );
}
