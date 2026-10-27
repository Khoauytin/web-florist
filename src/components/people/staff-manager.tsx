"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { FormAlert, SubmitButton } from "@/components/form";
import { Dialog, ErrorAlert, toast } from "@/components/ui";
import { createStaffAction, resetPasswordAction, setLockedAction } from "@/server/actions/people.actions";
import type { ActionState } from "@/server/errors";

export interface StaffRow {
  id: string;
  name: string;
  username: string;
  role: "owner" | "staff";
  banned: boolean;
  lastLogin: string | null;
  isSelf: boolean;
}

function tempPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return "Hoa-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(createStaffAction, { ok: false });
  const [pw] = useState(tempPassword);
  const fe = state.fieldErrors ?? {};
  const reported = useRef(false);
  useEffect(() => {
    if (state.ok && !reported.current) {
      reported.current = true;
      toast("Đã tạo tài khoản nhân viên");
      onDone();
    }
  }, [state, onDone]);
  return (
    <form action={action} className="stack">
      <FormAlert state={state} />
      <div className="field">
        <label htmlFor="st-name">Tên nhân viên<span className="req" aria-hidden="true">*</span></label>
        <input id="st-name" name="name" className="input" required maxLength={120} aria-invalid={fe.name ? true : undefined} />
        {fe.name ? <span className="err">{fe.name}</span> : null}
      </div>
      <div className="field">
        <label htmlFor="st-username">Tên đăng nhập<span className="req" aria-hidden="true">*</span></label>
        <input id="st-username" name="username" className="input" required maxLength={30} autoCapitalize="none" spellCheck={false} aria-describedby="st-username-hint" aria-invalid={fe.username ? true : undefined} />
        {fe.username ? <span className="err">{fe.username}</span> : <span className="hint" id="st-username-hint">3-30 ký tự: a-z, 0-9, dấu chấm, gạch dưới. Ví dụ: thutrang</span>}
      </div>
      <div className="field">
        <label htmlFor="st-password">Mật khẩu tạm<span className="req" aria-hidden="true">*</span></label>
        <input id="st-password" name="password" className="input" required minLength={8} defaultValue={pw} autoComplete="off" aria-describedby="st-pw-hint" />
        <span className="hint" id="st-pw-hint">Gửi mật khẩu này cho nhân viên. Họ sẽ được nhắc đổi sau khi đăng nhập.</span>
      </div>
      <div>
        <SubmitButton>Tạo tài khoản</SubmitButton>
      </div>
    </form>
  );
}

export function StaffManager({ users }: { users: StaffRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<StaffRow | null>(null);
  const [locking, setLocking] = useState<StaffRow | null>(null);
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) {
        toast(r.message ?? "Đã lưu");
        setResetting(null);
        setLocking(null);
        router.refresh();
      } else setError(r.error ?? "Có lỗi xảy ra");
    });

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Nhân viên</h1>
          <p className="sub">Tạo tài khoản, đặt lại mật khẩu, khóa khi nhân viên nghỉ việc.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setCreating(true)}>
          <Icon name="plus" />
          Thêm nhân viên
        </button>
      </div>
      <div className="panel scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Tên đăng nhập</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Đăng nhập gần nhất</th>
              <th>
                <span className="sr">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <b>{u.name}</b>
                  {u.isSelf ? <span className="muted"> (bạn)</span> : null}
                </td>
                <td>{u.username}</td>
                <td>{u.role === "owner" ? "Chủ shop" : "Nhân viên"}</td>
                <td>{u.banned ? <span className="badge st-cancel">Đã khóa</span> : <span className="badge st-done">Đang hoạt động</span>}</td>
                <td style={{ whiteSpace: "nowrap" }}>{u.lastLogin ?? "Chưa đăng nhập"}</td>
                <td className="right" style={{ whiteSpace: "nowrap" }}>
                  {u.role === "staff" ? (
                    <>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setError(null); setPw(tempPassword()); setResetting(u); }}>
                        Đặt lại mật khẩu
                      </button>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setError(null); setLocking(u); }}>
                        {u.banned ? "Mở khóa" : "Khóa"}
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={creating} onClose={() => setCreating(false)} title="Thêm nhân viên">
        {creating ? (
          <CreateForm
            onDone={() => {
              setCreating(false);
              router.refresh();
            }}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={resetting !== null}
        onClose={() => setResetting(null)}
        title={`Đặt lại mật khẩu cho ${resetting?.name ?? ""}`}
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setResetting(null)}>
              Quay lại
            </button>
            <button className="btn btn-primary" type="button" disabled={pending || pw.length < 8} onClick={() => run(() => resetPasswordAction(resetting!.id, pw))}>
              Đặt mật khẩu
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="reset-pw">Mật khẩu tạm mới</label>
          <input id="reset-pw" className="input" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} autoComplete="off" />
          <span className="hint">Tài khoản sẽ bị đăng xuất khỏi mọi thiết bị và được nhắc đổi mật khẩu.</span>
        </div>
        <ErrorAlert message={error} />
      </Dialog>

      <Dialog
        open={locking !== null}
        onClose={() => setLocking(null)}
        title={locking?.banned ? "Mở khóa tài khoản" : "Khóa tài khoản"}
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setLocking(null)}>
              Quay lại
            </button>
            <button className={locking?.banned ? "btn btn-primary" : "btn btn-danger"} type="button" disabled={pending} onClick={() => run(() => setLockedAction(locking!.id, !locking!.banned))}>
              {locking?.banned ? "Mở khóa" : "Khóa tài khoản"}
            </button>
          </>
        }
      >
        <p>{locking?.banned ? `${locking?.name} sẽ đăng nhập lại được.` : `${locking?.name} sẽ bị đăng xuất khỏi mọi thiết bị và không đăng nhập được nữa. Dữ liệu và lịch sử thao tác vẫn được giữ.`}</p>
        <ErrorAlert message={error} />
      </Dialog>
    </>
  );
}
