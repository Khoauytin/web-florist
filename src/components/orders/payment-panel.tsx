"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dialog, ErrorAlert, MoneyInput, toast } from "@/components/ui";
import { addPaymentAction, voidPaymentAction } from "@/server/actions/orders.actions";
import { formatMoney } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/labels";
import type { ActionState } from "@/server/errors";

type Method = keyof typeof PAYMENT_METHOD_LABELS;

export interface PaymentView {
  id: string;
  type: keyof typeof PAYMENT_TYPE_LABELS;
  amount: number;
  method: Method;
  paidAt: string;
  by: string;
  note: string | null;
  voided: boolean;
  voidReason: string | null;
}

export function PaymentPanel({
  orderId,
  role,
  owed,
  paid,
  cancelled,
  payments,
}: {
  orderId: string;
  role: "owner" | "staff";
  owed: number;
  paid: number;
  cancelled: boolean;
  payments: PaymentView[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"pay" | "refund" | null>(null);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<Method>("BANK_TRANSFER");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) {
        toast(r.message ?? "Đã lưu");
        setMode(null);
        setVoidId(null);
        setNote("");
        router.refresh();
      } else setError(r.error ?? "Có lỗi xảy ra");
    });

  const openPay = (m: "pay" | "refund") => {
    setError(null);
    setNote("");
    setAmount(m === "pay" ? owed : paid);
    setMode(m);
  };

  return (
    <>
      <ul className="timeline" style={{ borderTop: "1px solid var(--line)" }}>
        {payments.length ? (
          payments.map((p) => (
            <li key={p.id}>
              <span>
                <span className={p.voided ? "voided" : undefined}>
                  <b>{p.type === "REFUND" ? "-" : ""}{formatMoney(p.amount)}</b> · {PAYMENT_TYPE_LABELS[p.type]} · {PAYMENT_METHOD_LABELS[p.method]}
                </span>
                {p.note ? <span className="muted"> · {p.note}</span> : null}
                <br />
                <span className="when">
                  {p.paidAt} · {p.by}
                  {p.voided ? ` · Đã hủy: ${p.voidReason}` : ""}
                </span>
                {role === "owner" && !p.voided ? (
                  <>
                    {" "}
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setError(null); setNote(""); setVoidId(p.id); }}>
                      Hủy dòng
                    </button>
                  </>
                ) : null}
              </span>
            </li>
          ))
        ) : (
          <li>
            <span className="muted">Chưa có khoản thanh toán nào.</span>
          </li>
        )}
      </ul>
      <div className="pad actions" style={{ borderTop: "1px solid var(--line)" }}>
        <button className="btn btn-secondary" type="button" disabled={cancelled || owed <= 0} onClick={() => openPay("pay")}>
          Ghi nhận thanh toán
        </button>
        {role === "owner" && paid > 0 ? (
          <button className="btn btn-ghost" type="button" onClick={() => openPay("refund")}>
            Hoàn tiền
          </button>
        ) : null}
      </div>

      <Dialog
        open={mode !== null}
        onClose={() => setMode(null)}
        title={mode === "refund" ? "Hoàn tiền cho khách" : "Ghi nhận thanh toán"}
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setMode(null)}>
              Quay lại
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={pending || !amount}
              onClick={() =>
                run(() =>
                  addPaymentAction(orderId, {
                    type: mode === "refund" ? "REFUND" : paid > 0 || amount === null || amount >= owed ? "PAYMENT" : "DEPOSIT",
                    amount: amount ?? 0,
                    method,
                    note: note || undefined,
                  }),
                )
              }
            >
              {pending ? "Đang lưu..." : "Lưu"}
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="pay-amount">Số tiền (đ)</label>
          <MoneyInput id="pay-amount" value={amount} onChange={setAmount} describedBy="pay-hint" />
          <span className="hint" id="pay-hint">
            {mode === "refund" ? `Đã thu ${formatMoney(paid)}` : `Còn lại ${formatMoney(owed)}`}
          </span>
        </div>
        <div className="field">
          <span className="label" id="pay-method">
            Hình thức
          </span>
          <div className="seg" role="radiogroup" aria-labelledby="pay-method">
            {(Object.keys(PAYMENT_METHOD_LABELS) as Method[]).map((m) => (
              <label key={m}>
                <input type="radio" name="pay-method" checked={method === m} onChange={() => setMethod(m)} />
                {PAYMENT_METHOD_LABELS[m]}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="pay-note">Ghi chú</label>
          <input id="pay-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </div>
        <ErrorAlert message={error} />
      </Dialog>

      <Dialog
        open={voidId !== null}
        onClose={() => setVoidId(null)}
        title="Hủy dòng thanh toán"
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setVoidId(null)}>
              Quay lại
            </button>
            <button className="btn btn-danger" type="button" disabled={pending || !note.trim()} onClick={() => run(() => voidPaymentAction(orderId, voidId!, note))}>
              Hủy dòng
            </button>
          </>
        }
      >
        <p className="small muted">Dòng bị hủy vẫn hiển thị trong lịch sử nhưng không tính vào số đã thu.</p>
        <div className="field">
          <label htmlFor="void-reason">
            Lý do<span className="req" aria-hidden="true">*</span>
          </label>
          <input id="void-reason" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Ví dụ: nhập nhầm số tiền" />
        </div>
        <ErrorAlert message={error} />
      </Dialog>
    </>
  );
}
