export type OrderStatus = "NEW" | "DELIVERING" | "COMPLETED" | "CANCELLED";
export type StatusMove = "next" | "back" | "cancel" | "restore";

/** Spec 4, "Trạng thái đơn". Returns the target status, or null when the move is not allowed. */
export function moveStatus(from: OrderStatus, move: StatusMove): OrderStatus | null {
  switch (move) {
    case "next":
      return from === "NEW" ? "DELIVERING" : from === "DELIVERING" ? "COMPLETED" : null;
    case "back":
      return from === "DELIVERING" ? "NEW" : from === "COMPLETED" ? "DELIVERING" : null;
    case "cancel":
      return from === "NEW" || from === "DELIVERING" ? "CANCELLED" : null;
    case "restore":
      return from === "CANCELLED" ? "NEW" : null;
  }
}

/** Hard delete is only for mistakes: new or cancelled orders. */
export const canDelete = (status: OrderStatus) => status === "NEW" || status === "CANCELLED";
