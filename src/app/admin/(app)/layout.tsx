import { requireUser } from "@/server/auth/session";
import { getShopSettings } from "@/server/services/settings.service";
import { Shell } from "@/components/admin/shell";
import { Toaster } from "@/components/admin/ui";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const settings = await getShopSettings();
  return (
    <>
      <Shell shopName={settings.shopName}>{children}</Shell>
      <Toaster />
    </>
  );
}
