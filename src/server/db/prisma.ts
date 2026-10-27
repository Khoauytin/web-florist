import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Client handed to `prisma.$transaction(async (tx) => ...)`. */
export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Lock product rows in a fixed order so concurrent confirmations cannot deadlock or oversell. */
export async function lockProducts(tx: Tx, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)].sort();
  if (!unique.length) return;
  await tx.$queryRaw`SELECT id FROM products WHERE id = ANY(${unique}::uuid[]) ORDER BY id FOR UPDATE`;
}

export async function lockOrder(tx: Tx, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
}
