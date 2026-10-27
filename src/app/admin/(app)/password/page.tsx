import Link from "next/link";
import { Icon } from "@/components/admin/icon";
import { PasswordForm } from "@/components/admin/settings-forms";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Đổi mật khẩu" };

export default async function PasswordPage() {
  await requireUser();
  return (
    <>
      <Link className="back" href="/admin/settings">
        <Icon name="back" />
        Thông tin shop
      </Link>
      <h1 style={{ margin: "8px 0 16px" }}>Đổi mật khẩu</h1>
      <PasswordForm />
    </>
  );
}
