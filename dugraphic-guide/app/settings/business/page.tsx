import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getBusinessProfile } from "@/lib/businessProfile";
import BusinessProfileForm from "@/components/settings/BusinessProfileForm";

export default async function BusinessSettingsPage() {
  const { role } = await getSessionUser();
  if (role !== "owner") {
    redirect("/");
  }

  const profile = await getBusinessProfile();

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-xl font-bold text-[var(--fg)] mb-1">사업자정보 설정</h1>
      <p className="text-xs text-[var(--fg-muted)] mb-6">
        여기서 한 번 입력해두면 새 견적서를 작성할 때 자동으로 채워집니다.
      </p>
      <BusinessProfileForm initialProfile={profile} />
    </div>
  );
}
