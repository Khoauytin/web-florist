import { requireOwnerPage } from "@/server/auth/session";
import { listCategories } from "@/server/services/catalog.service";
import { CategoryManager } from "@/components/catalog/category-manager";

export const metadata = { title: "Danh mục" };

export default async function CategoriesPage() {
  await requireOwnerPage();
  const categories = await listCategories();
  return (
    <CategoryManager
      categories={categories.map((c) => ({ id: c.id, name: c.name, description: c.description, isActive: c.isActive, productCount: c._count.products }))}
    />
  );
}
