"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/admin/icon";

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "Tổng quan", icon: "home" },
  { href: "/admin/calendar", label: "Lịch", icon: "cal" },
  { href: "/admin/products", label: "Sản phẩm", icon: "flower" },
  { href: "/admin/customers", label: "Khách hàng", icon: "users" },
];

function section(path: string) {
  if (path.startsWith("/admin/calendar")) return "/admin/calendar";
  if (path.startsWith("/admin/products") || path.startsWith("/admin/categories")) return "/admin/products";
  if (path.startsWith("/admin/customers")) return "/admin/customers";
  if (path.startsWith("/admin/settings") || path.startsWith("/admin/password")) return "/admin/settings";
  return "/admin";
}

export function Shell({ shopName, children }: { shopName: string; children: React.ReactNode }) {
  const path = usePathname();
  const cur = section(path);
  const isNew = path === "/admin/orders/new";
  // The order form has a fixed total bar; leave room for it.
  const sticky = isNew || /^\/admin\/orders\/[^/]+\/edit$/.test(path);
  return (
    <div className="app">
      <a className="skip" href="#main">
        Bỏ qua điều hướng
      </a>
      <aside className="side" aria-label="Điều hướng chính">
        <div className="brand">
          <span className="avatar">BN</span>
          {shopName}
        </div>
        <nav>
          {ITEMS.map((i) => (
            <Link key={i.href} href={i.href} aria-current={cur === i.href ? "page" : undefined}>
              <Icon name={i.icon} />
              {i.label}
            </Link>
          ))}
          <Link href="/admin/settings" aria-current={cur === "/admin/settings" ? "page" : undefined}>
            <Icon name="gear" />
            Thông tin shop
          </Link>
        </nav>
        <Link className="btn btn-ink new" href="/admin/orders/new" aria-current={isNew ? "page" : undefined}>
          <Icon name="plus" />
          Tạo đơn
        </Link>
      </aside>
      <main className={sticky ? "main has-sticky" : "main"} id="main" tabIndex={-1}>
        {children}
      </main>
      <nav className="bnav" aria-label="Điều hướng chính">
        {ITEMS.slice(0, 2).map((i) => (
          <Link key={i.href} href={i.href} aria-label={i.label} aria-current={cur === i.href ? "page" : undefined}>
            <Icon name={i.icon} className="icon-lg" />
          </Link>
        ))}
        <Link className="plus" href="/admin/orders/new" aria-label="Tạo đơn mới">
          <Icon name="plus" className="icon-lg" />
        </Link>
        {ITEMS.slice(2).map((i) => (
          <Link key={i.href} href={i.href} aria-label={i.label} aria-current={cur === i.href ? "page" : undefined}>
            <Icon name={i.icon} className="icon-lg" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
