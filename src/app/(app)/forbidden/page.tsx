import Link from "next/link";

export const metadata = { title: "Không có quyền" };

export default function ForbiddenPage() {
  return (
    <div className="panel pad" style={{ marginTop: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Bạn không có quyền xem trang này</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Trang này chỉ dành cho chủ shop.
      </p>
      <Link className="btn btn-secondary" href="/today">
        Về trang Theo ngày
      </Link>
    </div>
  );
}
