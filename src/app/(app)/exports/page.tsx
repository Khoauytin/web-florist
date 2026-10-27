import { requireOwnerPage } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { listCategories } from "@/server/services/catalog.service";
import { formatPhone } from "@/server/domain/phone";
import { ExportForm } from "@/components/exports/export-form";
import { todayVn } from "@/lib/dates";

export const metadata = { title: "Xuất Excel" };

export default async function ExportsPage() {
  await requireOwnerPage();
  const [categories, customers, products] = await Promise.all([
    listCategories(),
    prisma.customer.findMany({ orderBy: { updatedAt: "desc" }, take: 300, select: { id: true, name: true, phone: true } }),
    prisma.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Xuất Excel</h1>
          <p className="sub">Tạo file .xlsx gồm 5 sheet theo bộ lọc. Excel chỉ để xem và xử lý, dữ liệu gốc vẫn nằm trong hệ thống.</p>
        </div>
      </div>
      <ExportForm
        today={todayVn()}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        customers={customers.map((c) => ({ ...c, phone: formatPhone(c.phone) }))}
        products={products}
      />
    </>
  );
}
