import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { AppNav } from "@/components/shell/app-nav";
import { Icon } from "@/components/icon";
import { Toaster } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const newCount = await prisma.order.count({ where: { status: "NEW" } });
  return (
    <div className="app">
      <a className="skip" href="#main">
        Bỏ qua điều hướng
      </a>
      <AppNav role={user.role} name={user.name} newCount={newCount} />
      <main className="main" id="main" tabIndex={-1}>
        {user.mustChangePassword ? (
          <div className="alert alert-warn" role="status" style={{ marginBottom: 16 }}>
            <Icon name="key" />
            <span>
              Bạn đang dùng mật khẩu tạm. <Link href="/account/password">Đổi mật khẩu ngay</Link> để bảo vệ tài khoản.
            </span>
          </div>
        ) : null}
        {children}
      </main>
      <Toaster />
    </div>
  );
}
