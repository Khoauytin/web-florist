import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { LoginForm } from "@/components/admin/settings-forms";

export const metadata = { title: "Đăng nhập" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/admin");
  return (
    <main className="login">
      <div className="card">
        <div>
          <div className="brandline">
            <span className="avatar">BN</span>
          </div>
          <h1>Đăng nhập</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Trang quản lý của Bích Ngọc Florist
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
