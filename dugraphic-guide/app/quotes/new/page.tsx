import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getBusinessProfile } from "@/lib/businessProfile";
import QuoteBuilder from "@/components/quotes/QuoteBuilder";

export default async function NewQuotePage() {
  const { role } = await getSessionUser();
  if (role !== "owner") {
    redirect("/");
  }

  const businessProfile = await getBusinessProfile();

  return <QuoteBuilder businessProfile={businessProfile} />;
}
