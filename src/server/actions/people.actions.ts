"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { actionOwner, actionUser } from "@/server/auth/session";
import { INVALID_ID, toActionState, type ActionState } from "@/server/errors";
import { createCustomer, updateCustomer } from "@/server/services/customers.service";
import { createStaff, resetPassword, setLocked } from "@/server/services/users.service";
import { idsValid } from "@/lib/ids";

export type CustomerActionState = ActionState & { id?: string };

export async function saveCustomerAction(customerId: string | null, _prev: CustomerActionState, form: FormData): Promise<CustomerActionState> {
  if (!idsValid(customerId)) return INVALID_ID;
  const input = {
    name: String(form.get("name") ?? "").slice(0, 120),
    phone: String(form.get("phone") ?? "").slice(0, 30),
    email: String(form.get("email") ?? "").slice(0, 120),
    address: String(form.get("address") ?? "").slice(0, 300),
    note: String(form.get("note") ?? "").slice(0, 1000),
  };
  try {
    const user = await actionUser();
    const c = customerId ? await updateCustomer(user, customerId, input) : await createCustomer(user, input);
    revalidatePath("/customers");
    revalidatePath(`/customers/${c.id}`);
    return { ok: true, id: c.id, message: customerId ? "Đã lưu khách hàng" : "Đã thêm khách hàng" };
  } catch (e) {
    return toActionState(e);
  }
}

export async function createStaffAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await actionOwner();
    await createStaff(user, await headers(), {
      name: String(form.get("name") ?? "").slice(0, 120),
      username: String(form.get("username") ?? "").slice(0, 30),
      password: String(form.get("password") ?? "").slice(0, 128),
    });
    revalidatePath("/staff");
    return { ok: true, message: "Đã tạo tài khoản. Gửi tên đăng nhập và mật khẩu tạm cho nhân viên; họ sẽ được nhắc đổi mật khẩu." };
  } catch (e) {
    return toActionState(e);
  }
}

export async function resetPasswordAction(userId: string, password: string): Promise<ActionState> {
  if (!idsValid(userId)) return INVALID_ID;
  try {
    await resetPassword(await actionOwner(), await headers(), userId, String(password).slice(0, 128));
    revalidatePath("/staff");
    return { ok: true, message: "Đã đặt mật khẩu tạm mới và đăng xuất tài khoản này khỏi mọi thiết bị." };
  } catch (e) {
    return toActionState(e);
  }
}

export async function setLockedAction(userId: string, locked: boolean): Promise<ActionState> {
  if (!idsValid(userId)) return INVALID_ID;
  try {
    await setLocked(await actionOwner(), await headers(), userId, locked);
    revalidatePath("/staff");
    return { ok: true, message: locked ? "Đã khóa tài khoản và đăng xuất khỏi mọi thiết bị." : "Đã mở khóa tài khoản." };
  } catch (e) {
    return toActionState(e);
  }
}
