"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { Dialog, ErrorAlert, toast } from "@/components/ui";
import { adjustStockAction, produceStockAction } from "@/server/actions/catalog.actions";
import type { ActionState } from "@/server/errors";

export function StockActions({ productId, role, onHand, reserved, madeToOrder }: { productId: string; role: "owner" | "staff"; onHand: number; reserved: number; madeToOrder: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<"produce" | "adjust" | null>(null);
  const [qty, setQty] = useState("1");
  const [sign, setSign] = useState<1 | -1>(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (madeToOrder) return null;

  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) {
        toast(r.message ?? "Đã lưu");
        setOpen(null);
        router.refresh();
      } else setError(r.error ?? "Có lỗi xảy ra");
    });
  const n = Number(qty);
  const valid = Number.isInteger(n) && n > 0 && n <= 10000;
  const show = (k: "produce" | "adjust") => {
    setQty("1");
    setNote("");
    setSign(1);
    setError(null);
    setOpen(k);
  };

  return (
    <>
      <button className="btn btn-primary" type="button" onClick={() => show("produce")}>
        <Icon name="plus" />
        Nhập thêm hàng làm sẵn
      </button>
      {role === "owner" ? (
        <button className="btn btn-secondary" type="button" onClick={() => show("adjust")}>
          Điều chỉnh tồn kho
        </button>
      ) : null}

      <Dialog
        open={open === "produce"}
        onClose={() => setOpen(null)}
        title="Nhập thêm hàng làm sẵn"
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setOpen(null)}>
              Quay lại
            </button>
            <button className="btn btn-primary" type="button" disabled={pending || !valid} onClick={() => run(() => produceStockAction(productId, n, note))}>
              {pending ? "Đang lưu..." : `Nhập ${valid ? n : ""}`}
            </button>
          </>
        }
      >
        <p className="small muted">Đang có {onHand}. Hàng làm sẵn sẽ dùng cho các đơn xác nhận sau.</p>
        <div className="field">
          <label htmlFor="produce-qty">Số lượng đã làm</label>
          <input id="produce-qty" className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div className="field">
          <label htmlFor="produce-note">Ghi chú</label>
          <input id="produce-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Không bắt buộc" />
        </div>
        <ErrorAlert message={error} />
      </Dialog>

      <Dialog
        open={open === "adjust"}
        onClose={() => setOpen(null)}
        title="Điều chỉnh tồn kho"
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setOpen(null)}>
              Quay lại
            </button>
            <button className="btn btn-primary" type="button" disabled={pending || !valid || !note.trim()} onClick={() => run(() => adjustStockAction(productId, sign * n, note))}>
              {pending ? "Đang lưu..." : "Lưu điều chỉnh"}
            </button>
          </>
        }
      >
        <p className="small muted">
          Đang có {onHand}, đã giữ cho đơn {reserved}. Không thể giảm xuống dưới số đã giữ.
        </p>
        <div className="seg" role="radiogroup" aria-label="Tăng hay giảm">
          <label>
            <input type="radio" name="adj-sign" checked={sign === 1} onChange={() => setSign(1)} />
            Tăng
          </label>
          <label>
            <input type="radio" name="adj-sign" checked={sign === -1} onChange={() => setSign(-1)} />
            Giảm
          </label>
        </div>
        <div className="field">
          <label htmlFor="adj-qty">Số lượng</label>
          <input id="adj-qty" className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
          {valid ? <span className="hint">Sau điều chỉnh: đang có {onHand + sign * n}</span> : null}
        </div>
        <div className="field">
          <label htmlFor="adj-reason">
            Lý do<span className="req" aria-hidden="true">*</span>
          </label>
          <input id="adj-reason" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Ví dụ: kiểm kê cuối tuần" />
        </div>
        <ErrorAlert message={error} />
      </Dialog>
    </>
  );
}
