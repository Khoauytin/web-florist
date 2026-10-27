import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getCustomer } from "@/server/services/customers.service";
import { NotFoundError } from "@/server/errors";
import { CustomerForm } from "@/components/people/customer-form";

export const metadata = { title: "Sửa khách hàng" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const c = await getCustomer(id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  return (
    <>
      <div className="pagehead">
        <h1>Sửa khách hàng</h1>
      </div>
      <CustomerForm customerId={c.id} initial={{ name: c.name, phone: c.phone, email: c.email ?? "", address: c.address ?? "", note: c.note ?? "" }} />
    </>
  );
}
