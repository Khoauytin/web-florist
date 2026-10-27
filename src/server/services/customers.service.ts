import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { AppError, NotFoundError } from "@/server/errors";
import { normalizePhone } from "@/server/domain/phone";
import { audit } from "@/server/services/audit.service";
import type { CurrentUser } from "@/server/auth/session";

export interface CustomerInput {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  note?: string;
}

function clean(input: CustomerInput) {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  const email = input.email?.trim() || null;
  if (!name) errors.name = "Bắt buộc";
  if (!phone) errors.phone = "Số điện thoại không hợp lệ";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Email không hợp lệ";
  if (Object.keys(errors).length) throw new AppError("Vui lòng kiểm tra lại thông tin khách hàng.", errors);
  return { name, phone: phone!, email, address: input.address?.trim() || null, note: input.note?.trim() || null };
}

export async function createCustomer(actor: CurrentUser, input: CustomerInput) {
  const data = clean(input);
  const dup = await prisma.customer.findUnique({ where: { phone: data.phone } });
  if (dup) throw new AppError(`Số điện thoại này đã thuộc về khách ${dup.name}.`, { phone: "Đã có khách dùng số này" });
  return prisma.$transaction(async (tx) => {
    const c = await tx.customer.create({ data: { ...data, createdById: actor.id, updatedById: actor.id } });
    await audit(tx, { actorId: actor.id, action: "customer.create", entityType: "customer", entityId: c.id, summary: `Tạo khách ${c.name}` });
    return c;
  });
}

export async function updateCustomer(actor: CurrentUser, id: string, input: CustomerInput) {
  const data = clean(input);
  const dup = await prisma.customer.findUnique({ where: { phone: data.phone } });
  if (dup && dup.id !== id) throw new AppError(`Số điện thoại này đã thuộc về khách ${dup.name}.`, { phone: "Đã có khách dùng số này" });
  return prisma.$transaction(async (tx) => {
    const c = await tx.customer.update({ where: { id }, data: { ...data, updatedById: actor.id } });
    await audit(tx, { actorId: actor.id, action: "customer.update", entityType: "customer", entityId: id, summary: `Sửa thông tin khách ${c.name}` });
    return c;
  });
}

export async function findCustomerByPhone(raw: string) {
  const phone = normalizePhone(raw);
  if (!phone) return null;
  return prisma.customer.findUnique({ where: { phone } });
}

/** Completed-order stats per customer (spec 3.5: computed, not stored). */
async function statsFor(ids: string[]) {
  if (!ids.length) return new Map<string, { count: number; spent: number; last: Date | null }>();
  const groups = await prisma.order.groupBy({
    by: ["customerId"],
    where: { customerId: { in: ids }, status: "COMPLETED" },
    _count: { _all: true },
    _sum: { total: true },
    _max: { completedAt: true },
  });
  return new Map(groups.map((g) => [g.customerId, { count: g._count._all, spent: g._sum.total ?? 0, last: g._max.completedAt }]));
}

export async function listCustomers(q: string | undefined, page = 1, pageSize = 40) {
  const term = q?.trim();
  let where: Prisma.CustomerWhereInput = {};
  if (term) {
    const digits = term.replace(/\D/g, "");
    const local = digits.startsWith("84") ? "0" + digits.slice(2) : digits;
    where = { OR: [{ name: { contains: term, mode: "insensitive" } }, ...(digits.length >= 3 ? [{ phone: { contains: local } }] : [])] };
  }
  const [rows, total] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.customer.count({ where }),
  ]);
  const stats = await statsFor(rows.map((r) => r.id));
  return { rows: rows.map((r) => ({ ...r, stats: stats.get(r.id) ?? { count: 0, spent: 0, last: null } })), total, pageSize };
}

export async function getCustomer(id: string) {
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c) throw new NotFoundError("Không tìm thấy khách hàng.");
  const stats = (await statsFor([id])).get(id) ?? { count: 0, spent: 0, last: null };
  return { ...c, stats };
}
