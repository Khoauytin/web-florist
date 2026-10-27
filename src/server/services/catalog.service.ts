import type { Prisma } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/server/db/prisma";
import { AppError, NotFoundError } from "@/server/errors";
import { PREFIX_RE, formatProductCode } from "@/server/domain/product-code";
import { storage } from "@/server/storage";

// ===== Categories =====

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: { where: { isArchived: false } } } } },
  });
}

function cleanCategory(input: { name: string; codePrefix: string }) {
  const name = input.name.trim();
  const codePrefix = input.codePrefix.trim().toUpperCase();
  const errors: Record<string, string> = {};
  if (!name) errors.name = "Bắt buộc";
  if (!PREFIX_RE.test(codePrefix)) errors.codePrefix = "1 đến 6 chữ cái in hoa, không dấu";
  if (Object.keys(errors).length) throw new AppError("Vui lòng kiểm tra lại danh mục.", errors);
  return { name, codePrefix };
}

async function assertCategoryUnique(data: { name: string; codePrefix: string }, exceptId?: string) {
  const clash = await prisma.category.findFirst({
    where: { OR: [{ name: data.name }, { codePrefix: data.codePrefix }], ...(exceptId ? { NOT: { id: exceptId } } : {}) },
  });
  if (clash?.name === data.name) throw new AppError("Tên danh mục đã có.", { name: "Đã có" });
  if (clash) throw new AppError(`Tiền tố ${data.codePrefix} đang dùng cho danh mục ${clash.name}.`, { codePrefix: "Đã dùng" });
}

export async function createCategory(input: { name: string; codePrefix: string }) {
  const data = cleanCategory(input);
  await assertCategoryUnique(data);
  const max = await prisma.category.aggregate({ _max: { sortOrder: true } });
  return prisma.category.create({ data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
}

/** Changing the prefix only affects products created afterwards; existing codes never change. */
export async function updateCategory(id: string, input: { name: string; codePrefix: string; isVisible: boolean }) {
  const data = cleanCategory(input);
  await assertCategoryUnique(data, id);
  return prisma.category.update({ where: { id }, data: { ...data, isVisible: input.isVisible } });
}

export async function setCategoryVisible(id: string, isVisible: boolean) {
  return prisma.category.update({ where: { id }, data: { isVisible } });
}

export async function moveCategory(id: string, direction: "up" | "down") {
  const all = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const idx = all.findIndex((c) => c.id === id);
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= all.length) return;
  [all[idx], all[swap]] = [all[swap], all[idx]];
  await prisma.$transaction(all.map((c, i) => prisma.category.update({ where: { id: c.id }, data: { sortOrder: i } })));
}

/** Categories are deleted only when no product, including archived ones, still belongs to them. */
export async function deleteCategory(id: string) {
  const category = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
  if (!category) throw new NotFoundError("Không tìm thấy danh mục.");
  if (category._count.products) throw new AppError(`Không thể xóa danh mục vì còn ${category._count.products} sản phẩm. Hãy chuyển hoặc xóa các sản phẩm trước.`);
  await prisma.category.delete({ where: { id } });
  return category;
}

// ===== Product codes =====

/**
 * Next code for a prefix, safe under concurrency. The counter row is created on first use from the
 * highest existing code with that prefix (so imported BO-054 continues at BO-055).
 */
export async function nextProductCode(tx: Tx, prefix: string): Promise<string> {
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO product_code_counters (prefix, last_seq)
    VALUES (${prefix}, (
      SELECT COALESCE(MAX(substring(code FROM '[0-9]+$')::int), 0) + 1
      FROM products WHERE code LIKE ${prefix + "-%"}
    ))
    ON CONFLICT (prefix) DO UPDATE SET last_seq = product_code_counters.last_seq + 1
    RETURNING last_seq`;
  return formatProductCode(prefix, rows[0].last_seq);
}

/** Code the next product of a category would get (display only, not reserved). */
export async function previewProductCode(categoryId: string): Promise<string | null> {
  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!cat) return null;
  const counter = await prisma.productCodeCounter.findUnique({ where: { prefix: cat.codePrefix } });
  if (counter) return formatProductCode(cat.codePrefix, counter.lastSeq + 1);
  const rows = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COALESCE(MAX(substring(code FROM '[0-9]+$')::int), 0) + 1 AS n FROM products WHERE code LIKE ${cat.codePrefix + "-%"}`;
  return formatProductCode(cat.codePrefix, Number(rows[0].n));
}

// ===== Products =====

export interface ProductFilter {
  q?: string;
  categoryId?: string;
  visibility?: "visible" | "hidden" | "noprice";
}

export async function listProducts(f: ProductFilter) {
  const q = f.q?.trim();
  const where: Prisma.ProductWhereInput = {
    isArchived: false,
    ...(f.categoryId ? { categoryId: f.categoryId } : {}),
    ...(f.visibility === "visible" ? { isVisible: true } : f.visibility === "hidden" ? { isVisible: false } : f.visibility === "noprice" ? { price: null } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } : {}),
  };
  return prisma.product.findMany({
    where,
    orderBy: [{ category: { sortOrder: "asc" } }, { code: "asc" }],
    include: { category: { select: { name: true } }, images: { where: { isPrimary: true }, select: { url: true }, take: 1 } },
  });
}

export async function productCounts() {
  const groups = await prisma.product.groupBy({ by: ["categoryId"], where: { isArchived: false }, _count: { _all: true } });
  return new Map(groups.map((g) => [g.categoryId, g._count._all]));
}

export async function getProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: { category: true, images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] } },
  });
}

export interface ProductInput {
  name: string;
  categoryId: string;
  price: number | null;
  size?: string;
  color?: string;
  description?: string;
  isVisible: boolean;
}

function cleanProduct(input: ProductInput) {
  const name = input.name.trim();
  const errors: Record<string, string> = {};
  if (!name) errors.name = "Bắt buộc";
  if (!input.categoryId) errors.categoryId = "Chọn danh mục";
  if (input.price !== null && (!Number.isInteger(input.price) || input.price < 0 || input.price > 2_000_000_000)) errors.price = "Giá không hợp lệ";
  if (Object.keys(errors).length) throw new AppError("Vui lòng kiểm tra lại thông tin sản phẩm.", errors);
  return {
    name,
    categoryId: input.categoryId,
    price: input.price,
    size: input.size?.trim() || null,
    color: input.color?.trim() || null,
    description: input.description?.trim() || null,
    isVisible: input.isVisible,
  };
}

/** The code is generated here from the category prefix; the form has no code field. */
export async function createProduct(input: ProductInput) {
  const data = cleanProduct(input);
  return prisma.$transaction(async (tx) => {
    const cat = await tx.category.findUnique({ where: { id: data.categoryId } });
    if (!cat) throw new AppError("Danh mục không tồn tại.", { categoryId: "Chọn danh mục" });
    const code = await nextProductCode(tx, cat.codePrefix);
    return tx.product.create({ data: { ...data, code } });
  });
}

export async function updateProduct(id: string, input: ProductInput) {
  const data = cleanProduct(input);
  const exists = await prisma.product.findUnique({ where: { id } });
  if (!exists) throw new NotFoundError("Không tìm thấy sản phẩm.");
  return prisma.product.update({ where: { id }, data });
}

export async function setProductVisible(id: string, isVisible: boolean) {
  return prisma.product.update({ where: { id }, data: { isVisible } });
}

/** Archived products disappear everywhere except old orders (which keep their snapshot). */
export async function archiveProduct(id: string) {
  return prisma.product.update({ where: { id }, data: { isArchived: true, isVisible: false } });
}

/** Hard delete is reserved for products that have never been used in an order. */
export async function deleteProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: { select: { storagePath: true } }, _count: { select: { orderItems: true } } },
  });
  if (!product) throw new NotFoundError("Không tìm thấy sản phẩm.");
  if (product._count.orderItems) throw new AppError(`Không thể xóa ${product.code} vì sản phẩm đã có trong đơn hàng. Hãy ẩn khỏi web hoặc lưu trữ sản phẩm.`);

  // Remove external files first so a storage failure leaves database rows available for retry.
  await Promise.all(product.images.map((image) => storage().remove(image.storagePath)));
  await prisma.$transaction(async (tx) => {
    await tx.productImage.deleteMany({ where: { productId: id } });
    await tx.product.delete({ where: { id } });
  });
  return product;
}

export interface QuickEditRow {
  id: string;
  name: string;
  price: number | null;
  isVisible: boolean;
}

/** "Sửa nhanh": save name, price and visibility of many products at once. */
export async function quickUpdate(rows: QuickEditRow[]) {
  if (rows.length > 500) throw new AppError("Tối đa 500 sản phẩm mỗi lần lưu.");
  for (const r of rows) {
    if (!r.name.trim()) throw new AppError("Tên sản phẩm không được để trống.");
    if (r.price !== null && (!Number.isInteger(r.price) || r.price < 0 || r.price > 2_000_000_000)) throw new AppError(`Giá của "${r.name}" không hợp lệ.`);
  }
  await prisma.$transaction(rows.map((r) => prisma.product.update({ where: { id: r.id }, data: { name: r.name.trim(), price: r.price, isVisible: r.isVisible } })));
  return rows.length;
}

/** Products the order form can pick from: every non-archived product (hidden ones too). */
export async function searchOrderableProducts(q: string, options: { categoryId?: string; take?: number } = {}) {
  const term = q.trim();
  return prisma.product.findMany({
    where: {
      isArchived: false,
      ...(options.categoryId ? { categoryId: options.categoryId } : {}),
      ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { code: { contains: term, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ isVisible: "desc" }, { category: { sortOrder: "asc" } }, { code: "asc" }],
    take: options.take ?? 100,
    select: {
      id: true,
      code: true,
      name: true,
      price: true,
      images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
    },
  });
}

// ===== Public catalog =====

/** What the public site shows: visible categories with their visible, non-archived products. */
export async function publicCatalog() {
  const categories = await prisma.category.findMany({
    where: { isVisible: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      products: {
        where: { isVisible: true, isArchived: false },
        orderBy: { code: "asc" },
        include: { images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], select: { url: true } } },
      },
    },
  });
  return categories.filter((c) => c.products.length);
}
