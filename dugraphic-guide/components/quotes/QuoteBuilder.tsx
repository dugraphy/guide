"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BusinessProfile } from "@/lib/businessProfile";
import type { QuoteItem, QuoteRow, QuoteType } from "@/lib/quotes";
import { formatCurrency } from "@/lib/format";
import { calcQuoteTotals, downloadQuoteExcel } from "@/lib/quoteExcel";
import { TABLE } from "@/components/table/tableStyles";

type VatMode = "exclusive" | "inclusive";

// 부가세 포함/별도 안내는 엑셀 하단의 "* 부가세(10%)가 포함된 금액입니다" 각주가
// vatIncluded 값에 따라 자동으로 표시하므로, 여기 기본 안내사항에는 넣지 않는다.
const DEFAULT_NOTES: Record<QuoteType, string> = {
  리뉴얼:
    "1. 본 견적은 기존 서비스의 유지보수 및 디자인 개편을 기준으로 작성되었습니다.\n" +
    "2. 견적 유효기간은 발행일로부터 14일입니다.\n" +
    "3. 계약금 입금 확인 후 작업이 시작되며, 잔금은 작업 완료 후 지급합니다.\n" +
    "4. 진행 중 추가 요청사항이 발생할 경우 별도 협의 후 견적이 변경될 수 있습니다.",
  신규:
    "계약 성립 및 효력 발생\n" +
    "•  계약금을 입금함으로써 본 계약 및 서비스 약관을 확인하고 동의한 것으로 간주하며, 입금 시점부터 계약 효력이 발생합니다.\n" +
    "•  계약 전 계약서 및 서비스 약관을 반드시 정독해야 하며, 미숙지로 인한 책임은 의뢰인에게 있습니다.\n" +
    "진행 시스템\n" +
    "•  의뢰 접수 및 상담 → 계약금 입금 및 계약 체결 → 시안 작업 및 검토 → 최종 검수 및 청구액 입금 → 도메인/호스팅 연결 및 SEO 세팅 → 결과물 제공 및 유지보수\n" +
    "계약 확정 및 홈페이지 제공\n" +
    "•  계약금은 시안 작업 비용이며, 계약금 입금 시 계약이 확정됩니다.\n" +
    "•  홈페이지 제작이 완료되면 잔금 입금 시 홈페이지가 제공됩니다.\n" +
    "검수 및 책임\n" +
    "•  홈페이지 결과물 인도 후 3일 이내에 의뢰인의 이의 제기가 없을 경우, 검수가 완료된 것으로 간주합니다.\n" +
    "•  이의 제기에 따른 수정이 진행되는 경우에도 최초 인도일로부터 총 7일을 초과할 수 없으며, 해당 기간이 경과하면 자동으로 검수가 완료된 것으로 간주합니다.\n" +
    "•  검수 완료(간주 포함) 이후 발생하는 문제에 대해서는 수주인이 책임지지 않습니다.\n" +
    "계약금 환불\n" +
    "•  시안이 마음에 들지 않을 시 계약금 전액 환불이 가능합니다.\n" +
    "•  단, 의뢰인이 문자, 카카오톡, 이메일 등을 통해 시안에 대한 승인 의사를 명시적으로 전달한 이후에는 본 조항이 적용되지 않으며, 이후 절차는 「시안 승인 후 취소」 조항을 따릅니다.\n" +
    "호스팅 서버 및 콘텐츠 사용\n" +
    "•  호스팅 서버 사용 계약 종료 시 홈페이지에 사용된 이미지, 사진 등 콘텐츠의 사용이 중단됩니다.\n" +
    "시안 승인 후 취소\n" +
    "•  의뢰인이 문자, 카카오톡, 이메일 등을 통해 시안에 대해 명시적으로 승인 의사를 전달한 이후 본 작업이 진행된 경우, 계약금은 환불되지 않습니다.\n" +
    "수정 사항\n" +
    "•  시안 작업 시 수정 사항은 무제한으로 진행됩니다. 단, 페이지 전체 구조 변경, 메뉴 체계 개편, 디자인 콘셉트 전면 교체 등 최초 기획과 다른 새로운 작업으로 볼 수 있는 경우에는 별도 협의 후 진행됩니다.\n" +
    "•  작업 완료 후 수정 사항은 문자, 카카오톡, 이메일로 신청 가능합니다. 오탈자 수정, 간단한 텍스트·이미지 교체 등 경미한 수정은 무상으로 지원하며, 신규 페이지 추가, 디자인 변경 등 추가 작업이 필요한 경우 별도 견적 후 진행됩니다.\n" +
    "본 계약서는 위 조건에 따라 의뢰인과 수주인 쌍방이 합의하였음을 확인합니다.",
};

function emptyItem(): QuoteItem {
  return { name: "", unitPrice: 0, discountPrice: 0, qty: 1, note: "" };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  businessProfile: BusinessProfile;
  existingQuote?: QuoteRow;
}

export default function QuoteBuilder({ businessProfile, existingQuote }: Props) {
  const router = useRouter();
  const [quoteType, setQuoteType] = useState<QuoteType | null>(existingQuote?.quoteType ?? null);
  const [clientName, setClientName] = useState(existingQuote?.clientName ?? "");
  const [quoteDate, setQuoteDate] = useState(existingQuote?.quoteDate ?? todayISO());
  const [items, setItems] = useState<QuoteItem[]>(existingQuote?.items ?? [emptyItem()]);
  const [depositRate, setDepositRate] = useState(existingQuote?.depositRate ?? 30);
  const [notes, setNotes] = useState(existingQuote?.notes ?? "");
  const [vatMode, setVatMode] = useState<VatMode>(
    existingQuote?.vatIncluded ? "inclusive" : "exclusive"
  );
  const [downloading, setDownloading] = useState(false);

  const totals = useMemo(
    () => calcQuoteTotals(items, depositRate, vatMode === "inclusive"),
    [items, depositRate, vatMode]
  );

  const selectType = (type: QuoteType) => {
    setQuoteType(type);
    setNotes(DEFAULT_NOTES[type]);
  };

  const resetForm = () => {
    setQuoteType(null);
    setClientName("");
    setQuoteDate(todayISO());
    setItems([emptyItem()]);
    setDepositRate(30);
    setNotes("");
    setVatMode("exclusive");
  };

  const updateItem = (index: number, patch: Partial<QuoteItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const handleDownload = async () => {
    if (!quoteType) return;
    if (!clientName.trim()) {
      alert("업체명을 입력해주세요.");
      return;
    }
    setDownloading(true);
    const vatIncluded = vatMode === "inclusive";
    try {
      await downloadQuoteExcel({
        businessProfile,
        clientName,
        quoteDate,
        quoteType,
        items,
        depositRate,
        notes,
        vatIncluded,
      });

      const isEdit = !!existingQuote;
      const res = await fetch(isEdit ? `/api/quotes/${existingQuote.id}` : "/api/quotes", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, quoteDate, quoteType, items, depositRate, notes, vatIncluded }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "견적서 기록 저장에 실패했습니다. (엑셀 파일은 다운로드되었습니다)");
      } else if (isEdit) {
        router.push("/quotes");
      } else {
        router.refresh();
      }
    } finally {
      setDownloading(false);
      if (!existingQuote) resetForm();
    }
  };

  if (!quoteType) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <h1 className="text-xl font-bold text-[var(--fg)] mb-2">새 견적서</h1>
        <p className="text-sm text-[var(--fg-muted)] mb-8">견적 유형을 선택해주세요.</p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => selectType("리뉴얼")}
            className="flex-1 max-w-[200px] px-6 py-8 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--hover)] transition-colors"
          >
            <div className="text-lg font-semibold text-[var(--fg)] mb-1">리뉴얼</div>
            <div className="text-xs text-[var(--fg-muted)]">기존 서비스 유지보수 · 디자인 개편</div>
          </button>
          <button
            onClick={() => selectType("신규")}
            className="flex-1 max-w-[200px] px-6 py-8 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--hover)] transition-colors"
          >
            <div className="text-lg font-semibold text-[var(--fg)] mb-1">신규</div>
            <div className="text-xs text-[var(--fg-muted)]">처음 제작하는 프로젝트</div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--fg)]">
          {existingQuote ? "견적서 수정" : "새 견적서"}{" "}
          <span className="text-sm font-normal text-[var(--fg-muted)]">· {quoteType}</span>
        </h1>
        <button
          onClick={() => (existingQuote ? setQuoteType(null) : resetForm())}
          className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          유형 다시 선택
        </button>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--fg)]">사업자정보</h2>
          <Link href="/settings/business" className="text-xs text-[var(--accent)] hover:underline">
            수정하기
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-sm">
          <div><span className="text-[var(--fg-muted)]">상호 </span>{businessProfile.companyName || "-"}</div>
          <div><span className="text-[var(--fg-muted)]">사업자번호 </span>{businessProfile.businessNumber || "-"}</div>
          <div><span className="text-[var(--fg-muted)]">대표자 </span>{businessProfile.ownerName || "-"}</div>
          <div><span className="text-[var(--fg-muted)]">전화번호 </span>{businessProfile.phone || "-"}</div>
          <div className="col-span-2"><span className="text-[var(--fg-muted)]">주소 </span>{businessProfile.address || "-"}</div>
          <div><span className="text-[var(--fg-muted)]">이메일 </span>{businessProfile.email || "-"}</div>
          <div className="col-span-2">
            <span className="text-[var(--fg-muted)]">계좌 </span>
            {businessProfile.bankName || businessProfile.accountNumber || businessProfile.accountHolder
              ? `${businessProfile.bankName} ${businessProfile.accountNumber} 입금자명: ${businessProfile.accountHolder}`
              : "-"}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[var(--fg)] mb-3">견적 정보</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">업체명</label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="업체명을 입력하세요"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">견적일자</label>
            <input
              type="date"
              value={quoteDate}
              onChange={(e) => setQuoteDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--fg)]">품목</h2>
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 text-xs bg-[var(--accent)] text-white px-2.5 py-1 rounded hover:opacity-90 transition-opacity"
          >
            <span className="text-sm font-light leading-none">+</span> 행 추가
          </button>
        </div>
        <div className={TABLE.wrapper}>
          <table className={`${TABLE.table} w-full`}>
            <thead>
              <tr>
                <th className={`${TABLE.th} w-12`}>No</th>
                <th className={TABLE.th}>품목</th>
                <th className={`${TABLE.th} w-28`}>단가</th>
                <th className={`${TABLE.th} w-28`}>할인단가</th>
                <th className={`${TABLE.th} w-16`}>수량</th>
                <th className={`${TABLE.th} w-28`}>공급가</th>
                <th className={TABLE.th}>비고</th>
                <th className={TABLE.thAction} />
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className={TABLE.tr(i)}>
                  <td className={TABLE.td}>
                    <span className={`${TABLE.cellReadOnly} text-center`}>{i + 1}</span>
                  </td>
                  <td className={TABLE.td}>
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                      placeholder="품목명"
                      className={TABLE.cellInput}
                    />
                  </td>
                  <td className={TABLE.td}>
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) })}
                      className={`${TABLE.cellInput} text-right`}
                    />
                  </td>
                  <td className={TABLE.td}>
                    <input
                      type="number"
                      value={item.discountPrice}
                      onChange={(e) => updateItem(i, { discountPrice: Number(e.target.value) })}
                      className={`${TABLE.cellInput} text-right`}
                    />
                  </td>
                  <td className={TABLE.td}>
                    <input
                      type="number"
                      value={item.qty}
                      onChange={(e) => updateItem(i, { qty: Number(e.target.value) })}
                      className={`${TABLE.cellInput} text-right`}
                    />
                  </td>
                  <td className={TABLE.td}>
                    <span className={`${TABLE.cellReadOnly} text-right`}>
                      {formatCurrency(item.discountPrice * item.qty)}
                    </span>
                  </td>
                  <td className={TABLE.td}>
                    <input
                      value={item.note}
                      onChange={(e) => updateItem(i, { note: e.target.value })}
                      placeholder="비고"
                      className={TABLE.cellInput}
                    />
                  </td>
                  <td className={TABLE.tdAction}>
                    <button onClick={() => removeItem(i)} className={TABLE.deleteBtn}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[var(--fg-muted)] mt-2">
          * 공급가는 할인단가 × 수량으로 자동 계산되며, 부가세는 포함되지 않습니다 (부가세 별도).
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--fg)]">합계</h2>
          <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
            <button
              onClick={() => setVatMode("exclusive")}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                vatMode === "exclusive"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              부가세 별도
            </button>
            <button
              onClick={() => setVatMode("inclusive")}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                vatMode === "inclusive"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              부가세 포함
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4 space-y-2 text-sm max-w-md ml-auto">
          <div className="flex justify-between">
            <span className="text-[var(--fg-muted)]">총 공급가액(할인 전)</span>
            <span className="text-[var(--fg)]">{formatCurrency(totals.totalBeforeDiscount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--fg-muted)]">할인 금액</span>
            <span className="text-[var(--fg)]">{formatCurrency(totals.discountAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--fg-muted)]">총 공급가액(할인 후)</span>
            <span className="text-[var(--fg)]">{formatCurrency(totals.totalAfterDiscount)}</span>
          </div>
          {vatMode === "inclusive" && (
            <>
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">부가세(10%)</span>
                <span className="text-[var(--fg)]">{formatCurrency(totals.vat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">합계금액</span>
                <span className="text-[var(--fg)]">{formatCurrency(totals.grandTotal)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center">
            <span className="text-[var(--fg-muted)]">계약금 비율</span>
            <span className="flex items-center gap-1 text-[var(--fg)]">
              <input
                type="number"
                value={depositRate}
                onChange={(e) => setDepositRate(Number(e.target.value))}
                className="w-14 px-1.5 py-0.5 text-right border border-[var(--border)] rounded bg-[var(--bg)] outline-none focus:border-[var(--accent)]"
              />
              %
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--fg-muted)]">계약금</span>
            <span className="text-[var(--fg)]">{formatCurrency(totals.deposit)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--fg-muted)]">잔금</span>
            <span className="text-[var(--fg)]">{formatCurrency(totals.balance)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-[var(--border)] font-semibold text-[var(--fg)]">
            <span>총 청구액</span>
            <span>{formatCurrency(totals.totalBilled)}</span>
          </div>
          <p className="text-xs text-[var(--fg-muted)] pt-1">
            {vatMode === "inclusive" ? "* 부가세(10%) 포함 금액입니다" : "* 부가세 별도"}
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[var(--fg)] mb-3">안내사항</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
        />
      </section>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="px-5 py-2.5 text-sm font-medium bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {downloading ? "다운로드 중..." : "엑셀로 다운로드"}
        </button>
      </div>
    </div>
  );
}
