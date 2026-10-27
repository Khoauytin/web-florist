"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/admin/icon";
import { ErrorAlert, toast } from "@/components/admin/ui";
import { changeStatusAction, markPaidAction } from "@/server/actions/orders.actions";
import type { ActionState } from "@/server/errors";
import type { OrderStatusKey } from "@/lib/labels";

const NEXT: Partial<Record<OrderStatusKey, string>> = { NEW: "Bắt đầu giao", DELIVERING: "Hoàn thành đơn" };

export function OrderActions({ id, status, owed }: { id: string; status: OrderStatusKey; owed: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Có lỗi xảy ra");
      toast(r.message ?? "Đã lưu");
      router.refresh();
    });
  return (
    <>
      <div className="actions">
        {NEXT[status] ? (
          <button className="btn btn-ink" type="button" disabled={pending} onClick={() => run(() => changeStatusAction(id, "next"))}>
            {NEXT[status]}
          </button>
        ) : null}
        {status === "DELIVERING" || status === "COMPLETED" ? (
          <button className="btn btn-light" type="button" disabled={pending} onClick={() => run(() => changeStatusAction(id, "back"))}>
            Quay lại bước trước
          </button>
        ) : null}
        {status === "CANCELLED" ? (
          <button className="btn btn-ink" type="button" disabled={pending} onClick={() => run(() => changeStatusAction(id, "restore"))}>
            Khôi phục về Mới
          </button>
        ) : (
          <Link className="btn btn-light" href={`/admin/orders/${id}/edit`}>
            <Icon name="edit" className="icon-sm" />
            Sửa
          </Link>
        )}
        {owed > 0 && status !== "CANCELLED" ? (
          <button className="btn btn-light" type="button" disabled={pending} onClick={() => run(() => markPaidAction(id))}>
            <Icon name="wallet" className="icon-sm" />
            Đã thu đủ
          </button>
        ) : null}
      </div>
      <ErrorAlert message={error} />
    </>
  );
}
