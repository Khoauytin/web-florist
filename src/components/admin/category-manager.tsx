"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/admin/icon";
import { Dialog, ErrorAlert, Switch, toast } from "@/components/admin/ui";
import { deleteCategoryAction, moveCategoryAction, saveCategoryAction, setCategoryVisibleAction } from "@/server/actions/catalog.actions";
import { suggestPrefix } from "@/server/domain/product-code";
import type { ActionState } from "@/server/errors";

export interface CategoryRow {
  id: string;
  name: string;
  codePrefix: string;
  isVisible: boolean;
  count: number;
  nextCode: string;
}

export function CategoryManager({ rows }: { rows: CategoryRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<CategoryRow | "new" | null>(null);
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [prefixTouched, setPrefixTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);

  const run = (fn: () => Promise<ActionState>, close = false) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) {
        if (close) setError(r.error ?? "Có lỗi xảy ra");
        else toast(r.error ?? "Có lỗi xảy ra");
        return;
      }
      toast(r.message ?? "Đã lưu");
      if (close) setEditing(null);
      router.refresh();
    });
  const open = (c: CategoryRow | "new") => {
    setError(null);
    setEditing(c);
    setName(c === "new" ? "" : c.name);
    setPrefix(c === "new" ? "" : c.codePrefix);
    setPrefixTouched(c !== "new");
  };
  const remove = () => {
    if (!deleting) return;
    start(async () => {
      setError(null);
      const r = await deleteCategoryAction(deleting.id);
      if (!r.ok) return setError(r.error ?? "Không thể xóa danh mục");
      toast(r.message ?? "Đã xóa danh mục");
      setDeleting(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="shead" style={{ marginTop: 8 }}>
        <h1>Danh mục</h1>
        <button className="btn btn-accent" type="button" onClick={() => open("new")} aria-label="Thêm danh mục">
          <Icon name="plus" />
        </button>
      </div>
      <div className="card pad">
        <div className="tasks">
          {rows.map((c, i) => (
            <div key={c.id} className="task" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto", alignItems: "center" }}>
              <span className="pill st-NEW" style={{ minWidth: 56, justifyContent: "center" }}>
                {c.codePrefix}
              </span>
              <button type="button" onClick={() => open(c)} style={{ background: "none", border: 0, padding: 0, textAlign: "left" }} aria-label={`Sửa danh mục ${c.name}`}>
                <div className="tt">{c.name}</div>
                <div className="time">
                  {c.count} mẫu · mã tiếp theo {c.nextCode}
                </div>
              </button>
              <div className="actions" style={{ alignItems: "center", flexWrap: "nowrap" }}>
                <button className="icon-btn" type="button" aria-label={`Đưa ${c.name} lên`} disabled={pending || i === 0} onClick={() => run(() => moveCategoryAction(c.id, "up"))}>
                  <Icon name="up" />
                </button>
                <Switch checked={c.isVisible} onChange={(b) => run(() => setCategoryVisibleAction(c.id, b))} label={`Hiện ${c.name} trên web`} disabled={pending} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="muted small" style={{ marginTop: 12 }}>
        Tắt danh mục thì mọi mẫu trong đó ẩn khỏi trang khách. Đổi tiền tố chỉ áp dụng cho mẫu tạo sau đó, mã cũ giữ nguyên.
      </p>
      <Dialog open={editing !== null} onClose={() => setEditing(null)} label={editing === "new" ? "Thêm danh mục" : "Sửa danh mục"}>
        <h2>{editing === "new" ? "Thêm danh mục" : "Sửa danh mục"}</h2>
        <ErrorAlert message={error} />
        <div className="field">
          <label htmlFor="cat-name">Tên danh mục</label>
          <input
            className="input"
            id="cat-name"
            value={name}
            maxLength={80}
            onChange={(e) => {
              setName(e.target.value);
              if (!prefixTouched) setPrefix(suggestPrefix(e.target.value));
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="cat-prefix">Tiền tố mã</label>
          <input
            className="input"
            id="cat-prefix"
            value={prefix}
            maxLength={6}
            autoCapitalize="characters"
            onChange={(e) => {
              setPrefixTouched(true);
              setPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""));
            }}
            aria-describedby="cat-prefix-hint"
          />
          <span className="hint" id="cat-prefix-hint">
            1 đến 6 chữ cái. Mẫu mới sẽ có mã {prefix || "XX"}-001, {prefix || "XX"}-002...
          </span>
        </div>
        <div className="actions">
          {editing && editing !== "new" ? (
            <button
              className="btn btn-danger"
              type="button"
              disabled={pending}
              style={{ marginRight: "auto" }}
              onClick={() => {
                setError(null);
                setDeleting(editing);
                setEditing(null);
              }}
            >
              <Icon name="trash" />
              Xóa
            </button>
          ) : null}
          <button className="btn btn-light" type="button" onClick={() => setEditing(null)}>
            Hủy
          </button>
          <button
            className="btn btn-ink"
            type="button"
            disabled={pending || !name.trim() || !prefix}
            onClick={() => run(() => saveCategoryAction(editing === "new" ? null : editing!.id, { name, codePrefix: prefix, isVisible: editing === "new" ? true : editing!.isVisible }), true)}
          >
            {editing === "new" ? "Thêm" : "Lưu"}
          </button>
        </div>
      </Dialog>
      <Dialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          setError(null);
        }}
        label="Xóa danh mục"
      >
        <h2>Xóa danh mục {deleting?.name}?</h2>
        <ErrorAlert message={error} />
        <p className="muted">Chỉ xóa được danh mục không còn sản phẩm, kể cả sản phẩm đã lưu trữ. Thao tác này không thể khôi phục.</p>
        <div className="actions">
          <button
            className="btn btn-light"
            type="button"
            disabled={pending}
            onClick={() => {
              setDeleting(null);
              setError(null);
            }}
          >
            Không
          </button>
          <button className="btn btn-danger" type="button" disabled={pending} onClick={remove}>
            {pending ? "Đang xóa..." : "Xóa danh mục"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
