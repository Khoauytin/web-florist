import Link from "next/link";
import { Icon } from "@/components/admin/icon";
import { CustomerForm } from "@/components/admin/customer-form";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Thêm khách hàng" };

export default async function NewCustomerPage() {
  await requireUser();
  return (
    <>
      <Link className="back" href="/admin/customers">
        <Icon name="back" />
        Khách hàng
      </Link>
      <h1 style={{ margin: "8px 0 16px" }}>Thêm khách hàng</h1>
      <CustomerForm customerId={null} initial={{ name: "", phone: "", address: "", note: "" }} />
    </>
  );
}
