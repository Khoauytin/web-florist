"use client";

import { useFormStatus } from "react-dom";
import { Icon } from "@/components/icon";
import type { ActionState } from "@/server/errors";

export function SubmitButton({
  children,
  className = "btn btn-primary",
  pendingText = "Đang lưu...",
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} aria-busy={pending}>
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

export function FormAlert({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <div className="alert alert-error" role="alert">
        <Icon name="alert" />
        <span>{state.error}</span>
      </div>
    );
  }
  if (state.ok && state.message) {
    return (
      <div className="alert alert-success" role="status">
        <Icon name="check" />
        <span>{state.message}</span>
      </div>
    );
  }
  return null;
}

export function Field({
  label,
  name,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>
        {label}
        {required ? <span className="req" aria-hidden="true">*</span> : null}
      </label>
      {children}
      {error ? (
        <span className="err" id={`${name}-err`}>
          {error}
        </span>
      ) : hint ? (
        <span className="hint" id={`${name}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** aria props for an input inside <Field>. */
export function fieldAria(name: string, error?: string, hint?: string) {
  return {
    id: name,
    name,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `${name}-err` : hint ? `${name}-hint` : undefined,
  };
}
