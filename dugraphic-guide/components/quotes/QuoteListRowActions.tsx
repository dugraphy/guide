"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { QuoteRow } from "@/lib/quotes";
import type { BusinessProfile } from "@/lib/businessProfile";
import { downloadQuoteExcel } from "@/lib/quoteExcel";

interface Props {
  quote: QuoteRow;
  businessProfile: BusinessProfile;
}

export default function QuoteListRowActions({ quote, businessProfile }: Props) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadQuoteExcel({
        businessProfile,
        clientName: quote.clientName,
        quoteDate: quote.quoteDate,
        quoteType: quote.quoteType,
        items: quote.items,
        depositRate: quote.depositRate,
        notes: quote.notes,
        vatIncluded: quote.vatIncluded,
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제에 실패했습니다.");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="text-xs text-[var(--accent)] hover:underline disabled:opacity-50"
      >
        {downloading ? "다운로드 중..." : "다운로드"}
      </button>
      <Link
        href={`/quotes/${quote.id}/edit`}
        className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        수정
      </Link>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-xs text-red-500 hover:underline disabled:opacity-50"
      >
        {deleting ? "삭제 중..." : "삭제"}
      </button>
    </div>
  );
}
