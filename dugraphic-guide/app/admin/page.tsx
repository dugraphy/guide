import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getAccounts } from "@/lib/admin-users";
import AdminClient from "@/components/admin/AdminClient";

export default async function AdminPage() {
  const { userId, role } = await getSessionUser();
  if (role !== "owner") {
    redirect("/");
  }

  const accounts = await getAccounts();

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-xl font-bold text-[var(--fg)] mb-6">관리자</h1>
      <AdminClient accounts={accounts} currentUserId={userId} />
    </div>
  );
}
