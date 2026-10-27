import type { FulfillmentMode, Prisma, ProductStatus } from "@/generated/prisma/client";
import { prisma, lockProducts } from "@/server/db/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/server/errors";
import { audit } from "@/server/services/audit.service";
import { formatMoney } from "@/lib/format";
import type { CurrentUser } from "@/server/auth/session";

function ownerOnly(actor: CurrentUser) {
  if (actor.role !== "owner") throw new ForbiddenError("Chỉ chủ shop được thay đổi danh mục và sản phẩm.");
}

// ===== Categories =====

export async function listCategories(opts: { activeOnly?: boolean } = {}) {
  return prisma.category.findMany({
    where: opts.activeOnly ? { isActive: true } : {},
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
}

export async function createCategory(actor: CurrentUser, input: { name: string; description?: string }) {
  ownerOnly(actor);
  const name = input.name.trim();
  if (!name) throw new AppError("Vui lòng nhập tên danh mục.", { name: "Bắt buộc" });
  return prisma.$transaction(async (tx) => {
    const max = await tx.category.aggregate({ _max: { sortOrder: true } });
    const c = await tx.category.create({
      data: { name, description: input.description?.trim() || null, sortOrder: (max._max.sortOrder ?? 0) + 1, createdById: actor.id, updatedById: actor.id },
    });
    await audit(tx, { actorId: actor.id, action: "category.create", entityType: "category", entityId: c.id, summary: `Tạo danh mục ${name}` });
    return c;
  });
}

export async function updateCategory(actor: CurrentUser, id: string, input: { name: string; description?: string; isActive: boolean }) {
  ownerOnly(actor);
  const name = input.name.trim();
  if (!name) throw new AppError("Vui lòng nhập tên danh mục.", { name: "Bắt buộc" });
  return prisma.$transaction(async (tx) => {
    const c = await tx.category.update({
      where: { id },
      data: { name, description: input.description?.trim() || null, isActive: input.isActive, updatedById: actor.id },
    });
    await audit(tx, { actorId: actor.id, action: "category.update", entityType: "category", entityId: id, summary: `Sửa danh mục ${name}${input.isActive ? "" : " (ẩn)"}` });
    return c;
  });
}

/** Swap sort order with the neighbour above or below. */
export async function moveCategory(actor: CurrentUser, id: string, direction: "up" | "down") {
  ownerOnly(actor);
  const all = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const idx = all.findIndex((c) => c.id === id);
  const other = all[direction === "up" ? idx - 1 : idx + 1];
  if (idx < 0 || !other) return;
  await prisma.$transaction(async (tx) => {
    for (const [i, c] of all.entries()) {
      let order = i;
      if (c.id === id) order = direction === "up" ? i - 1 : i + 1;
      else if (c.id === other.id) order = idx;
      await tx.category.update({ where: { id: c.id }, data: { sortOrder: order } });
    }
    await audit(tx, { actorId: actor.id, action: "category.move", entityType: "category", entityId: id, summary: `Đưa danh mục ${all[idx].name} ${direction === "up" ? "lên" : "xuống"}` });
  });
}

// ===== Products =====

export interface ProductFilter {
  q?: string;
  categoryId?: string;
  status?: ProductStatus | "ALL";
  activeOnly?: boolean;
  noPrice?: boolean;
}

export async function listProducts(f: ProductFilter, page = 1, pageSize = 60) {
  const q = f.q?.trim();
  const where: Prisma.ProductWhereInput = {
    ...(f.categoryId ? { categoryId: f.categoryId } : {}),
    ...(f.noPrice ? { price: null } : {}),
    ...(f.activeOnly ? { status: "ACTIVE" } : f.status && f.status !== "ALL" ? { status: f.status } : { status: { not: "ARCHIVED" } }),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ category: { sortOrder: "asc" } }, { code: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: { select: { name: true } }, images: { where: { isPrimary: true }, select: { url: true }, take: 1 } },
    }),
    prisma.product.count({ where }),
  ]);
  return { rows, total, pageSize };
}

export async function productCountsByCategory() {
  const groups = await prisma.product.groupBy({ by: ["categoryId"], where: { status: { not: "ARCHIVED" } }, _count: { _all: true } });
  return new Map(groups.map((g) => [g.categoryId, g._count._all]));
}

/** `includeCost` must be false for staff: cost price is removed here, not only hidden in the UI. */
export async function getProduct(id: string, opts: { includeCost: boolean }) {
  const p = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
  });
  return p && !opts.includeCost ? { ...p, costPrice: null } : p;
}

export interface ProductInput {
  code: string;
  name: string;
  categoryId: string;
  description?: string;
  size?: string;
  color?: string;
  price: number | null;
  costPrice: number | null;
  fulfillmentMode: FulfillmentMode;
  status: ProductStatus;
}

function cleanProduct(input: ProductInput) {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  const errors: Record<string, string> = {};
  if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(code)) errors.code = "Mã gồm chữ, số, gạch ngang (2-24 ký tự)";
  if (!name) errors.name = "Bắt buộc";
  if (!input.categoryId) errors.categoryId = "Chọn danh mục";
  if (input.price !== null && (!Number.isInteger(input.price) || input.price < 0)) errors.price = "Giá không hợp lệ";
  if (input.costPrice !== null && (!Number.isInteger(input.costPrice) || input.costPrice < 0)) errors.costPrice = "Giá vốn không hợp lệ";
  if (Object.keys(errors).length) throw new AppError("Vui lòng kiểm tra lại thông tin sản phẩm.", errors);
  return {
    code,
    name,
    categoryId: input.categoryId,
    description: input.description?.trim() || null,
    size: input.size?.trim() || null,
    color: input.color?.trim() || null,
    price: input.price,
    costPrice: input.costPrice,
    fulfillmentMode: input.fulfillmentMode,
    status: input.status,
  };
}

export async function createProduct(actor: CurrentUser, input: ProductInput) {
  ownerOnly(actor);
  const data = cleanProduct(input);
  if (await prisma.product.findUnique({ where: { code: data.code } })) throw new AppError("Mã sản phẩm đã tồn tại.", { code: "Đã tồn tại" });
  return prisma.$transaction(async (tx) => {
    const p = await tx.product.create({ data: { ...data, createdById: actor.id, updatedById: actor.id } });
    await audit(tx, { actorId: actor.id, action: "product.create", entityType: "product", entityId: p.id, summary: `Tạo sản phẩm ${p.code} ${p.name}, giá ${formatMoney(p.price)}` });
    return p;
  });
}

export async function updateProduct(actor: CurrentUser, id: string, input: ProductInput) {
  ownerOnly(actor);
  const data = cleanProduct(input);
  return prisma.$transaction(async (tx) => {
    await lockProducts(tx, [id]);
    const before = await tx.product.findUnique({ where: { id } });
    if (!before) throw new NotFoundError("Không tìm thấy sản phẩm.");
    if (data.code !== before.code && (await tx.product.findUnique({ where: { code: data.code } }))) {
      throw new AppError("Mã sản phẩm đã tồn tại.", { code: "Đã tồn tại" });
    }
    if (data.fulfillmentMode === "MADE_TO_ORDER" && before.onHand > 0) {
      throw new AppError(`Sản phẩm đang có ${before.onHand} trong kho. Điều chỉnh tồn về 0 trước khi chuyển sang Làm theo đơn.`, {
        fulfillmentMode: "Còn hàng trong kho",
      });
    }
    const p = await tx.product.update({ where: { id }, data: { ...data, updatedById: actor.id } });
    const changes: string[] = [];
    if (before.price !== p.price) changes.push(`giá ${formatMoney(before.price)} → ${formatMoney(p.price)}`);
    if (before.status !== p.status) changes.push(`trạng thái ${before.status} → ${p.status}`);
    if (before.fulfillmentMode !== p.fulfillmentMode) changes.push(`phương thức ${before.fulfillmentMode} → ${p.fulfillmentMode}`);
    await audit(tx, {
      actorId: actor.id,
      action: "product.update",
      entityType: "product",
      entityId: id,
      summary: `Sửa sản phẩm ${p.code}${changes.length ? `: ${changes.join(", ")}` : ""}`,
    });
    return p;
  });
}

/** Products a new order can use: active, priced. */
export async function searchOrderableProducts(q: string, take = 20) {
  const term = q.trim();
  return prisma.product.findMany({
    where: {
      status: "ACTIVE",
      ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { code: { contains: term, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { code: "asc" }],
    take,
    select: {
      id: true,
      code: true,
      name: true,
      price: true,
      fulfillmentMode: true,
      onHand: true,
      reserved: true,
      images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
    },
  });
}
