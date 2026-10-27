"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Field, FormAlert, SubmitButton, fieldAria } from "@/components/form";
import { toast } from "@/components/ui";
import { saveCustomerAction, type CustomerActionState } from "@/server/actions/people.actions";

export function CustomerForm({ customerId, initial }: { customerId: string | null; initial: { name: string; phone: string; email: string; address: string; note: string } }) {
  const router = useRouter();
  const [state, action] = useActionState<CustomerActionState, FormData>(saveCustomerAction.bind(null, customerId), { ok: false });
  const fe = state.fieldErrors ?? {};
  useEffect(() => {
    if (state.ok && state.id) {
      toast(state.message ?? "Đã lưu");
      router.push(`/customers/${state.id}`);
    }
  }, [state, router]);
  return (
    <form action={action} className="stack" style={{ maxWidth: 640 }}>
      <FormAlert state={state.ok ? { ok: false } : state} />
      <div className="row2">
        <Field label="Họ tên" name="name" error={fe.name} required>
          <input className="input" defaultValue={initial.name} maxLength={120} required autoComplete="off" {...fieldAria("name", fe.name)} />
        </Field>
        <Field label="Số điện thoại" name="phone" error={fe.phone} hint="Mỗi số chỉ thuộc về một khách." required>
          <input className="input" type="tel" inputMode="tel" defaultValue={initial.phone} required autoComplete="off" {...fieldAria("phone", fe.phone, "x")} />
        </Field>
      </div>
      <Field label="Email" name="email" error={fe.email}>
        <input className="input" type="email" defaultValue={initial.email} maxLength={120} autoComplete="off" {...fieldAria("email", fe.email)} />
      </Field>
      <Field label="Địa chỉ" name="address">
        <input className="input" defaultValue={initial.address} maxLength={300} {...fieldAria("address")} />
      </Field>
      <Field label="Ghi chú" name="note">
        <textarea className="textarea" defaultValue={initial.note} maxLength={1000} {...fieldAria("note")} />
      </Field>
      <div className="actions">
        <SubmitButton>{customerId ? "Lưu khách hàng" : "Thêm khách hàng"}</SubmitButton>
        <Link className="btn btn-secondary" href={customerId ? `/customers/${customerId}` : "/customers"}>
          Hủy
        </Link>
      </div>
    </form>
  );
}
