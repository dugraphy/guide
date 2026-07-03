import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getQuoteById } from "@/lib/quotes";
import { getBusinessProfile } from "@/lib/businessProfile";
import QuoteBuilder from "@/components/quotes/QuoteBuilder";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { role } = await getSessionUser();
  if (role !== "owner") {
    redirect("/");
  }

  const { id } = await params;
  const [quote, businessProfile] = await Promise.all([getQuoteById(id), getBusinessProfile()]);
  if (!quote) notFound();

  return <QuoteBuilder businessProfile={businessProfile} existingQuote={quote} />;
}
