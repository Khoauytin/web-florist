"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/server/actions/auth.actions";
import { FormAlert, SubmitButton } from "@/components/form";
import { initialActionState } from "@/server/errors";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, initialActionState);
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="stack" noValidate>
      <FormAlert state={state} />
      <div className="field">
        <label htmlFor="username">Tên đăng nhập</label>
        <input className="input" id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </div>
      <div className="field">
        <label htmlFor="password">Mật khẩu</label>
        <div className="input-wrap">
          <input className="input" id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required style={{ paddingRight: 72 }} />
          <button className="toggle" type="button" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-controls="password">
            {show ? "Ẩn" : "Hiện"}
          </button>
        </div>
        <span className="hint">Quên mật khẩu? Nhờ chủ shop đặt lại cho bạn.</span>
      </div>
      <SubmitButton className="btn btn-primary btn-block" pendingText="Đang đăng nhập...">
        Đăng nhập
      </SubmitButton>
    </form>
  );
}
