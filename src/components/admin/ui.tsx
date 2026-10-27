"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "@/components/admin/icon";
import type { ActionState } from "@/server/errors";

/** Fire-and-forget status message shown by <Toaster /> (aria-live, auto-dismiss). */
export function toast(message: string) {
  window.dispatchEvent(new CustomEvent("app-toast", { detail: message }));
}

export function Toaster() {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handler = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      setOn(true);
      clearTimeout(timer);
      timer = setTimeout(() => setOn(false), 3000);
    };
    window.addEventListener("app-toast", handler);
    return () => {
      window.removeEventListener("app-toast", handler);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div className={on ? "toast on" : "toast"} role="status" aria-live="polite">
      {msg}
    </div>
  );
}

/** Native <dialog> controlled by `open`. Escape and backdrop click call onClose. */
export function Dialog({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="dlg"
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open ? <div className="dlg-b">{children}</div> : null}
    </dialog>
  );
}

export function ErrorAlert({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="alert alert-error" role="alert">
      <Icon name="x" className="icon-sm" />
      <span>{message}</span>
    </div>
  );
}

export function FormAlert({ state }: { state: ActionState }) {
  return state.ok ? null : <ErrorAlert message={state.error} />;
}

export function SubmitButton({ children, className = "btn btn-ink", pendingText = "Đang lưu..." }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function Field({ label, htmlFor, error, hint, required, children }: { label: string; htmlFor: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span className="req"> *</span> : null}
      </label>
      {children}
      {error ? (
        <span className="err" id={`${htmlFor}-err`}>
          {error}
        </span>
      ) : hint ? (
        <span className="hint" id={`${htmlFor}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <span className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} disabled={disabled} />
      <span />
    </span>
  );
}

/** Money input: shows thousands separators when not focused, accepts "350.000" or "350000". */
export function MoneyInput({ id, value, onChange, placeholder, invalid, describedBy }: { id: string; value: number | null; onChange: (v: number | null) => void; placeholder?: string; invalid?: boolean; describedBy?: string }) {
  const fmt = (n: number | null) => (n === null ? "" : new Intl.NumberFormat("vi-VN").format(n));
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <input
      id={id}
      className="input"
      inputMode="numeric"
      autoComplete="off"
      value={editing ?? fmt(value)}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onFocus={() => setEditing(fmt(value))}
      onChange={(e) => {
        setEditing(e.target.value);
        const digits = e.target.value.replace(/[^\d]/g, "");
        onChange(digits === "" ? null : Math.min(Number(digits), 2_000_000_000));
      }}
      onBlur={() => setEditing(null)}
    />
  );
}
