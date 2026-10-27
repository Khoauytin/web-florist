"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Icon } from "@/components/icon";
import { toast } from "@/components/ui";
import { setMadeAction } from "@/server/actions/orders.actions";

/** Production counter for one order line ("đã làm"). Saves each change; rolls back on error. */
export function MadeStepper({ orderId, itemId, made, toMake, label }: { orderId: string; itemId: string; made: number; toMake: number; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useOptimistic(made);
  const save = (next: number) => {
    const n = Math.max(0, Math.min(toMake, next));
    if (n === value) return;
    start(async () => {
      setValue(n);
      const r = await setMadeAction(orderId, itemId, n);
      if (!r.ok) toast(r.error ?? "Không lưu được");
      router.refresh();
    });
  };
  return (
    <div className="actions">
      <div className="qty" role="group" aria-label={`Số đã làm: ${label}`}>
        <button type="button" onClick={() => save(value - 1)} disabled={pending || value <= 0} aria-label="Giảm số đã làm">
          <Icon name="minus" />
        </button>
        <output aria-live="polite">
          {value}/{toMake}
        </output>
        <button type="button" onClick={() => save(value + 1)} disabled={pending || value >= toMake} aria-label="Tăng số đã làm">
          <Icon name="plus" />
        </button>
      </div>
      <button className="btn btn-secondary" type="button" onClick={() => save(toMake)} disabled={pending || value >= toMake}>
        Làm xong hết
      </button>
    </div>
  );
}
