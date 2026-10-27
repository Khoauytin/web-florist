"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/server/auth/session";
import { INVALID_ID, toActionState, type ActionState } from "@/server/errors";
import { createCustomer, updateCustomer } from "@/server/services/customers.service";
import { updateShopSettings } from "@/server/services/settings.service";
import { idsValid } from "@/lib/ids";

const str = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").slice(0, max);

export async function saveCustomerAction(customerId: string | null, _prev: ActionState & { id?: string }, form: FormData): Promise<ActionState & { id?: string }> {
  if (!idsValid(customerId)) return INVALID_ID;
  const input = { name: str(form, "name", 120), phone: str(form, "phone", 30), address: str(form, "address", 300), note: str(form, "note", 1000) };
  try {
    await actionUser();
    const c = customerId ? await updateCustomer(customerId, input) : await createCustomer(input);
    revalidatePath("/admin/customers", "layout");
    return { ok: true, id: c.id, message: customerId ? "Đã lưu khách hàng" : "Đã thêm khách hàng" };
  } catch (e) {
    return toActionState(e);
  }
}

export async function saveSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await actionUser();
    await updateShopSettings({
      shopName: str(form, "shopName", 120),
      phone: str(form, "phone", 30),
      zaloPhone: str(form, "zaloPhone", 30),
      facebookUrl: str(form, "facebookUrl", 300),
      messengerUrl: str(form, "messengerUrl", 300),
      tiktokUrl: str(form, "tiktokUrl", 300),
    });
    revalidatePath("/");
    revalidatePath("/admin/settings");
    return { ok: true, message: "Đã lưu thông tin shop. Trang khách đã cập nhật." };
  } catch (e) {
    return toActionState(e);
  }
}
