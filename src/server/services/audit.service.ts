import type { Prisma } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/server/db/prisma";
import { vnDayRange, type Ymd } from "@/lib/dates";

export interface AuditEntry {
  actorId: string;
  action: string;
  entityType: "order" | "product" | "customer" | "user" | "category" | "payment";
  entityId: string;
  summary: string;
  data?: Prisma.InputJsonValue;
}

/** Always call inside the same transaction as the change it describes. */
export async function audit(tx: Tx, entry: AuditEntry) {
  await tx.auditLog.create({ data: entry });
}

export const AUDIT_ENTITY_LABELS: Record<AuditEntry["entityType"], string> = {
  order: "Đơn hàng",
  product: "Sản phẩm",
  customer: "Khách hàng",
  user: "Tài khoản",
  category: "Danh mục",
  payment: "Thanh toán",
};

export async function listAudit(opts: {
  from: Ymd;
  to: Ymd;
  entityType?: string;
  entityId?: string;
  page: number;
  pageSize?: number;
}) {
  const pageSize = opts.pageSize ?? 50;
  const where: Prisma.AuditLogWhereInput = {
    createdAt: vnDayRange(opts.from, opts.to),
    ...(opts.entityType ? { entityType: opts.entityType } : {}),
    ...(opts.entityId ? { entityId: opts.entityId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { name: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { rows, total, pageSize };
}

export async function entityHistory(entityType: AuditEntry["entityType"], entityId: string, take = 30) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { name: true } } },
  });
}
