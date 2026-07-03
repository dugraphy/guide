"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QuoteRow } from "@/lib/quotes";
import type { BusinessProfile } from "@/lib/businessProfile";
import { formatCurrency } from "@/lib/format";
import { calcQuoteTotals } from "@/lib/quoteExcel";
import QuoteListRowActions from "@/components/quotes/QuoteListRowActions";

interface Props {
  quotes: QuoteRow[];
  businessProfile: BusinessProfile;
}

export default function QuotesTable({ quotes, businessProfile }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const allSelected = quotes.length > 0 && selected.size === quotes.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(quotes.map((q) => q.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}개 견적서를 삭제하시겠습니까?`)) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error("삭제에 실패했습니다.");
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setBulkDeleting(false);
    }
  };

  if (quotes.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-[var(--fg-muted)]">
        아직 다운로드한 견적서가 없습니다.
      </div>
    );
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex items-center justify-end mb-3">
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="text-xs bg-red-500 text-white px-3 py-1.5 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {bulkDeleting ? "삭제 중..." : `선택 삭제 (${selected.size}개)`}
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="w-10 px-3 py-2.5 text-xs font-medium text-[var(--fg-muted)] bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="전체 선택"
                />
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--fg-muted)] bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                업체명
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
              <th className="w-44 px-3 py-2.5 text-xs font-medium text-[var(--fg-muted)] bg-[var(--bg-secondary)] border-b border-[var(--border)]" />
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote, idx) => {
              const total = calcQuoteTotals(quote.items, quote.depositRate, quote.vatIncluded)
                .totalBilled;
              return (
                <tr
                  key={quote.id}
                  className={`transition-colors duration-150 hover:bg-[var(--hover)] ${
                    idx % 2 === 1 ? "bg-[var(--bg-secondary)]/40" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 border-b border-[var(--border)]">
                    <input
                      type="checkbox"
                      checked={selected.has(quote.id)}
                      onChange={() => toggleOne(quote.id)}
                      aria-label={`${quote.clientName} 선택`}
                    />
                  </td>
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
                  <td className="px-3 py-2.5 border-b border-[var(--border)]">
                    <QuoteListRowActions quote={quote} businessProfile={businessProfile} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
