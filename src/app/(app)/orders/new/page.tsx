import { requireUser } from "@/server/auth/session";
import { findCustomerByPhone } from "@/server/services/customers.service";
import { OrderForm } from "@/components/orders/order-form";
import { emptyOrder } from "@/components/orders/order-form-model";
import { one, type SearchParams } from "@/lib/search-params";

export const metadata = { title: "Tạo đơn mới" };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const initial = emptyOrder();
  const phone = one(sp, "phone");
  const customer = phone ? await findCustomerByPhone(phone) : null;
  if (customer) {
    Object.assign(initial, {
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address ?? "",
      deliveryAddress: customer.address ?? "",
    });
  }
  return (
    <div style={{ paddingBottom: 120 }}>
      <OrderForm variant="create" initial={initial} role={user.role} />
    </div>
  );
}
