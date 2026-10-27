import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/auth";
import { ForbiddenError } from "@/server/errors";
import type { Role } from "@/server/domain/order-status";

export interface CurrentUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  mustChangePassword: boolean;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.banned) return null;
  const u = session.user as typeof session.user & { username?: string | null; mustChangePassword?: boolean };
  return {
    id: u.id,
    name: u.name,
    username: u.username ?? "",
    role: u.role === "owner" ? "owner" : "staff",
    mustChangePassword: Boolean(u.mustChangePassword),
  };
});

/** For pages: redirect to login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages: owner-only screens render a "no permission" state via `forbidden`. */
export async function requireOwnerPage(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/forbidden");
  return user;
}

/** For server actions: throws instead of redirecting so the form can show the error. */
export async function actionUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  return user;
}

export async function actionOwner(): Promise<CurrentUser> {
  const user = await actionUser();
  if (user.role !== "owner") throw new ForbiddenError();
  return user;
}
