"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Icon } from "@/components/admin/icon";
import { Dialog, ErrorAlert, toast } from "@/components/admin/ui";
import { changeStatusAction, deleteOrderAction } from "@/server/actions/orders.actions";
import type { OrderStatusKey } from "@/lib/labels";

/** "⋮" menu on an order: Sửa, Hủy (New/Delivering), Xóa (New/Cancelled), each with confirmation. */
export function OrderMenu({ id, code, status, afterDelete }: { id: string; code: string; status: OrderStatusKey; afterDelete?: string }) {
  const router = useRouter();
  const menu = useRef<HTMLDivElement>(null);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canCancel = status === "NEW" || status === "DELIVERING";
  const canDelete = status === "NEW" || status === "CANCELLED";
  const menuId = `menu-${id}`;

  const open = (e: React.MouseEvent<HTMLButtonElement>) => {
    const m = menu.current!;
    const r = e.currentTarget.getBoundingClientRect();
    m.style.top = `${Math.min(r.bottom + 4, window.innerHeight - 170)}px`;
    m.style.left = `${Math.max(16, r.right - 176)}px`;
    if (typeof m.togglePopover === "function") return m.togglePopover();
    // Fallback for browsers without popover: toggle a class and close on the next outside tap.
    if (m.classList.toggle("is-open")) {
      const close = (ev: PointerEvent) => {
        if (m.contains(ev.target as Node)) return;
        m.classList.remove("is-open");
        document.removeEventListener("pointerdown", close, true);
      };
      setTimeout(() => document.addEventListener("pointerdown", close, true));
    }
  };
  const hideMenu = () => {
    const m = menu.current;
    if (!m) return;
    if (typeof m.hidePopover === "function") m.hidePopover();
    m.classList.remove("is-open");
  };
  const ask = (k: "cancel" | "delete") => {
    hideMenu();
    setError(null);
    setConfirm(k);
  };
  const run = () =>
    start(async () => {
      const r = confirm === "delete" ? await deleteOrderAction(id) : await changeStatusAction(id, "cancel");
      if (!r.ok) return setError(r.error ?? "Có lỗi xảy ra");
      setConfirm(null);
      toast(r.message ?? "Đã lưu");
      if (confirm === "delete" && afterDelete) router.push(afterDelete);
      router.refresh();
    });

  return (
    <>
      <button className="more-btn" type="button" onClick={open} aria-label={`Thao tác với đơn ${code}`} aria-haspopup="menu" aria-controls={menuId}>
        <Icon name="more" />
      </button>
      <div className="menu" id={menuId} ref={menu} popover="auto" role="menu">
        {status !== "CANCELLED" ? (
          <Link role="menuitem" href={`/admin/orders/${id}/edit`} className="menu-link" onClick={hideMenu} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44, padding: "0 12px", borderRadius: 10, fontWeight: 500 }}>
            <Icon name="edit" />
            Sửa
          </Link>
        ) : null}
        {canCancel ? (
          <button type="button" role="menuitem" onClick={() => ask("cancel")}>
            <Icon name="ban" />
            Hủy đơn
          </button>
        ) : null}
        {canDelete ? (
          <button type="button" role="menuitem" className="danger" onClick={() => ask("delete")}>
            <Icon name="trash" />
            Xóa
          </button>
        ) : null}
      </div>
      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} label={confirm === "delete" ? "Xóa đơn" : "Hủy đơn"}>
        <h2>{confirm === "delete" ? "Xóa hẳn đơn này?" : "Hủy đơn này?"}</h2>
        <p className="muted">
          {code}. {confirm === "delete" ? "Không khôi phục được sau khi xóa." : "Đơn vẫn được giữ lại và có thể khôi phục."}
        </p>
        <ErrorAlert message={error} />
        <div className="actions">
          <button className="btn btn-light" type="button" onClick={() => setConfirm(null)}>
            Không
          </button>
          <button className={confirm === "delete" ? "btn btn-danger" : "btn btn-ink"} type="button" disabled={pending} onClick={run}>
            {pending ? "Đang xử lý..." : confirm === "delete" ? "Xóa" : "Hủy đơn"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
