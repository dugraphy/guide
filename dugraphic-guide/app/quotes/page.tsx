import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getQuotes } from "@/lib/quotes";
import { formatCurrency } from "@/lib/format";

export default async function QuotesPage() {
  const { role } = await getSessionUser();
  if (role !== "owner") {
    redirect("/");
  }

  const quotes = await getQuotes();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-8 pt-8 pb-0 shrink-0">
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

      <div className="flex-1 overflow-auto px-8 py-4">
        {quotes.length === 0 ? (
          <div className="text-center py-12 text-sm text-[var(--fg-muted)]">
            아직 다운로드한 견적서가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)] shadow-sm">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--fg-muted)] bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                    의뢰인명
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--fg-muted)] bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                    견적유형
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--fg-muted)] bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                    견적일자
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-[var(--fg-muted)] bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                    총 청구액
                  </th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote, idx) => {
                  const total = quote.items.reduce(
                    (sum, item) => sum + item.discountPrice * item.qty,
                    0
                  );
                  return (
                    <tr
                      key={quote.id}
                      className={`transition-colors duration-150 hover:bg-[var(--hover)] ${
                        idx % 2 === 1 ? "bg-[var(--bg-secondary)]/40" : ""
                      }`}
                    >
                      <td className="px-3 py-2.5 border-b border-[var(--border)] text-[var(--fg)]">
                        {quote.clientName}
                      </td>
                      <td className="px-3 py-2.5 border-b border-[var(--border)] text-[var(--fg-muted)]">
                        {quote.quoteType}
                      </td>
                      <td className="px-3 py-2.5 border-b border-[var(--border)] text-[var(--fg-muted)]">
                        {quote.quoteDate}
                      </td>
                      <td className="px-3 py-2.5 border-b border-[var(--border)] text-right text-[var(--fg)]">
                        {formatCurrency(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
