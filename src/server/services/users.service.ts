import { auth, placeholderEmail } from "@/server/auth/auth";
import { prisma } from "@/server/db/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/server/errors";
import { audit } from "@/server/services/audit.service";
import type { CurrentUser } from "@/server/auth/session";

const USERNAME_RE = /^[a-z0-9._]{3,30}$/;

function ownerOnly(actor: CurrentUser) {
  if (actor.role !== "owner") throw new ForbiddenError("Chỉ chủ shop được quản lý tài khoản.");
}

function checkPassword(password: string, field = "password") {
  if (password.length < 8 || password.length > 128) throw new AppError("Mật khẩu cần từ 8 đến 128 ký tự.", { [field]: "Từ 8 ký tự" });
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, username: true, role: true, banned: true, lastLoginAt: true, createdAt: true },
  });
}

/** `headers` = request headers of the owner's session (Better Auth admin API checks it). */
export async function createStaff(actor: CurrentUser, headers: Headers, input: { name: string; username: string; password: string }) {
  ownerOnly(actor);
  const username = input.username.trim().toLowerCase();
  const name = input.name.trim();
  if (!name) throw new AppError("Vui lòng nhập tên.", { name: "Bắt buộc" });
  if (!USERNAME_RE.test(username)) throw new AppError("Tên đăng nhập gồm 3-30 ký tự a-z, 0-9, dấu chấm hoặc gạch dưới.", { username: "Không hợp lệ" });
  checkPassword(input.password);
  if (await prisma.user.findUnique({ where: { username } })) throw new AppError("Tên đăng nhập đã được dùng.", { username: "Đã tồn tại" });
  const created = await auth.api.createUser({
    headers,
    body: { email: placeholderEmail(username), password: input.password, name, role: "staff", data: { username, displayUsername: username, mustChangePassword: true } },
  });
  await prisma.$transaction(async (tx) => {
    await audit(tx, { actorId: actor.id, action: "user.create", entityType: "user", entityId: created.user.id, summary: `Tạo tài khoản nhân viên ${name} (${username})` });
  });
  return created.user;
}

export async function resetPassword(actor: CurrentUser, headers: Headers, userId: string, newPassword: string) {
  ownerOnly(actor);
  checkPassword(newPassword);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("Không tìm thấy tài khoản.");
  if (user.role === "owner" && user.id !== actor.id) throw new ForbiddenError("Không đặt lại mật khẩu của chủ shop khác.");
  await auth.api.setUserPassword({ headers, body: { userId, newPassword } });
  await auth.api.revokeUserSessions({ headers, body: { userId } });
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { mustChangePassword: true } });
    await audit(tx, { actorId: actor.id, action: "user.reset_password", entityType: "user", entityId: userId, summary: `Đặt lại mật khẩu cho ${user.name}` });
  });
}

export async function setLocked(actor: CurrentUser, headers: Headers, userId: string, locked: boolean) {
  ownerOnly(actor);
  if (userId === actor.id) throw new AppError("Bạn không thể tự khóa tài khoản của mình.");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("Không tìm thấy tài khoản.");
  if (user.role === "owner") throw new AppError("Không thể khóa tài khoản chủ shop.");
  if (locked) await auth.api.banUser({ headers, body: { userId, banReason: "Khóa bởi chủ shop" } });
  else await auth.api.unbanUser({ headers, body: { userId } });
  await prisma.$transaction(async (tx) => {
    await audit(tx, { actorId: actor.id, action: locked ? "user.lock" : "user.unlock", entityType: "user", entityId: userId, summary: `${locked ? "Khóa" : "Mở khóa"} tài khoản ${user.name}` });
  });
}

export async function changeOwnPassword(actor: CurrentUser, headers: Headers, currentPassword: string, newPassword: string) {
  checkPassword(newPassword, "newPassword");
  if (currentPassword === newPassword) throw new AppError("Mật khẩu mới phải khác mật khẩu cũ.", { newPassword: "Trùng mật khẩu cũ" });
  try {
    await auth.api.changePassword({ headers, body: { currentPassword, newPassword, revokeOtherSessions: true } });
  } catch {
    throw new AppError("Mật khẩu hiện tại không đúng.", { currentPassword: "Không đúng" });
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { mustChangePassword: false } });
    await audit(tx, { actorId: actor.id, action: "user.change_password", entityType: "user", entityId: actor.id, summary: "Đổi mật khẩu" });
  });
}
