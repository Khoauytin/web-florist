/** Vietnamese labels for stored enum values. */

export const ORDER_STATUS_LABELS = {
  NEW: "Mới",
  DELIVERING: "Đang giao",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Hủy",
} as const;
export type OrderStatusKey = keyof typeof ORDER_STATUS_LABELS;
export const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatusKey[];

export const CHANNEL_LABELS = {
  FACEBOOK: "Facebook",
  ZALO: "Zalo",
  TIKTOK: "TikTok",
  PHONE: "Điện thoại",
  IN_STORE: "Tại tiệm",
} as const;
export type ChannelKey = keyof typeof CHANNEL_LABELS;

export const RECEIVE_TYPE_LABELS = {
  DELIVERY: "Giao tận nơi",
  PICKUP: "Đến lấy",
} as const;
