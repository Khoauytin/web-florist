"use client";

import { useActionState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/admin/ui";
import { saveSettingsAction } from "@/server/actions/people.actions";
import { changePasswordAction, loginAction } from "@/server/actions/auth.actions";
import type { ActionState } from "@/server/errors";

function OkAlert({ state }: { state: ActionState }) {
  return state.ok && state.message ? (
    <div className="alert alert-ok" role="status">
      {state.message}
    </div>
  ) : null;
}

/**
 * React resets a form after its action finishes. On an error the action echoes what was typed,
 * so the reset lands on the submitted values instead of wiping them.
 */
export function withEcho<S extends ActionState>(fn: (prev: S, fd: FormData) => Promise<S>) {
  return async (prev: S & { values?: Record<string, string> }, fd: FormData): Promise<S & { values?: Record<string, string> }> => {
    const res = await fn(prev, fd);
    return res.ok ? res : { ...res, values: Object.fromEntries([...fd].map(([k, v]) => [k, String(v)])) };
  };
}

export function SettingsForm({ initial: saved }: { initial: { shopName: string; phone: string; zaloPhone: string; facebookUrl: string; messengerUrl: string; tiktokUrl: string } }) {
  const [state, action] = useActionState(withEcho<ActionState>(saveSettingsAction), { ok: false });
  const fe = state.fieldErrors ?? {};
  const initial = { ...saved, ...state.values };
  return (
    <form action={action} className="card pad stack" noValidate>
      <p className="muted small">Các thông tin này hiện trên trang khách và dùng cho nút đặt mẫu.</p>
      <FormAlert state={state} />
      <OkAlert state={state} />
      <Field label="Tên shop" htmlFor="shopName" error={fe.shopName} required>
        <input className="input" id="shopName" name="shopName" defaultValue={initial.shopName} maxLength={120} />
      </Field>
      <Field label="Số điện thoại" htmlFor="phone" error={fe.phone} hint="Nút Gọi trên trang khách gọi số này.">
        <input className="input" id="phone" name="phone" type="tel" inputMode="tel" defaultValue={initial.phone} placeholder="0912 345 678" />
      </Field>
      <Field label="Zalo (số điện thoại)" htmlFor="zaloPhone" error={fe.zaloPhone} hint="Nút Zalo mở zalo.me/số điện thoại.">
        <input className="input" id="zaloPhone" name="zaloPhone" type="tel" inputMode="tel" defaultValue={initial.zaloPhone} placeholder="0912 345 678" />
      </Field>
      <Field label="Trang Facebook" htmlFor="facebookUrl" error={fe.facebookUrl}>
        <input className="input" id="facebookUrl" name="facebookUrl" type="url" inputMode="url" defaultValue={initial.facebookUrl} placeholder="https://www.facebook.com/tentrang" />
      </Field>
      <Field label="Messenger" htmlFor="messengerUrl" error={fe.messengerUrl} hint="Nút Facebook trong bảng đặt mẫu mở link này để nhắn tin.">
        <input className="input" id="messengerUrl" name="messengerUrl" type="url" inputMode="url" defaultValue={initial.messengerUrl} placeholder="https://m.me/tentrang" />
      </Field>
      <Field label="TikTok" htmlFor="tiktokUrl" error={fe.tiktokUrl}>
        <input className="input" id="tiktokUrl" name="tiktokUrl" type="url" inputMode="url" defaultValue={initial.tiktokUrl} placeholder="https://www.tiktok.com/@tenkenh" />
      </Field>
      <SubmitButton className="btn btn-ink btn-block">Lưu</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<ActionState, FormData>(changePasswordAction, { ok: false });
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="card pad stack" noValidate>
      <FormAlert state={state} />
      <OkAlert state={state} />
      <Field label="Mật khẩu hiện tại" htmlFor="currentPassword" error={fe.currentPassword} required>
        <input className="input" id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" />
      </Field>
      <Field label="Mật khẩu mới" htmlFor="newPassword" error={fe.newPassword} hint="Ít nhất 8 ký tự." required>
        <input className="input" id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} />
      </Field>
      <Field label="Nhập lại mật khẩu mới" htmlFor="confirmPassword" error={fe.confirmPassword} required>
        <input className="input" id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton className="btn btn-ink btn-block">Đổi mật khẩu</SubmitButton>
    </form>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<ActionState, FormData>(loginAction, { ok: false });
  return (
    <form action={action} className="stack" noValidate>
      <FormAlert state={state} />
      <div className="field">
        <label htmlFor="username">Tên đăng nhập</label>
        <input className="input" id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </div>
      <div className="field">
        <label htmlFor="password">Mật khẩu</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <SubmitButton className="btn btn-ink btn-block" pendingText="Đang đăng nhập...">
        Đăng nhập
      </SubmitButton>
    </form>
  );
}
