import { todayVn } from "@/lib/dates";
import type { CHANNEL_LABELS } from "@/lib/labels";

/** Shared by the server pages that prepare the order form and the client form itself. */
export type FulfillmentModeKey = "STOCK_ONLY" | "MADE_TO_ORDER" | "FLEXIBLE";

export interface ProductOption {
  id: string;
  code: string;
  name: string;
  price: number | null;
  mode: FulfillmentModeKey;
  available: number;
  imageUrl: string | null;
}

export interface FormLine {
  key: string;
  /** existing order line id when editing; the server keeps its name/price snapshot */
  id?: string;
  product: ProductOption | null;
  name: string;
  unitPrice: number | null;
  qty: number;
  note: string;
}

export interface OrderFormInitial {
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  sameRecipient: boolean;
  recipientName: string;
  recipientPhone: string;
  channel: keyof typeof CHANNEL_LABELS;
  receiveType: "DELIVERY" | "PICKUP";
  deliveryAddress: string;
  deliveryDate: string;
  deliveryTimeFrom: string;
  deliveryTimeTo: string;
  courierName: string;
  discount: number;
  shippingFee: number;
  cardMessage: string;
  note: string;
  lines: FormLine[];
}

export function emptyOrder(): OrderFormInitial {
  return {
    customerId: null,
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    sameRecipient: true,
    recipientName: "",
    recipientPhone: "",
    channel: "FACEBOOK",
    receiveType: "DELIVERY",
    deliveryAddress: "",
    deliveryDate: todayVn(),
    deliveryTimeFrom: "",
    deliveryTimeTo: "",
    courierName: "",
    discount: 0,
    shippingFee: 0,
    cardMessage: "",
    note: "",
    lines: [],
  };
}
