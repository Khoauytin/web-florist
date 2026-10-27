import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { listCustomers } from "@/server/services/customers.service";
import { formatPhone } from "@/server/domain/phone";
import { SearchBox } from "@/components/date-filters";
import { Pager } from "@/components/orders/order-bits";
import { Icon } from "@/components/icon";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { one, pageOf, withParam, type SearchParams } from "@/lib/search-params";

export const metadata = { title: "Khách hàng" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser();
  const sp = await searchParams;
  const q = one(sp, "q") ?? "";
  const page = pageOf(sp);
  const { rows, total, pageSize } = await listCustomers(q, page);
  return (
    <>
      <div className="pagehead">
        <h1>Khách hàng</h1>
        <Link className="btn btn-primary" href="/customers/new">
          <Icon name="plus" />
          Thêm khách
        </Link>
      </div>
      <div className="filters">
        <SearchBox value={q} placeholder="Tìm theo số điện thoại hoặc tên" label="Tìm khách" />
      </div>
      {rows.length ? (
        <div className="panel scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Số điện thoại</th>
                <th className="r">Đơn hoàn thành</th>
                <th className="r">Tổng tiền</th>
                <th>Mua gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link className="rowlink" href={`/customers/${c.id}`}>
                      {c.name}
                    </Link>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatPhone(c.phone)}</td>
                  <td className="r">{c.stats.count}</td>
                  <td className="r">{formatMoney(c.stats.spent)}</td>
                  <td>{c.stats.last ? formatDateTime(c.stats.last).slice(0, 10) : "Chưa có"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel empty">
          <p>{q ? "Không tìm thấy khách hàng." : "Chưa có khách hàng. Khách được tạo tự động khi tạo đơn."}</p>
        </div>
      )}
      <p className="small muted" style={{ marginTop: 8 }}>
        Số đơn và tổng tiền chỉ tính các đơn đã hoàn thành.
      </p>
      <Pager page={page} total={total} pageSize={pageSize} hrefFor={(p) => withParam("/customers", sp, "page", p)} />
    </>
  );
}
