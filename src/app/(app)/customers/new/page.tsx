import { requireUser } from "@/server/auth/session";
import { CustomerForm } from "@/components/people/customer-form";

export const metadata = { title: "Thêm khách hàng" };

export default async function NewCustomerPage() {
  await requireUser();
  return (
    <>
      <div className="pagehead">
        <h1>Thêm khách hàng</h1>
      </div>
      <CustomerForm customerId={null} initial={{ name: "", phone: "", email: "", address: "", note: "" }} />
    </>
  );
}
