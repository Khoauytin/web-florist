"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/auth";
import { actionUser } from "@/server/auth/session";
import { toActionState, type ActionState } from "@/server/errors";

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { ok: false, error: "Vui lòng nhập tên đăng nhập và mật khẩu." };
  try {
    await auth.api.signInUsername({ body: { username, password }, headers: await headers() });
  } catch (err) {
    const msg = String((err as { message?: string })?.message ?? "");
    if (/too many/i.test(msg)) return { ok: false, error: "Đăng nhập sai quá nhiều lần. Thử lại sau một phút." };
    return { ok: false, error: "Tên đăng nhập hoặc mật khẩu không đúng." };
  }
  redirect("/admin");
}

export async function logoutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/admin/login");
}

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const current = String(form.get("currentPassword") ?? "");
  const next = String(form.get("newPassword") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");
  if (next.length < 8) return { ok: false, error: "Mật khẩu mới cần ít nhất 8 ký tự.", fieldErrors: { newPassword: "Ít nhất 8 ký tự" } };
  if (next !== confirm) return { ok: false, error: "Mật khẩu nhập lại không khớp.", fieldErrors: { confirmPassword: "Không khớp" } };
  try {
    await actionUser();
    await auth.api.changePassword({ headers: await headers(), body: { currentPassword: current, newPassword: next, revokeOtherSessions: true } });
  } catch (err) {
    const state = toActionState(err);
    return state.error?.startsWith("Phiên") ? state : { ok: false, error: "Mật khẩu hiện tại không đúng.", fieldErrors: { currentPassword: "Không đúng" } };
  }
  return { ok: true, message: "Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất." };
}
