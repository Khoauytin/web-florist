import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/server/db/prisma";
import { AppError, NotFoundError } from "@/server/errors";
import { storage } from "@/server/storage";

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 8;

/** Resize to at most 1200px on the long edge and store as WebP (keeps the 3:4 catalog shots). */
export async function processImage(input: Buffer): Promise<Buffer> {
  return sharp(input).rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}

export async function addProductImage(productId: string, file: { bytes: Buffer; type: string }) {
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
  return prisma.productImage.create({
    data: { productId, storagePath: key, url, isPrimary: product._count.images === 0, sortOrder: product._count.images },
  });
}

export async function setPrimaryImage(imageId: string) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) throw new NotFoundError("Không tìm thấy ảnh.");
  await prisma.$transaction(async (tx) => {
    await tx.productImage.updateMany({ where: { productId: image.productId, isPrimary: true }, data: { isPrimary: false } });
    await tx.productImage.update({ where: { id: imageId }, data: { isPrimary: true } });
  });
  return image.productId;
}

export async function removeProductImage(imageId: string) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) throw new NotFoundError("Không tìm thấy ảnh.");
  // Keep the row available for retry when the external storage operation fails.
  await storage().remove(image.storagePath);
  await prisma.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { id: imageId } });
    if (image.isPrimary) {
      const next = await tx.productImage.findFirst({ where: { productId: image.productId }, orderBy: { sortOrder: "asc" } });
      if (next) await tx.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  });
  return image.productId;
}
