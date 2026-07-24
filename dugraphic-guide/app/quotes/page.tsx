import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getQuotes } from "@/lib/quotes";
import { getBusinessProfile } from "@/lib/businessProfile";
import QuotesTable from "@/components/quotes/QuotesTable";

export default async function QuotesPage() {
  const { role } = await getSessionUser();
  if (role !== "owner") {
    redirect("/");
  }

  const [quotes, businessProfile] = await Promise.all([getQuotes(), getBusinessProfile()]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-14 pt-8 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-[var(--fg)]">견적서</h1>
          <Link
            href="/quotes/new"
            className="flex items-center gap-1.5 text-sm bg-[var(--accent)] text-white px-3 py-1.5 rounded hover:opacity-90 transition-opacity"
          >
            <span className="text-base font-light leading-none">+</span>
            새 견적서
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-14 py-4">
        <QuotesTable quotes={quotes} businessProfile={businessProfile} />
      </div>
    </div>
  );
}
