"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { FormAlert, SubmitButton } from "@/components/form";
import { Dialog, toast } from "@/components/ui";
import { moveCategoryAction, saveCategoryAction } from "@/server/actions/catalog.actions";
import type { ActionState } from "@/server/errors";

export interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  productCount: number;
}

function CategoryForm({ category, onDone }: { category: CategoryRow | null; onDone: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(saveCategoryAction.bind(null, category?.id ?? null), { ok: false });
  useEffect(() => {
    if (state.ok) {
      toast(state.message ?? "Đã lưu");
      onDone();
    }
  }, [state, onDone]);
  return (
    <form action={action} className="stack">
      <FormAlert state={state.ok ? { ok: false } : state} />
      <div className="field">
        <label htmlFor={`cat-name-${category?.id ?? "new"}`}>
          Tên danh mục<span className="req" aria-hidden="true">*</span>
        </label>
        <input id={`cat-name-${category?.id ?? "new"}`} name="name" className="input" defaultValue={category?.name} maxLength={80} required />
      </div>
      <div className="field">
        <label htmlFor={`cat-desc-${category?.id ?? "new"}`}>Mô tả</label>
        <input id={`cat-desc-${category?.id ?? "new"}`} name="description" className="input" defaultValue={category?.description ?? ""} maxLength={300} />
      </div>
      {category ? (
        <label className="checkbox">
          <input type="checkbox" name="isActive" defaultChecked={category.isActive} />
          Đang dùng (bỏ chọn để ẩn danh mục)
        </label>
      ) : null}
      <div>
        <SubmitButton>{category ? "Lưu" : "Thêm danh mục"}</SubmitButton>
      </div>
    </form>
  );
}

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CategoryRow | "new" | null>(null);
  const [pending, start] = useTransition();
  const done = () => {
    setEditing(null);
    router.refresh();
  };
  const move = (id: string, dir: "up" | "down") =>
    start(async () => {
      const r = await moveCategoryAction(id, dir);
      if (!r.ok) toast(r.error ?? "Có lỗi xảy ra");
      router.refresh();
    });

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Danh mục</h1>
          <p className="sub">Thứ tự ở đây là thứ tự hiển thị. Danh mục đã có sản phẩm không xóa được, chỉ ẩn.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setEditing("new")}>
          <Icon name="plus" />
          Thêm danh mục
        </button>
      </div>
      <div className="panel divide">
        {categories.map((c, i) => (
          <div key={c.id} className="pad" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center" }}>
            <div>
              <b>{c.name}</b> {!c.isActive ? <span className="tag">Đang ẩn</span> : null}
              <div className="small muted">
                {c.productCount} sản phẩm{c.description ? ` · ${c.description}` : ""}
              </div>
            </div>
            <div className="actions" style={{ gap: 4 }}>
              <button className="icon-btn" type="button" aria-label={`Đưa ${c.name} lên`} disabled={pending || i === 0} onClick={() => move(c.id, "up")}>
                <Icon name="up" />
              </button>
              <button className="icon-btn" type="button" aria-label={`Đưa ${c.name} xuống`} disabled={pending || i === categories.length - 1} onClick={() => move(c.id, "down")}>
                <Icon name="down" />
              </button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditing(c)}>
                Sửa
              </button>
            </div>
          </div>
        ))}
        {categories.length === 0 ? <p className="empty">Chưa có danh mục nào.</p> : null}
      </div>
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Thêm danh mục" : "Sửa danh mục"}>
        {editing !== null ? <CategoryForm key={editing === "new" ? "new" : editing.id} category={editing === "new" ? null : editing} onDone={done} /> : null}
      </Dialog>
    </>
  );
}
