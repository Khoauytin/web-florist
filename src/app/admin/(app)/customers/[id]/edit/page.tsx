import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer } from "@/server/services/customers.service";
import { NotFoundError } from "@/server/errors";
import { Icon } from "@/components/admin/icon";
import { CustomerForm } from "@/components/admin/customer-form";
import { isUuid } from "@/lib/ids";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Sửa khách hàng" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const c = await getCustomer(id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  return (
    <>
      <Link className="back" href={`/admin/customers/${id}`}>
        <Icon name="back" />
        {c.name}
      </Link>
      <h1 style={{ margin: "8px 0 16px" }}>Sửa khách hàng</h1>
      <CustomerForm customerId={c.id} initial={{ name: c.name, phone: c.phone, address: c.address ?? "", note: c.note ?? "" }} />
    </>
  );
}
