"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import type { BusinessProfile } from "@/lib/businessProfile";
import type { QuoteItem, QuoteType } from "@/lib/quotes";
import { formatCurrency } from "@/lib/format";
import { TABLE } from "@/components/table/tableStyles";

const DEFAULT_NOTES: Record<QuoteType, string> = {
  리뉴얼:
    "1. 본 견적은 기존 서비스의 유지보수 및 디자인 개편을 기준으로 작성되었습니다.\n" +
    "2. 견적 유효기간은 발행일로부터 14일입니다.\n" +
    "3. 계약금 입금 확인 후 작업이 시작되며, 잔금은 작업 완료 후 지급합니다.\n" +
    "4. 상기 금액은 부가세 별도입니다.\n" +
    "5. 진행 중 추가 요청사항이 발생할 경우 별도 협의 후 견적이 변경될 수 있습니다.",
  신규:
    "1. 본 견적은 신규 프로젝트 제작을 기준으로 작성되었습니다.\n" +
    "2. 견적 유효기간은 발행일로부터 14일입니다.\n" +
    "3. 계약금 입금 확인 후 작업이 시작되며, 잔금은 작업 완료 후 지급합니다.\n" +
    "4. 상기 금액은 부가세 별도입니다.\n" +
    "5. 프로젝트 범위(페이지 수, 기능 등)는 상호 협의된 내용을 기준으로 하며, 범위 변경 시 견적이 조정될 수 있습니다.",
};

function emptyItem(): QuoteItem {
  return { name: "", unitPrice: 0, discountPrice: 0, qty: 1, note: "" };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  businessProfile: BusinessProfile;
}

export default function QuoteBuilder({ businessProfile }: Props) {
  const router = useRouter();
  const [quoteType, setQuoteType] = useState<QuoteType | null>(null);
  const [clientName, setClientName] = useState("");
  const [quoteDate, setQuoteDate] = useState(todayISO());
  const [items, setItems] = useState<QuoteItem[]>([emptyItem()]);
  const [depositRate, setDepositRate] = useState(30);
  const [notes, setNotes] = useState("");
  const [downloading, setDownloading] = useState(false);

  const totals = useMemo(() => {
    const totalBeforeDiscount = items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
    const totalAfterDiscount = items.reduce((sum, it) => sum + it.discountPrice * it.qty, 0);
    const discountAmount = totalBeforeDiscount - totalAfterDiscount;
    const deposit = totalAfterDiscount * (depositRate / 100);
    const balance = totalAfterDiscount - deposit;
    return {
      totalBeforeDiscount,
      totalAfterDiscount,
      discountAmount,
      deposit,
      balance,
      totalBilled: totalAfterDiscount,
    };
  }, [items, depositRate]);

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
  };

  const updateItem = (index: number, patch: Partial<QuoteItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const handleDownload = async () => {
    if (!quoteType) return;
    if (!clientName.trim()) {
      alert("의뢰인명을 입력해주세요.");
      return;
    }
    setDownloading(true);
    try {
      const rows: (string | number)[][] = [];
      rows.push(["견적서"]);
      rows.push([]);
      rows.push(["상호", businessProfile.companyName, "", "사업자번호", businessProfile.businessNumber]);
      rows.push(["대표자", businessProfile.ownerName, "", "전화번호", businessProfile.phone]);
      rows.push(["주소", businessProfile.address, "", "이메일", businessProfile.email]);
      rows.push([]);
      rows.push(["의뢰인명", clientName, "", "견적일자", quoteDate]);
      rows.push(["견적유형", quoteType]);
      rows.push([]);
      rows.push(["No", "품목", "단가", "할인단가", "수량", "공급가(부가세 별도)", "비고"]);
      items.forEach((item, i) => {
        rows.push([
          i + 1,
          item.name,
          item.unitPrice,
          item.discountPrice,
          item.qty,
          item.discountPrice * item.qty,
          item.note,
        ]);
      });
      rows.push([]);
      rows.push(["총 공급가액(할인 전)", totals.totalBeforeDiscount]);
      rows.push(["할인 금액", totals.discountAmount]);
      rows.push(["총 공급가액(할인 후)", totals.totalAfterDiscount]);
      rows.push([`계약금 (${depositRate}%)`, totals.deposit]);
      rows.push(["잔금", totals.balance]);
      rows.push(["총 청구액", totals.totalBilled]);
      rows.push(["* 상기 금액은 부가세 별도입니다."]);
      rows.push([]);
      rows.push(["안내사항"]);
      notes.split("\n").forEach((line) => rows.push([line]));

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [
        { wch: 16 },
        { wch: 24 },
        { wch: 12 },
        { wch: 12 },
        { wch: 8 },
        { wch: 18 },
        { wch: 20 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "견적서");
      XLSX.writeFile(wb, `견적서_${clientName}_${quoteDate}.xlsx`);

      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, quoteDate, quoteType, items, depositRate, notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "견적서 기록 저장에 실패했습니다. (엑셀 파일은 다운로드되었습니다)");
      } else {
        router.refresh();
      }
    } finally {
      setDownloading(false);
      resetForm();
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
          새 견적서 <span className="text-sm font-normal text-[var(--fg-muted)]">· {quoteType}</span>
        </h1>
        <button onClick={resetForm} className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]">
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
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[var(--fg)] mb-3">견적 정보</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">의뢰인명</label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="의뢰인명을 입력하세요"
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
        <h2 className="text-sm font-semibold text-[var(--fg)] mb-3">합계</h2>
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
          <p className="text-xs text-[var(--fg-muted)] pt-1">* 부가세 별도</p>
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
