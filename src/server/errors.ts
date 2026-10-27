/** An error whose message is safe to show to the user (Vietnamese). */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Bạn không có quyền thực hiện thao tác này.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Không tìm thấy dữ liệu.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialActionState: ActionState = { ok: false };

export const INVALID_ID: ActionState = { ok: false, error: "Dữ liệu không hợp lệ. Hãy tải lại trang." };

/** Turns thrown errors into a form state. Unknown errors are logged and shown generically. */
export function toActionState(err: unknown): ActionState {
  if (err instanceof AppError) return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
  // Prisma unique constraint violation
  if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2002") {
    return { ok: false, error: "Dữ liệu bị trùng với một bản ghi đã có." };
  }
  console.error(err);
  return { ok: false, error: "Có lỗi xảy ra, vui lòng thử lại." };
}
