import { requireOwnerPage } from "@/server/auth/session";
import { listUsers } from "@/server/services/users.service";
import { StaffManager } from "@/components/people/staff-manager";
import { formatDateTime } from "@/lib/dates";

export const metadata = { title: "Nhân viên" };

export default async function StaffPage() {
  const me = await requireOwnerPage();
  const users = await listUsers();
  return (
    <StaffManager
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username ?? "",
        role: u.role === "owner" ? "owner" : "staff",
        banned: Boolean(u.banned),
        lastLogin: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : null,
        isSelf: u.id === me.id,
      }))}
    />
  );
}
