import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/today");
  return (
    <main className="auth">
      <div className="form">
        <div>
          <h1>Bích Ngọc Florist</h1>
          <p className="muted">Đăng nhập để quản lý đơn hàng và sản phẩm.</p>
        </div>
        <LoginForm />
      </div>
      <div className="art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/login.webp" alt="Bó hoa sáp của tiệm" width={900} height={1100} />
      </div>
    </main>
  );
}
