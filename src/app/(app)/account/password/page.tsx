"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/server/actions/auth.actions";
import { Field, FormAlert, SubmitButton, fieldAria } from "@/components/form";
import { initialActionState } from "@/server/errors";

export default function ChangePasswordPage() {
  const [state, action] = useActionState(changePasswordAction, initialActionState);
  const fe = state.fieldErrors ?? {};
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Đổi mật khẩu</h1>
          <p className="sub">Sau khi đổi, các thiết bị khác đang đăng nhập sẽ bị đăng xuất.</p>
        </div>
      </div>
      <form action={action} className="stack" style={{ maxWidth: 440 }}>
        <FormAlert state={state} />
        <Field label="Mật khẩu hiện tại" name="currentPassword" error={fe.currentPassword} required>
          <input className="input" type="password" autoComplete="current-password" required {...fieldAria("currentPassword", fe.currentPassword)} />
        </Field>
        <Field label="Mật khẩu mới" name="newPassword" error={fe.newPassword} hint="Ít nhất 8 ký tự." required>
          <input className="input" type="password" autoComplete="new-password" minLength={8} required {...fieldAria("newPassword", fe.newPassword, "x")} />
        </Field>
        <Field label="Nhập lại mật khẩu mới" name="confirmPassword" error={fe.confirmPassword} required>
          <input className="input" type="password" autoComplete="new-password" required {...fieldAria("confirmPassword", fe.confirmPassword)} />
        </Field>
        <div>
          <SubmitButton>Đổi mật khẩu</SubmitButton>
        </div>
      </form>
    </>
  );
}
