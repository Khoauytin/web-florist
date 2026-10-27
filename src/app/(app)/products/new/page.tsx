import { requireOwnerPage } from "@/server/auth/session";
import { listCategories } from "@/server/services/catalog.service";
import { ProductForm } from "@/components/products/product-form";

export const metadata = { title: "Thêm sản phẩm" };

export default async function NewProductPage() {
  await requireOwnerPage();
  const categories = await listCategories();
  return (
    <>
      <div className="pagehead">
        <h1>Thêm sản phẩm</h1>
      </div>
      <ProductForm
        productId={null}
        categories={categories}
        initial={{ code: "", name: "", categoryId: "", description: "", size: "", color: "", price: "", costPrice: "", fulfillmentMode: "FLEXIBLE", status: "ACTIVE" }}
      />
    </>
  );
}
