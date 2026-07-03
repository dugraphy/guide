"use client";

import { useState } from "react";
import Link from "next/link";
import type { QuoteRow } from "@/lib/quotes";
import type { BusinessProfile } from "@/lib/businessProfile";
import { downloadQuoteExcel } from "@/lib/quoteExcel";

interface Props {
  quote: QuoteRow;
  businessProfile: BusinessProfile;
}

export default function QuoteListRowActions({ quote, businessProfile }: Props) {
  const [downloading, setDownloading] = useState(false);

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
    </div>
  );
}
