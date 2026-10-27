import { notFound } from "next/navigation";
import { requireOwnerPage } from "@/server/auth/session";
import { getProduct, listCategories } from "@/server/services/catalog.service";
import { ProductForm } from "@/components/products/product-form";
import { formatNumber } from "@/lib/format";

export const metadata = { title: "Sửa sản phẩm" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwnerPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [product, categories] = await Promise.all([getProduct(id, { includeCost: true }), listCategories()]);
  if (!product) notFound();
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Sửa sản phẩm</h1>
          <p className="sub">Đổi tên hoặc giá không ảnh hưởng đơn cũ: mỗi đơn giữ nguyên tên và giá lúc đặt.</p>
        </div>
      </div>
      <ProductForm
        productId={product.id}
        categories={categories}
        initial={{
          code: product.code,
          name: product.name,
          categoryId: product.categoryId,
          description: product.description ?? "",
          size: product.size ?? "",
          color: product.color ?? "",
          price: product.price === null ? "" : formatNumber(product.price),
          costPrice: product.costPrice === null ? "" : formatNumber(product.costPrice),
          fulfillmentMode: product.fulfillmentMode,
          status: product.status,
        }}
      />
    </>
  );
}
