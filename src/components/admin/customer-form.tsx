"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Field, FormAlert, SubmitButton, toast } from "@/components/admin/ui";
import { withEcho } from "@/components/admin/settings-forms";
import { saveCustomerAction } from "@/server/actions/people.actions";
import type { ActionState } from "@/server/errors";

export function CustomerForm({ customerId, initial: saved }: { customerId: string | null; initial: { name: string; phone: string; address: string; note: string } }) {
  const router = useRouter();
  const [state, action] = useActionState(withEcho<ActionState & { id?: string }>(saveCustomerAction.bind(null, customerId)), { ok: false });
  const fe = state.fieldErrors ?? {};
  const initial = { ...saved, ...state.values };
  useEffect(() => {
    if (state.ok && state.id) {
      toast(state.message ?? "Đã lưu");
      router.push(`/admin/customers/${state.id}`);
    }
  }, [state, router]);
  return (
    <form action={action} className="card pad stack" noValidate>
      <FormAlert state={state} />
      <Field label="Họ tên" htmlFor="name" error={fe.name} required>
        <input className="input" id="name" name="name" defaultValue={initial.name} maxLength={120} autoComplete="off" aria-invalid={fe.name ? true : undefined} />
      </Field>
      <Field label="Số điện thoại" htmlFor="phone" error={fe.phone} hint="Mỗi số chỉ thuộc về một khách." required>
        <input className="input" id="phone" name="phone" type="tel" inputMode="tel" defaultValue={initial.phone} autoComplete="off" aria-invalid={fe.phone ? true : undefined} />
      </Field>
      <Field label="Địa chỉ" htmlFor="address">
        <input className="input" id="address" name="address" defaultValue={initial.address} maxLength={300} />
      </Field>
      <Field label="Ghi chú" htmlFor="note">
        <textarea className="textarea" id="note" name="note" defaultValue={initial.note} maxLength={1000} />
      </Field>
      <SubmitButton className="btn btn-ink btn-block">{customerId ? "Lưu" : "Thêm khách hàng"}</SubmitButton>
    </form>
  );
}
