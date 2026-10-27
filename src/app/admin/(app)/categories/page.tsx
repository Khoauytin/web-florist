import Link from "next/link";
import { listCategories, previewProductCode } from "@/server/services/catalog.service";
import { Icon } from "@/components/admin/icon";
import { CategoryManager } from "@/components/admin/category-manager";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Danh mục" };

export default async function CategoriesPage() {
  await requireUser();
  const categories = await listCategories();
  const rows = await Promise.all(
    categories.map(async (c) => ({ id: c.id, name: c.name, codePrefix: c.codePrefix, isVisible: c.isVisible, count: c._count.products, nextCode: (await previewProductCode(c.id)) ?? "" })),
  );
  return (
    <>
      <Link className="back" href="/admin/products">
        <Icon name="back" />
        Sản phẩm
      </Link>
      <CategoryManager rows={rows} />
    </>
  );
}
