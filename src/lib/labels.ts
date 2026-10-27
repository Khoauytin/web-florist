/** Vietnamese display labels for stored enum values (spec section 6). */

export const ORDER_STATUS_LABELS = {
  NEW: "Mới",
  CONFIRMED: "Đã xác nhận",
  DELIVERING: "Đang giao",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  DELIVERY_FAILED: "Giao thất bại",
} as const;

export type OrderStatusKey = keyof typeof ORDER_STATUS_LABELS;
export const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatusKey[];

export function orderStatusLabel(status: OrderStatusKey, receiveType?: "DELIVERY" | "PICKUP") {
  if (status === "DELIVERING" && receiveType === "PICKUP") return "Sẵn sàng nhận";
  return ORDER_STATUS_LABELS[status];
}

export const ORDER_STATUS_CLASS: Record<OrderStatusKey, string> = {
  NEW: "st-new",
  CONFIRMED: "st-confirmed",
  DELIVERING: "st-delivering",
  COMPLETED: "st-done",
  CANCELLED: "st-cancel",
  DELIVERY_FAILED: "st-failed",
};

export const PRODUCTION_LABELS = {
  NOT_STARTED: "Chưa làm",
  IN_PROGRESS: "Đang làm",
  READY: "Đã đủ hàng",
} as const;

export const PAYMENT_STATE_LABELS = {
  UNPAID: "Chưa thanh toán",
  DEPOSITED: "Đã cọc",
  PAID: "Đã thanh toán đủ",
} as const;

export const CHANNEL_LABELS = {
  FACEBOOK: "Facebook",
  ZALO: "Zalo",
  PHONE: "Điện thoại",
  IN_STORE: "Tại tiệm",
  OTHER: "Khác",
} as const;

export const RECEIVE_TYPE_LABELS = {
  DELIVERY: "Giao tận nơi",
  PICKUP: "Đến lấy",
} as const;

export const FULFILLMENT_LABELS = {
  STOCK_ONLY: "Có sẵn",
  MADE_TO_ORDER: "Làm theo đơn",
  FLEXIBLE: "Linh hoạt",
} as const;

export const FULFILLMENT_HINTS = {
  STOCK_ONLY: "Chỉ bán từ hàng đã làm sẵn. Thiếu hàng thì không xác nhận được đơn.",
  MADE_TO_ORDER: "Luôn làm mới theo từng đơn, không dùng tồn kho.",
  FLEXIBLE: "Lấy hàng sẵn trước, thiếu bao nhiêu thì làm thêm bấy nhiêu.",
} as const;

export const PRODUCT_STATUS_LABELS = {
  ACTIVE: "Đang bán",
  HIDDEN: "Tạm ẩn",
  ARCHIVED: "Lưu trữ",
} as const;

export const PAYMENT_TYPE_LABELS = {
  DEPOSIT: "Cọc",
  PAYMENT: "Thanh toán",
  REFUND: "Hoàn tiền",
} as const;

export const PAYMENT_METHOD_LABELS = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  OTHER: "Khác",
} as const;
