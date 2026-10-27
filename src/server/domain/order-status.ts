export type OrderStatus = "NEW" | "CONFIRMED" | "DELIVERING" | "COMPLETED" | "CANCELLED" | "DELIVERY_FAILED";
export type Role = "owner" | "staff";

export type OrderAction =
  | "confirm"
  | "unconfirm"
  | "start_delivery"
  | "complete"
  | "fail_delivery"
  | "retry_delivery"
  | "cancel";

interface Transition {
  from: OrderStatus[];
  to: OrderStatus;
  roles: Role[];
}

/** Spec 5.1. "cancel" from NEW is allowed for staff; from any other status owner only. */
export const TRANSITIONS: Record<OrderAction, Transition> = {
  confirm: { from: ["NEW"], to: "CONFIRMED", roles: ["owner", "staff"] },
  unconfirm: { from: ["CONFIRMED"], to: "NEW", roles: ["owner"] },
  start_delivery: { from: ["CONFIRMED"], to: "DELIVERING", roles: ["owner", "staff"] },
  complete: { from: ["DELIVERING"], to: "COMPLETED", roles: ["owner", "staff"] },
  fail_delivery: { from: ["DELIVERING"], to: "DELIVERY_FAILED", roles: ["owner", "staff"] },
  retry_delivery: { from: ["DELIVERY_FAILED"], to: "DELIVERING", roles: ["owner", "staff"] },
  cancel: { from: ["NEW", "CONFIRMED", "DELIVERY_FAILED"], to: "CANCELLED", roles: ["owner", "staff"] },
};

export function canPerform(action: OrderAction, status: OrderStatus, role: Role): boolean {
  const t = TRANSITIONS[action];
  if (!t.from.includes(status) || !t.roles.includes(role)) return false;
  if (action === "cancel" && status !== "NEW" && role !== "owner") return false;
  return true;
}

/** Statuses in which stock is held and production can be updated. */
export const ACTIVE_STATUSES: OrderStatus[] = ["CONFIRMED", "DELIVERING", "DELIVERY_FAILED"];
/** Statuses that count as "cần giao" on a given day. */
export const DELIVERY_DUE_STATUSES: OrderStatus[] = ["CONFIRMED", "DELIVERING", "DELIVERY_FAILED"];

export function isEditableFull(status: OrderStatus) {
  return status === "NEW";
}

export function isEditableLogistics(status: OrderStatus) {
  return status === "NEW" || ACTIVE_STATUSES.includes(status);
}

export type ProductionState = "NOT_STARTED" | "IN_PROGRESS" | "READY";

export interface ProductionLine {
  qtyToMake: number;
  qtyMade: number;
}

/** Spec 5.2. Returns null when production does not apply (order not allocated / finished). */
export function productionState(status: OrderStatus, lines: ProductionLine[]): ProductionState | null {
  if (!ACTIVE_STATUSES.includes(status)) return null;
  if (lines.every((l) => l.qtyMade >= l.qtyToMake)) return "READY";
  return lines.some((l) => l.qtyMade > 0) ? "IN_PROGRESS" : "NOT_STARTED";
}

export function remainingToMake(lines: ProductionLine[]): number {
  return lines.reduce((s, l) => s + Math.max(0, l.qtyToMake - l.qtyMade), 0);
}
