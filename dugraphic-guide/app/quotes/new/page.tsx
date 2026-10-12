import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getBusinessProfile } from "@/lib/businessProfile";
import { getQuoteById } from "@/lib/quotes";
import QuoteBuilder from "@/components/quotes/QuoteBuilder";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { role } = await getSessionUser();
  if (role !== "owner") {
    redirect("/");
  }

  const { from } = await searchParams;
  const cloneId = typeof from === "string" ? from : undefined;

  const [businessProfile, cloneFrom] = await Promise.all([
    getBusinessProfile(),
    cloneId ? getQuoteById(cloneId) : Promise.resolve(undefined),
  ]);

  return <QuoteBuilder businessProfile={businessProfile} cloneFrom={cloneFrom} />;
}
