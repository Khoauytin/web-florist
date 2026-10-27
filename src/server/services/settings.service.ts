import { cache } from "react";
import { prisma } from "@/server/db/prisma";
import { AppError } from "@/server/errors";
import { normalizePhone } from "@/server/domain/phone";

/** Read-only on the hot path (every public page view); the row is created only if the seed never ran. */
export const getShopSettings = cache(async () => {
  const row = await prisma.shopSettings.findUnique({ where: { id: 1 } });
  return row ?? prisma.shopSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
});

export interface ShopSettingsInput {
  shopName: string;
  phone?: string;
  zaloPhone?: string;
  facebookUrl?: string;
  messengerUrl?: string;
  tiktokUrl?: string;
}

function cleanUrl(value: string | undefined, field: string, hosts: string[]) {
  const v = value?.trim();
  if (!v) return null;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    throw new AppError("Đường link không hợp lệ.", { [field]: "Cần link đầy đủ, bắt đầu bằng https://" });
  }
  if (url.protocol !== "https:" || !hosts.some((h) => url.hostname === h || url.hostname.endsWith("." + h))) {
    throw new AppError("Đường link không đúng kênh.", { [field]: `Cần link https của ${hosts[0]}` });
  }
  return url.toString();
}

function cleanPhone(value: string | undefined, field: string) {
  const v = value?.trim();
  if (!v) return null;
  const p = normalizePhone(v);
  if (!p) throw new AppError("Số điện thoại không hợp lệ.", { [field]: "Số điện thoại không hợp lệ" });
  return p;
}

export async function updateShopSettings(input: ShopSettingsInput) {
  const shopName = input.shopName.trim();
  if (!shopName) throw new AppError("Vui lòng nhập tên shop.", { shopName: "Bắt buộc" });
  const data = {
    shopName,
    phone: cleanPhone(input.phone, "phone"),
    zaloPhone: cleanPhone(input.zaloPhone, "zaloPhone"),
    facebookUrl: cleanUrl(input.facebookUrl, "facebookUrl", ["facebook.com", "fb.com"]),
    messengerUrl: cleanUrl(input.messengerUrl, "messengerUrl", ["m.me", "messenger.com", "facebook.com"]),
    tiktokUrl: cleanUrl(input.tiktokUrl, "tiktokUrl", ["tiktok.com"]),
  };
  return prisma.shopSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}
