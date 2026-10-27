import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/server/db/prisma";
import { AppError, NotFoundError } from "@/server/errors";
import { storage } from "@/server/storage";
import { audit } from "@/server/services/audit.service";
import type { CurrentUser } from "@/server/auth/session";

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 8;

/** Resize to at most 1200px on the long edge and store as WebP. */
export async function processImage(input: Buffer): Promise<Buffer> {
  return sharp(input).rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}

export async function addProductImage(actor: CurrentUser, productId: string, file: { bytes: Buffer; type: string }) {
  if (actor.role !== "owner") throw new AppError("Chỉ chủ shop được sửa ảnh sản phẩm.");
  if (!file.type.startsWith("image/")) throw new AppError("Tệp phải là ảnh.");
  if (file.bytes.length > MAX_INPUT_BYTES) throw new AppError("Ảnh quá lớn (tối đa 8 MB).");
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { _count: { select: { images: true } } } });
  if (!product) throw new NotFoundError("Không tìm thấy sản phẩm.");
  if (product._count.images >= MAX_IMAGES) throw new AppError(`Mỗi sản phẩm tối đa ${MAX_IMAGES} ảnh.`);
  let webp: Buffer;
  try {
    webp = await processImage(file.bytes);
  } catch {
    throw new AppError("Không đọc được ảnh. Hãy thử ảnh JPG hoặc PNG khác.");
  }
  const key = `products/${productId}/${randomUUID()}.webp`;
  const { url } = await storage().put(key, webp, "image/webp");
  return prisma.$transaction(async (tx) => {
    const isPrimary = product._count.images === 0;
    const image = await tx.productImage.create({
      data: { productId, storagePath: key, url, isPrimary, sortOrder: product._count.images },
    });
    await audit(tx, { actorId: actor.id, action: "product.image_add", entityType: "product", entityId: productId, summary: `Thêm ảnh cho ${product.name}` });
    return image;
  });
}

export async function setPrimaryImage(actor: CurrentUser, imageId: string) {
  if (actor.role !== "owner") throw new AppError("Chỉ chủ shop được sửa ảnh sản phẩm.");
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) throw new NotFoundError("Không tìm thấy ảnh.");
  await prisma.$transaction(async (tx) => {
    await tx.productImage.updateMany({ where: { productId: image.productId, isPrimary: true }, data: { isPrimary: false } });
    await tx.productImage.update({ where: { id: imageId }, data: { isPrimary: true } });
    await audit(tx, { actorId: actor.id, action: "product.image_primary", entityType: "product", entityId: image.productId, summary: "Đổi ảnh chính của sản phẩm" });
  });
}

export async function removeProductImage(actor: CurrentUser, imageId: string) {
  if (actor.role !== "owner") throw new AppError("Chỉ chủ shop được sửa ảnh sản phẩm.");
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) throw new NotFoundError("Không tìm thấy ảnh.");
  await prisma.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { id: imageId } });
    if (image.isPrimary) {
      const next = await tx.productImage.findFirst({ where: { productId: image.productId }, orderBy: { sortOrder: "asc" } });
      if (next) await tx.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    await audit(tx, { actorId: actor.id, action: "product.image_remove", entityType: "product", entityId: image.productId, summary: "Xóa một ảnh sản phẩm" });
  });
  await storage().remove(image.storagePath);
}
