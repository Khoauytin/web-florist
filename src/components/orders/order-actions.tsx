"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dialog, ErrorAlert, toast } from "@/components/ui";
import {
  cancelOrderAction,
  completeOrderAction,
  confirmOrderAction,
  failDeliveryAction,
  retryDeliveryAction,
  startDeliveryAction,
  unconfirmOrderAction,
} from "@/server/actions/orders.actions";
import { formatMoney } from "@/lib/format";
import type { ActionState } from "@/server/errors";

export interface MadeItem {
  id: string;
  name: string;
  qtyMade: number;
  restockable: boolean;
}

type Kind = "cancel" | "unconfirm" | "fail" | "complete" | "confirm" | null;

export function OrderActions({
  orderId,
  status,
  role,
  receiveType,
  remaining,
  owed,
  paid,
  madeItems,
}: {
  orderId: string;
  status: string;
  role: "owner" | "staff";
  receiveType: "DELIVERY" | "PICKUP";
  remaining: number;
  owed: number;
  paid: number;
  madeItems: MadeItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<Kind>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [writeOffReason, setWriteOffReason] = useState("");
  const [choices, setChoices] = useState<Record<string, "RESTOCK" | "WRITE_OFF">>({});
  const owner = role === "owner";

  const exec = (fn: () => Promise<ActionState>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) {
        setDialog(null);
        setReason("");
        toast(r.message ?? "Đã lưu");
        router.refresh();
      } else setError(r.error ?? "Có lỗi xảy ra");
    });

  const open = (k: Kind) => {
    setError(null);
    setReason("");
    setWriteOffReason("");
    setChoices(Object.fromEntries(madeItems.map((m) => [m.id, m.restockable ? "RESTOCK" : "WRITE_OFF"])));
    setDialog(k);
  };

  const needsWriteOffReason = Object.values(choices).includes("WRITE_OFF") && madeItems.length > 0;
  const deliverLabel = receiveType === "PICKUP" ? "Sẵn sàng nhận" : "Bắt đầu giao";

  const resolutionFields = madeItems.length ? (
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="label" style={{ marginBottom: 8 }}>
        Hàng đã làm cho đơn này
      </legend>
      {madeItems.map((m) => (
        <div key={m.id} className="field">
          <span className="label">
            {m.qtyMade} {m.name}
          </span>
          <div className="seg" role="radiogroup" aria-label={`Xử lý ${m.name}`}>
            <label>
              <input type="radio" name={`r-${m.id}`} checked={choices[m.id] === "RESTOCK"} disabled={!m.restockable} onChange={() => setChoices((c) => ({ ...c, [m.id]: "RESTOCK" }))} />
              Nhập kho để bán lại
            </label>
            <label>
              <input type="radio" name={`r-${m.id}`} checked={choices[m.id] === "WRITE_OFF"} onChange={() => setChoices((c) => ({ ...c, [m.id]: "WRITE_OFF" }))} />
              Ghi hư hao
            </label>
          </div>
          {!m.restockable ? <span className="hint">Sản phẩm làm theo đơn nên không nhập kho được.</span> : null}
        </div>
      ))}
      {needsWriteOffReason ? (
        <div className="field">
          <label htmlFor="wo-reason">
            Lý do hư hao<span className="req" aria-hidden="true">*</span>
          </label>
          <input id="wo-reason" className="input" value={writeOffReason} onChange={(e) => setWriteOffReason(e.target.value)} maxLength={300} />
        </div>
      ) : null}
    </fieldset>
  ) : null;

  return (
    <>
      <div className="actions">
        {status === "NEW" ? (
          <>
            <button className="btn btn-primary" type="button" disabled={pending} onClick={() => open("confirm")}>
              Xác nhận đơn
            </button>
            <Link className="btn btn-secondary" href={`/orders/${orderId}/edit`}>
              Sửa đơn
            </Link>
            <button className="btn btn-danger" type="button" disabled={pending} onClick={() => open("cancel")}>
              Hủy đơn
            </button>
          </>
        ) : null}
        {status === "CONFIRMED" ? (
          <>
            <button className="btn btn-primary" type="button" disabled={pending || remaining > 0} onClick={() => exec(() => startDeliveryAction(orderId))}>
              {deliverLabel}
            </button>
            {owner ? (
              <>
                <button className="btn btn-secondary" type="button" disabled={pending} onClick={() => open("unconfirm")}>
                  Hủy xác nhận
                </button>
                <button className="btn btn-danger" type="button" disabled={pending} onClick={() => open("cancel")}>
                  Hủy đơn
                </button>
              </>
            ) : null}
            {remaining > 0 ? <span className="why">Còn {remaining} sản phẩm chưa làm xong. Cập nhật số đã làm bên dưới để mở bước giao.</span> : null}
          </>
        ) : null}
        {status === "DELIVERING" ? (
          <>
            <button className="btn btn-primary" type="button" disabled={pending} onClick={() => open("complete")}>
              Hoàn thành đơn
            </button>
            {receiveType === "DELIVERY" ? (
              <button className="btn btn-secondary" type="button" disabled={pending} onClick={() => open("fail")}>
                Báo giao thất bại
              </button>
            ) : null}
          </>
        ) : null}
        {status === "DELIVERY_FAILED" ? (
          <>
            <button className="btn btn-primary" type="button" disabled={pending || remaining > 0} onClick={() => exec(() => retryDeliveryAction(orderId))}>
              Giao lại
            </button>
            {owner ? (
              <button className="btn btn-danger" type="button" disabled={pending} onClick={() => open("cancel")}>
                Hủy đơn
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      {!dialog ? <div style={{ marginTop: 8 }}><ErrorAlert message={error} /></div> : null}

      <Dialog
        open={dialog === "confirm"}
        onClose={() => setDialog(null)}
        title="Xác nhận đơn"
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setDialog(null)}>
              Để sau
            </button>
            <button className="btn btn-primary" type="button" disabled={pending} onClick={() => exec(() => confirmOrderAction(orderId))}>
              {pending ? "Đang xác nhận..." : "Xác nhận và giữ hàng"}
            </button>
          </>
        }
      >
        <p>Hệ thống sẽ lấy hàng có sẵn trước, giữ lại cho đơn này, phần còn thiếu chuyển thành việc cần làm.</p>
        <ErrorAlert message={error} />
      </Dialog>

      <Dialog
        open={dialog === "complete"}
        onClose={() => setDialog(null)}
        title="Hoàn thành đơn"
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setDialog(null)}>
              Quay lại
            </button>
            <button className="btn btn-primary" type="button" disabled={pending} onClick={() => exec(() => completeOrderAction(orderId))}>
              {pending ? "Đang lưu..." : "Hoàn thành"}
            </button>
          </>
        }
      >
        {owed > 0 ? (
          <div className="alert alert-warn" role="note">
            <span>
              Đơn còn <b>{formatMoney(owed)}</b> chưa thu. Bạn vẫn có thể hoàn thành và thu sau, hoặc ghi nhận thanh toán trước.
            </span>
          </div>
        ) : (
          <p>Hàng lấy từ kho cho đơn này sẽ được xuất khỏi tồn.</p>
        )}
        <ErrorAlert message={error} />
      </Dialog>

      <Dialog
        open={dialog === "fail"}
        onClose={() => setDialog(null)}
        title="Báo giao thất bại"
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setDialog(null)}>
              Quay lại
            </button>
            <button className="btn btn-primary" type="button" disabled={pending || !reason.trim()} onClick={() => exec(() => failDeliveryAction(orderId, reason))}>
              Lưu
            </button>
          </>
        }
      >
        <p className="small muted">Hàng vẫn được giữ cho đơn. Bạn có thể giao lại sau.</p>
        <div className="field">
          <label htmlFor="fail-reason">
            Lý do<span className="req" aria-hidden="true">*</span>
          </label>
          <input id="fail-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Ví dụ: người nhận vắng nhà" />
        </div>
        <ErrorAlert message={error} />
      </Dialog>

      <Dialog
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        title="Hủy đơn"
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setDialog(null)}>
              Không hủy
            </button>
            <button
              className="btn btn-danger-solid btn"
              type="button"
              disabled={pending || !reason.trim() || (needsWriteOffReason && !writeOffReason.trim())}
              onClick={() => exec(() => cancelOrderAction(orderId, reason, choices, writeOffReason))}
            >
              {pending ? "Đang hủy..." : "Hủy đơn"}
            </button>
          </>
        }
      >
        {status !== "NEW" ? <p className="small muted">Hàng đang giữ cho đơn sẽ được trả về kho.</p> : <p className="small muted">Đơn chưa giữ hàng nên tồn kho không thay đổi.</p>}
        <div className="field">
          <label htmlFor="cancel-reason">
            Lý do hủy<span className="req" aria-hidden="true">*</span>
          </label>
          <input id="cancel-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </div>
        {resolutionFields}
        {paid > 0 ? (
          <div className="alert alert-warn" role="note">
            <span>Đơn đã thu {formatMoney(paid)}. Sau khi hủy, hãy ghi nhận hoàn tiền nếu trả lại cho khách.</span>
          </div>
        ) : null}
        <ErrorAlert message={error} />
      </Dialog>

      <Dialog
        open={dialog === "unconfirm"}
        onClose={() => setDialog(null)}
        title="Hủy xác nhận"
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setDialog(null)}>
              Quay lại
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={pending || (needsWriteOffReason && !writeOffReason.trim())}
              onClick={() => exec(() => unconfirmOrderAction(orderId, choices, writeOffReason))}
            >
              Hủy xác nhận
            </button>
          </>
        }
      >
        <p>Hàng đang giữ sẽ trả về kho, đơn trở về trạng thái Mới để sửa sản phẩm hoặc số lượng, rồi xác nhận lại.</p>
        {resolutionFields}
        <ErrorAlert message={error} />
      </Dialog>
    </>
  );
}
