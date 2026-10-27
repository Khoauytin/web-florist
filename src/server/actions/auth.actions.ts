"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/auth";
import { actionUser } from "@/server/auth/session";
import { changeOwnPassword } from "@/server/services/users.service";
import { toActionState, type ActionState } from "@/server/errors";

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { ok: false, error: "Vui lòng nhập tên đăng nhập và mật khẩu." };
  try {
    await auth.api.signInUsername({ body: { username, password }, headers: await headers() });
  } catch (err) {
    const msg = String((err as { message?: string })?.message ?? "");
    if (/banned/i.test(msg)) return { ok: false, error: "Tài khoản đã bị khóa. Liên hệ chủ shop." };
    if (/too many/i.test(msg)) return { ok: false, error: "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau một phút." };
    return { ok: false, error: "Tên đăng nhập hoặc mật khẩu không đúng." };
  }
  redirect("/today");
}

export async function logoutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const current = String(form.get("currentPassword") ?? "");
  const next = String(form.get("newPassword") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");
  if (next !== confirm) return { ok: false, error: "Mật khẩu nhập lại không khớp.", fieldErrors: { confirmPassword: "Không khớp" } };
  try {
    const user = await actionUser();
    await changeOwnPassword(user, await headers(), current, next);
  } catch (err) {
    return toActionState(err);
  }
  redirect("/today?pw=1");
}
