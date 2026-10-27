"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";

/** Fire-and-forget status message, shown by <Toaster /> (aria-live, auto-dismiss). */
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
      timer = setTimeout(() => setOn(false), 3500);
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
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
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
      aria-labelledby="dlg-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open ? (
        <>
          <div className="dlg-h">
            <h2 id="dlg-title">{title}</h2>
            <button className="icon-btn" type="button" onClick={onClose} aria-label="Đóng">
              <Icon name="x" />
            </button>
          </div>
          <div className="dlg-b">{children}</div>
          {footer ? <div className="dlg-f">{footer}</div> : null}
        </>
      ) : null}
    </dialog>
  );
}

export function ErrorAlert({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="alert alert-error" role="alert">
      <Icon name="alert" />
      <span>{message}</span>
    </div>
  );
}

/** Money input that accepts "350.000" and shows thousands separators on blur. */
export function MoneyInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  placeholder,
}: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
}) {
  const fmt = (n: number | null) => (n === null ? "" : new Intl.NumberFormat("vi-VN").format(n));
  // While focused show exactly what was typed; otherwise show the formatted value.
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
