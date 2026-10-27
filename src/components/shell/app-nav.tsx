"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { Icon, type IconName } from "@/components/icon";
import { logoutAction } from "@/server/actions/auth.actions";

type Item = { href: string; label: string; icon: IconName; owner?: boolean };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Công việc",
    items: [
      { href: "/today", label: "Theo ngày", icon: "today" },
      { href: "/orders", label: "Đơn hàng", icon: "orders" },
      { href: "/production", label: "Sản xuất", icon: "make" },
    ],
  },
  {
    title: "Dữ liệu",
    items: [
      { href: "/products", label: "Sản phẩm", icon: "box" },
      { href: "/categories", label: "Danh mục", icon: "tag", owner: true },
      { href: "/customers", label: "Khách hàng", icon: "users" },
    ],
  },
  {
    title: "Quản trị",
    items: [
      { href: "/exports", label: "Xuất Excel", icon: "download", owner: true },
      { href: "/staff", label: "Nhân viên", icon: "shield", owner: true },
      { href: "/audit", label: "Lịch sử thao tác", icon: "history", owner: true },
    ],
  },
];

const MOBILE_MAIN = ["/today", "/orders", "/production", "/products"];

export function AppNav({ role, name, newCount }: { role: "owner" | "staff"; name: string; newCount: number }) {
  const pathname = usePathname();
  const sheet = useRef<HTMLDialogElement>(null);
  const isCurrent = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const visible = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.owner || role === "owner") })).filter((g) => g.items.length);
  const all = visible.flatMap((g) => g.items);
  const extra = all.filter((i) => !MOBILE_MAIN.includes(i.href));
  const count = (href: string) =>
    href === "/orders" && newCount > 0 ? <span className="count" aria-label={`${newCount} đơn mới chờ xác nhận`}>{newCount}</span> : null;

  return (
    <>
      <aside className="sidebar" aria-label="Điều hướng chính">
        <div className="brand">
          <b>Bích Ngọc Florist</b>
          <span>Quản lý tiệm</span>
        </div>
        <nav>
          {visible.map((g) => (
            <div className="navgroup" key={g.title}>
              <div className="navtitle">{g.title}</div>
              {g.items.map((i) => (
                <Link key={i.href} className="navlink" href={i.href} aria-current={isCurrent(i.href) ? "page" : undefined}>
                  <Icon name={i.icon} />
                  {i.label}
                  {count(i.href)}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="userbox">
          <div className="who">{name}</div>
          <div className="role">{role === "owner" ? "Chủ shop" : "Nhân viên"}</div>
          <div className="actions" style={{ marginLeft: -12, marginTop: 4 }}>
            <Link className="btn btn-ghost btn-sm" href="/account/password">
              <Icon name="key" className="icon-sm" />
              Đổi mật khẩu
            </Link>
            <form action={logoutAction}>
              <button className="btn btn-ghost btn-sm" type="submit">
                <Icon name="out" className="icon-sm" />
                Đăng xuất
              </button>
            </form>
          </div>
        </div>
      </aside>

      <nav className="bottomnav" aria-label="Điều hướng chính">
        {MOBILE_MAIN.map((href) => {
          const i = all.find((x) => x.href === href)!;
          return (
            <Link key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined}>
              <Icon name={i.icon} />
              {i.label}
              {href === "/orders" && newCount > 0 ? <span className="badge-dot" aria-label={`${newCount} đơn mới`}>{newCount}</span> : null}
            </Link>
          );
        })}
        <button type="button" onClick={() => sheet.current?.showModal()} aria-current={extra.some((i) => isCurrent(i.href)) ? "page" : undefined} aria-haspopup="dialog">
          <Icon name="more" />
          Thêm
        </button>
      </nav>

      <dialog
        className="sheet"
        ref={sheet}
        aria-labelledby="more-title"
        onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest("a")) sheet.current?.close();
        }}
      >
        <div className="dlg-h">
          <h2 id="more-title">{name}</h2>
          <button className="icon-btn" type="button" onClick={() => sheet.current?.close()} aria-label="Đóng">
            <Icon name="x" />
          </button>
        </div>
        <div className="sb">
          {extra.map((i) => (
            <Link key={i.href} href={i.href} aria-current={isCurrent(i.href) ? "page" : undefined}>
              <Icon name={i.icon} />
              {i.label}
            </Link>
          ))}
          <Link href="/account/password">
            <Icon name="key" />
            Đổi mật khẩu
          </Link>
          <form action={logoutAction}>
            <button type="submit">
              <Icon name="out" />
              Đăng xuất
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
