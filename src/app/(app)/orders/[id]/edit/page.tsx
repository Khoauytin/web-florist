import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getOrder } from "@/server/services/orders.service";
import { prisma } from "@/server/db/prisma";
import { OrderForm } from "@/components/orders/order-form";
import type { OrderFormInitial } from "@/components/orders/order-form-model";
import { dbDateToYmd } from "@/lib/dates";

export const metadata = { title: "Sửa đơn" };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const order = await getOrder(id, { includeCost: user.role === "owner" });
  if (!order) notFound();
  if (order.status === "COMPLETED" || order.status === "CANCELLED") redirect(`/orders/${id}`);

  const productIds = order.items.map((i) => i.productId).filter((x): x is string => Boolean(x));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, code: true, name: true, price: true, fulfillmentMode: true, onHand: true, reserved: true, images: { where: { isPrimary: true }, select: { url: true }, take: 1 } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const full = order.status === "NEW";

  const initial: OrderFormInitial = {
    customerId: order.customerId,
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    customerAddress: order.customer.address ?? "",
    sameRecipient: order.recipientName === order.customer.name && order.recipientPhone === order.customer.phone,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    channel: order.channel,
    receiveType: order.receiveType,
    deliveryAddress: order.deliveryAddress ?? "",
    deliveryDate: order.deliveryDate ? dbDateToYmd(order.deliveryDate) : "",
    deliveryTimeFrom: order.deliveryTimeFrom ?? "",
    deliveryTimeTo: order.deliveryTimeTo ?? "",
    courierName: order.courierName ?? "",
    discount: order.discount,
    shippingFee: order.shippingFee,
    cardMessage: order.cardMessage ?? "",
    note: order.note ?? "",
    lines: order.items.map((it) => {
      const p = it.productId ? byId.get(it.productId) : undefined;
      return {
        key: it.id,
        id: it.id,
        product: p
          ? { id: p.id, code: p.code, name: p.name, price: p.price, mode: p.fulfillmentMode, available: p.onHand - p.reserved, imageUrl: p.images[0]?.url ?? null }
          : null,
        // Existing lines keep the name and price agreed when the order was taken.
        name: it.nameSnapshot,
        unitPrice: it.unitPriceSnapshot,
        qty: it.qtyOrdered,
        note: it.note ?? "",
      };
    }),
  };

  return (
    <div style={{ paddingBottom: 120 }}>
      <OrderForm variant={full ? "edit" : "logistics"} initial={initial} orderId={order.id} role={user.role} code={order.code} />
    </div>
  );
}
