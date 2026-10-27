import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { AppError, NotFoundError } from "@/server/errors";
import { normalizePhone } from "@/server/domain/phone";

export interface CustomerInput {
  name: string;
  phone: string;
  address?: string;
  note?: string;
}

function clean(input: CustomerInput) {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  if (!name) errors.name = "Bắt buộc";
  if (!phone) errors.phone = "Số điện thoại không hợp lệ";
  if (Object.keys(errors).length) throw new AppError("Vui lòng kiểm tra lại thông tin khách hàng.", errors);
  return { name, phone: phone!, address: input.address?.trim() || null, note: input.note?.trim() || null };
}

export async function createCustomer(input: CustomerInput) {
  const data = clean(input);
  const dup = await prisma.customer.findUnique({ where: { phone: data.phone } });
  if (dup) throw new AppError(`Số điện thoại này đã thuộc về khách ${dup.name}.`, { phone: "Đã có khách dùng số này" });
  return prisma.customer.create({ data });
}

export async function updateCustomer(id: string, input: CustomerInput) {
  const data = clean(input);
  const dup = await prisma.customer.findUnique({ where: { phone: data.phone } });
  if (dup && dup.id !== id) throw new AppError(`Số điện thoại này đã thuộc về khách ${dup.name}.`, { phone: "Đã có khách dùng số này" });
  return prisma.customer.update({ where: { id }, data });
}

export async function findCustomerByPhone(raw: string) {
  const phone = normalizePhone(raw);
  if (!phone) return null;
  return prisma.customer.findUnique({ where: { phone } });
}

/** Order count (all but cancelled) and money spent (completed only) per customer. */
async function statsFor(ids: string[]) {
  const stats = new Map<string, { orders: number; spent: number }>();
  if (!ids.length) return stats;
  const [counts, spent] = await Promise.all([
    prisma.order.groupBy({ by: ["customerId"], where: { customerId: { in: ids }, status: { not: "CANCELLED" } }, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["customerId"], where: { customerId: { in: ids }, status: "COMPLETED" }, _sum: { total: true } }),
  ]);
  for (const id of ids) stats.set(id, { orders: 0, spent: 0 });
  for (const c of counts) stats.get(c.customerId)!.orders = c._count._all;
  for (const s of spent) stats.get(s.customerId)!.spent = s._sum.total ?? 0;
  return stats;
}

export async function listCustomers(q?: string) {
  const term = q?.trim();
  let where: Prisma.CustomerWhereInput = {};
  if (term) {
    const digits = term.replace(/\D/g, "");
    const local = digits.startsWith("84") ? "0" + digits.slice(2) : digits;
    where = { OR: [{ name: { contains: term, mode: "insensitive" } }, ...(digits.length >= 3 ? [{ phone: { contains: local } }] : [])] };
  }
  const rows = await prisma.customer.findMany({ where, orderBy: { updatedAt: "desc" }, take: 200 });
  const stats = await statsFor(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, stats: stats.get(r.id)! }));
}

export async function getCustomer(id: string) {
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c) throw new NotFoundError("Không tìm thấy khách hàng.");
  return { ...c, stats: (await statsFor([id])).get(id)! };
}
