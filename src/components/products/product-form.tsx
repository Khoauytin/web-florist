"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Icon } from "@/components/icon";
import { Field, FormAlert, SubmitButton, fieldAria } from "@/components/form";
import { toast } from "@/components/ui";
import { saveProductAction, type ProductActionState } from "@/server/actions/catalog.actions";
import { FULFILLMENT_HINTS, FULFILLMENT_LABELS, PRODUCT_STATUS_LABELS } from "@/lib/labels";

export interface ProductFormValues {
  code: string;
  name: string;
  categoryId: string;
  description: string;
  size: string;
  color: string;
  price: string;
  costPrice: string;
  fulfillmentMode: keyof typeof FULFILLMENT_LABELS;
  status: keyof typeof PRODUCT_STATUS_LABELS;
}

export function ProductForm({ productId, initial, categories }: { productId: string | null; initial: ProductFormValues; categories: { id: string; name: string; isActive: boolean }[] }) {
  const router = useRouter();
  const [state, action] = useActionState<ProductActionState, FormData>(saveProductAction.bind(null, productId), { ok: false });
  const fe = state.fieldErrors ?? {};
  useEffect(() => {
    if (state.ok && state.id) {
      toast(state.message ?? "Đã lưu");
      router.push(`/products/${state.id}`);
    }
  }, [state, router]);

  return (
    <form action={action} className="stack-lg" style={{ maxWidth: 760 }}>
      <FormAlert state={state.ok ? { ok: false } : state} />
      <section className="stack" aria-labelledby="p-info">
        <h2 id="p-info">Thông tin</h2>
        <div className="row2">
          <Field label="Mã sản phẩm" name="code" error={fe.code} hint="Ví dụ HS-001. Chữ, số và gạch ngang." required>
            <input className="input" defaultValue={initial.code} maxLength={24} autoCapitalize="characters" required {...fieldAria("code", fe.code, "x")} />
          </Field>
          <Field label="Danh mục" name="categoryId" error={fe.categoryId} required>
            <select className="select" defaultValue={initial.categoryId} required {...fieldAria("categoryId", fe.categoryId)}>
              <option value="">Chọn danh mục</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isActive ? "" : " (đang ẩn)"}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Tên sản phẩm" name="name" error={fe.name} required>
          <input className="input" defaultValue={initial.name} maxLength={200} required {...fieldAria("name", fe.name)} />
        </Field>
        <div className="row2">
          <Field label="Kích thước" name="size">
            <input className="input" defaultValue={initial.size} maxLength={120} {...fieldAria("size")} />
          </Field>
          <Field label="Màu sắc" name="color">
            <input className="input" defaultValue={initial.color} maxLength={120} {...fieldAria("color")} />
          </Field>
        </div>
        <Field label="Mô tả" name="description">
          <textarea className="textarea" defaultValue={initial.description} maxLength={2000} {...fieldAria("description")} />
        </Field>
      </section>

      <section className="stack" aria-labelledby="p-price">
        <h2 id="p-price">Giá</h2>
        <div className="row2">
          <Field label="Giá bán (đ)" name="price" error={fe.price} hint="Để trống nếu chưa có giá. Sản phẩm chưa có giá không thêm vào đơn được.">
            <input className="input" inputMode="numeric" defaultValue={initial.price} placeholder="Ví dụ 350.000" {...fieldAria("price", fe.price, "x")} />
          </Field>
          <Field label="Giá vốn (đ)" name="costPrice" error={fe.costPrice} hint="Chỉ chủ shop nhìn thấy.">
            <input className="input" inputMode="numeric" defaultValue={initial.costPrice} {...fieldAria("costPrice", fe.costPrice, "x")} />
          </Field>
        </div>
      </section>

      <section className="stack" aria-labelledby="p-mode">
        <h2 id="p-mode">Phương thức đáp ứng</h2>
        <fieldset className="stack" style={{ border: 0, margin: 0, padding: 0 }} aria-describedby={fe.fulfillmentMode ? "fm-err" : undefined}>
          <legend className="sr">Phương thức đáp ứng</legend>
          {(Object.keys(FULFILLMENT_LABELS) as (keyof typeof FULFILLMENT_LABELS)[]).map((m) => (
            <label key={m} className="checkbox" style={{ alignItems: "flex-start" }}>
              <input type="radio" name="fulfillmentMode" value={m} defaultChecked={initial.fulfillmentMode === m} style={{ marginTop: 2 }} />
              <span>
                {FULFILLMENT_LABELS[m]}
                <span className="small muted" style={{ display: "block", fontWeight: 400 }}>
                  {FULFILLMENT_HINTS[m]}
                </span>
              </span>
            </label>
          ))}
          {fe.fulfillmentMode ? (
            <span className="err small" id="fm-err" style={{ color: "var(--danger)" }}>
              {fe.fulfillmentMode}
            </span>
          ) : null}
        </fieldset>
        <Field label="Trạng thái" name="status">
          <select className="select" defaultValue={initial.status} {...fieldAria("status")} style={{ maxWidth: 360 }}>
            {(Object.keys(PRODUCT_STATUS_LABELS) as (keyof typeof PRODUCT_STATUS_LABELS)[]).map((s) => (
              <option key={s} value={s}>
                {PRODUCT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <div className="actions">
        <SubmitButton>{productId ? "Lưu sản phẩm" : "Tạo sản phẩm"}</SubmitButton>
        <Link className="btn btn-secondary" href={productId ? `/products/${productId}` : "/products"}>
          <Icon name="back" />
          Hủy
        </Link>
      </div>
    </form>
  );
}
