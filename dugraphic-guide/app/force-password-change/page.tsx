import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ForcePasswordChangeForm from "@/components/auth/ForcePasswordChangeForm";

export default async function ForcePasswordChangePage() {
  const { userId, mustChangePassword } = await getSessionUser();
  if (!userId) redirect("/login");
  if (!mustChangePassword) redirect("/");

  return <ForcePasswordChangeForm />;
}
