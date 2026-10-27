import Link from "next/link";
import { listCustomers } from "@/server/services/customers.service";
import { formatPhone } from "@/server/domain/phone";
import { Icon } from "@/components/admin/icon";
import { SearchForm } from "@/components/admin/search-form";
import { formatMoney } from "@/lib/format";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Khách hàng" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const COLORS = ["ov-lav", "ov-peach", "ov-sky", "ov-mint"];
const initials = (name: string) => (name.trim().split(/\s+/).pop() ?? "").slice(0, 2).toUpperCase();

export default async function CustomersPage({ searchParams }: { searchParams: SP }) {
  await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const rows = await listCustomers(q);
  return (
    <>
      <div className="shead">
        <h1>Khách hàng</h1>
        <Link className="btn btn-accent" href="/admin/customers/new" aria-label="Thêm khách hàng">
          <Icon name="plus" />
        </Link>
      </div>
      <div style={{ margin: "12px 0 16px" }}>
        <SearchForm value={q} placeholder="Tìm theo tên hoặc số điện thoại" label="Tìm khách" />
      </div>
      {rows.length ? (
        <div className="clist">
          {rows.map((r, i) => (
            <Link key={r.id} className="card crow" href={`/admin/customers/${r.id}`}>
              <span className={`avatar ${COLORS[i % 4]}`}>{initials(r.name)}</span>
              <span>
                <span className="nm">{r.name}</span>
                <br />
                <span className="muted small">{formatPhone(r.phone)}</span>
              </span>
              <span className="small" style={{ textAlign: "right" }}>
                <b>{r.stats.orders} đơn</b>
                <br />
                <span className="muted">{formatMoney(r.stats.spent)}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card empty">
          <p className="muted">{q ? "Không tìm thấy khách hàng." : "Chưa có khách hàng. Khách được tạo tự động khi bạn tạo đơn."}</p>
        </div>
      )}
      <p className="pager-note">Tổng tiền chỉ tính các đơn đã hoàn thành.</p>
    </>
  );
}
