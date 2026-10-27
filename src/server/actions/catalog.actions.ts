"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionOwner, actionUser } from "@/server/auth/session";
import { INVALID_ID, toActionState, type ActionState } from "@/server/errors";
import { createCategory, createProduct, moveCategory, updateCategory, updateProduct } from "@/server/services/catalog.service";
import { adjustStock, produceStock } from "@/server/services/inventory.service";
import { addProductImage, removeProductImage, setPrimaryImage } from "@/server/services/images.service";
import { parseMoney } from "@/lib/format";
import { idsValid } from "@/lib/ids";

const productSchema = z.object({
  code: z.string().max(24),
  name: z.string().max(200),
  categoryId: z.string().uuid({ message: "Chọn danh mục" }),
  description: z.string().max(2000).optional(),
  size: z.string().max(120).optional(),
  color: z.string().max(120).optional(),
  fulfillmentMode: z.enum(["STOCK_ONLY", "MADE_TO_ORDER", "FLEXIBLE"]),
  status: z.enum(["ACTIVE", "HIDDEN", "ARCHIVED"]),
});

function readProduct(form: FormData) {
  const parsed = productSchema.safeParse({
    code: form.get("code") ?? "",
    name: form.get("name") ?? "",
    categoryId: form.get("categoryId") ?? "",
    description: form.get("description") ?? undefined,
    size: form.get("size") ?? undefined,
    color: form.get("color") ?? undefined,
    fulfillmentMode: form.get("fulfillmentMode"),
    status: form.get("status"),
  });
  const priceRaw = String(form.get("price") ?? "").trim();
  const costRaw = String(form.get("costPrice") ?? "").trim();
  const price = priceRaw === "" ? null : parseMoney(priceRaw);
  const costPrice = costRaw === "" ? null : parseMoney(costRaw);
  const fieldErrors: Record<string, string> = {};
  if (priceRaw !== "" && price === null) fieldErrors.price = "Giá không hợp lệ";
  if (costRaw !== "" && costPrice === null) fieldErrors.costPrice = "Giá vốn không hợp lệ";
  if (!parsed.success) {
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message.startsWith("Invalid") ? "Không hợp lệ" : i.message;
  }
  if (Object.keys(fieldErrors).length || !parsed.success) return { error: { ok: false, error: "Vui lòng kiểm tra lại thông tin sản phẩm.", fieldErrors } as ActionState };
  return { data: { ...parsed.data, price, costPrice } };
}

export type ProductActionState = ActionState & { id?: string };

export async function saveProductAction(productId: string | null, _prev: ProductActionState, form: FormData): Promise<ProductActionState> {
  if (!idsValid(productId)) return INVALID_ID;
  const r = readProduct(form);
  if ("error" in r) return r.error!;
  try {
    const user = await actionOwner();
    const p = productId ? await updateProduct(user, productId, r.data) : await createProduct(user, r.data);
    revalidatePath("/products");
    revalidatePath(`/products/${p.id}`);
    return { ok: true, id: p.id, message: productId ? "Đã lưu sản phẩm" : "Đã tạo sản phẩm" };
  } catch (e) {
    return toActionState(e);
  }
}

export async function produceStockAction(productId: string, quantity: number, note: string): Promise<ActionState> {
  if (!idsValid(productId)) return INVALID_ID;
  try {
    const user = await actionUser();
    const after = await produceStock(user, productId, quantity, note.slice(0, 300));
    revalidatePath(`/products/${productId}`);
    revalidatePath("/products");
    return { ok: true, message: `Đã nhập thêm ${quantity}. Đang có ${after.onHand}.` };
  } catch (e) {
    return toActionState(e);
  }
}

export async function adjustStockAction(productId: string, delta: number, reason: string): Promise<ActionState> {
  if (!idsValid(productId)) return INVALID_ID;
  try {
    const user = await actionOwner();
    const after = await adjustStock(user, productId, delta, reason.slice(0, 300));
    revalidatePath(`/products/${productId}`);
    revalidatePath("/products");
    return { ok: true, message: `Đã điều chỉnh. Đang có ${after.onHand}.` };
  } catch (e) {
    return toActionState(e);
  }
}

export async function uploadImageAction(productId: string, form: FormData): Promise<ActionState> {
  if (!idsValid(productId)) return INVALID_ID;
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Chưa chọn ảnh." };
  try {
    const user = await actionOwner();
    await addProductImage(user, productId, { bytes: Buffer.from(await file.arrayBuffer()), type: file.type });
    revalidatePath(`/products/${productId}`);
    revalidatePath("/products");
    return { ok: true, message: "Đã thêm ảnh" };
  } catch (e) {
    return toActionState(e);
  }
}

export async function setPrimaryImageAction(productId: string, imageId: string): Promise<ActionState> {
  if (!idsValid(productId, imageId)) return INVALID_ID;
  try {
    await setPrimaryImage(await actionOwner(), imageId);
    revalidatePath(`/products/${productId}`);
    revalidatePath("/products");
    return { ok: true, message: "Đã đặt làm ảnh chính" };
  } catch (e) {
    return toActionState(e);
  }
}

export async function removeImageAction(productId: string, imageId: string): Promise<ActionState> {
  if (!idsValid(productId, imageId)) return INVALID_ID;
  try {
    await removeProductImage(await actionOwner(), imageId);
    revalidatePath(`/products/${productId}`);
    revalidatePath("/products");
    return { ok: true, message: "Đã xóa ảnh" };
  } catch (e) {
    return toActionState(e);
  }
}

export async function saveCategoryAction(categoryId: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  if (!idsValid(categoryId)) return INVALID_ID;
  const name = String(form.get("name") ?? "").slice(0, 80);
  const description = String(form.get("description") ?? "").slice(0, 300);
  try {
    const user = await actionOwner();
    if (categoryId) await updateCategory(user, categoryId, { name, description, isActive: form.get("isActive") === "on" });
    else await createCategory(user, { name, description });
    revalidatePath("/categories");
    revalidatePath("/products");
    return { ok: true, message: categoryId ? "Đã lưu danh mục" : "Đã thêm danh mục" };
  } catch (e) {
    return toActionState(e);
  }
}

export async function moveCategoryAction(categoryId: string, direction: "up" | "down"): Promise<ActionState> {
  if (!idsValid(categoryId)) return INVALID_ID;
  try {
    await moveCategory(await actionOwner(), categoryId, direction === "up" ? "up" : "down");
    revalidatePath("/categories");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}
