"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { DatabaseDef, DatabaseRow } from "@/lib/databases";

const TABS = ["전체", "예정", "상담중", "완료", "보류"];
const INDUSTRY_OPTIONS = ["쇼핑몰", "병의원", "숙박업", "기업", "기타"];
const STATUS_OPTIONS = ["예정", "상담중", "완료", "보류"];

interface Props {
  db: DatabaseDef;
  initialRows: DatabaseRow[];
  initialTab: string;
}

export default function InquiryClientsView({ db, initialRows, initialTab }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<DatabaseRow[]>(initialRows);
  const rowsRef = useRef<DatabaseRow[]>(initialRows);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [tab, setTab] = useState(TABS.includes(initialTab) ? initialTab : "전체");

  const displayRows = (() => {
    const filtered =
      tab === "전체" ? rows : rows.filter((r) => r.data["진행여부"] === tab);
    return [...filtered].sort((a, b) => {
      const da = a.data["등록일"] || a.created_at || "";
      const db_ = b.data["등록일"] || b.created_at || "";
      return da > db_ ? -1 : da < db_ ? 1 : 0;
    });
  })();

  const changeTab = (t: string) => {
    setTab(t);
    const p = new URLSearchParams();
    if (t !== "전체") p.set("tab", t);
    router.replace(`/db/inquiry-clients${p.toString() ? `?${p}` : ""}`, {
      scroll: false,
    });
  };

  const handleCellUpdate = useCallback(
    (rowId: string, colId: string, value: string) => {
      rowsRef.current = rowsRef.current.map((r) =>
        r.id === rowId ? { ...r, data: { ...r.data, [colId]: value } } : r
      );
      setRows([...rowsRef.current]);

      if (saveTimers.current[rowId]) clearTimeout(saveTimers.current[rowId]);
      saveTimers.current[rowId] = setTimeout(async () => {
        const row = rowsRef.current.find((r) => r.id === rowId);
        if (!row) return;
        await fetch(`/api/databases/${db.slug}/rows/${rowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row.data),
        });
      }, 600);
    },
    [db.slug]
  );

  const handleAddRow = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const emptyData: Record<string, string> = { 진행여부: "예정", 등록일: today };
    const resp = await fetch(`/api/databases/${db.slug}/rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emptyData),
    });
    const newRow: DatabaseRow = await resp.json();
    rowsRef.current = [newRow, ...rowsRef.current];
    setRows([...rowsRef.current]);
  };

  const handleDelete = async (rowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("이 항목을 삭제할까요?")) return;
    if (saveTimers.current[rowId]) {
      clearTimeout(saveTimers.current[rowId]);
      delete saveTimers.current[rowId];
    }
    await fetch(`/api/databases/${db.slug}/rows/${rowId}`, { method: "DELETE" });
    rowsRef.current = rowsRef.current.filter((r) => r.id !== rowId);
    setRows([...rowsRef.current]);
  };

  const goToClients = (업체명: string) => {
    const qs = 업체명 ? `?highlight=${encodeURIComponent(업체명)}` : "";
    router.push(`/db/clients${qs}`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-8 pb-0 shrink-0">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-4">{db.name}</h1>

        <div className="flex items-end justify-between">
          <div className="flex">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => changeTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-[var(--border)]" />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 py-4">
        <div className="overflow-x-auto rounded border border-[var(--border)]">
          <table className="text-sm border-collapse" style={{ minWidth: "100%" }}>
            <thead>
              <tr>
                {[
                  { id: "업체명", label: "업체명", width: 140 },
                  { id: "이름", label: "이름", width: 90 },
                  { id: "연락처", label: "연락처", width: 130 },
                  { id: "상담목적", label: "상담목적", width: 180 },
                  { id: "업종", label: "업종", width: 90 },
                  { id: "예산범위", label: "예산범위", width: 160 },
                  { id: "희망기간", label: "희망기간", width: 150 },
                  { id: "진행여부", label: "진행여부", width: 90 },
                  { id: "등록일", label: "등록일", width: 130 },
                ].map((col) => (
                  <th
                    key={col.id}
                    style={{ minWidth: col.width }}
                    className="text-left px-3 py-2 text-xs font-medium text-[var(--fg-muted)] bg-[var(--bg-secondary)] border-b border-r border-[var(--border)] whitespace-nowrap last:border-r-0"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="w-10 bg-[var(--bg-secondary)] border-b border-[var(--border)]" />
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`group transition-colors hover:bg-[var(--hover)] ${
                    idx % 2 === 1 ? "bg-[var(--bg-secondary)]/40" : ""
                  }`}
                >
                  {/* 업체명 — clickable */}
                  <td className="border-b border-r border-[var(--border)] p-0">
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <button
                        onClick={() => goToClients(row.data["업체명"] || "")}
                        title="업체 관리에서 보기"
                        className="text-sm text-[var(--accent)] hover:underline text-left truncate max-w-[110px]"
                      >
                        {row.data["업체명"] || (
                          <span className="text-[var(--fg-muted)]">-</span>
                        )}
                      </button>
                    </div>
                  </td>

                  {/* 이름 */}
                  <td className="border-b border-r border-[var(--border)] p-0">
                    <input
                      type="text"
                      value={row.data["이름"] ?? ""}
                      onChange={(e) => handleCellUpdate(row.id, "이름", e.target.value)}
                      className="w-full px-2 py-1.5 bg-transparent outline-none text-[var(--fg)] text-sm placeholder:text-[var(--fg-muted)]"
                      placeholder="-"
                    />
                  </td>

                  {/* 연락처 */}
                  <td className="border-b border-r border-[var(--border)] p-0">
                    <input
                      type="text"
                      value={row.data["연락처"] ?? ""}
                      onChange={(e) => handleCellUpdate(row.id, "연락처", e.target.value)}
                      className="w-full px-2 py-1.5 bg-transparent outline-none text-[var(--fg)] text-sm placeholder:text-[var(--fg-muted)]"
                      placeholder="-"
                    />
                  </td>

                  {/* 상담목적 */}
                  <td className="border-b border-r border-[var(--border)] p-0">
                    <input
                      type="text"
                      value={row.data["상담목적"] ?? ""}
                      onChange={(e) => handleCellUpdate(row.id, "상담목적", e.target.value)}
                      className="w-full px-2 py-1.5 bg-transparent outline-none text-[var(--fg)] text-sm placeholder:text-[var(--fg-muted)]"
                      placeholder="-"
                    />
                  </td>

                  {/* 업종 */}
                  <td className="border-b border-r border-[var(--border)] p-0">
                    <select
                      value={row.data["업종"] ?? ""}
                      onChange={(e) => handleCellUpdate(row.id, "업종", e.target.value)}
                      className="w-full px-2 py-1.5 bg-transparent outline-none text-[var(--fg)] text-sm cursor-pointer"
                    >
                      <option value="">-</option>
                      {INDUSTRY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>

                  {/* 예산범위 */}
                  <td className="border-b border-r border-[var(--border)] p-0">
                    <input
                      type="text"
                      value={row.data["예산범위"] ?? ""}
                      onChange={(e) => handleCellUpdate(row.id, "예산범위", e.target.value)}
                      className="w-full px-2 py-1.5 bg-transparent outline-none text-[var(--fg)] text-sm placeholder:text-[var(--fg-muted)]"
                      placeholder="-"
                    />
                  </td>

                  {/* 희망기간 */}
                  <td className="border-b border-r border-[var(--border)] p-0">
                    <input
                      type="text"
                      value={row.data["희망기간"] ?? ""}
                      onChange={(e) => handleCellUpdate(row.id, "희망기간", e.target.value)}
                      className="w-full px-2 py-1.5 bg-transparent outline-none text-[var(--fg)] text-sm placeholder:text-[var(--fg-muted)]"
                      placeholder="-"
                    />
                  </td>

                  {/* 진행여부 */}
                  <td className="border-b border-r border-[var(--border)] p-0">
                    <select
                      value={row.data["진행여부"] ?? ""}
                      onChange={(e) => handleCellUpdate(row.id, "진행여부", e.target.value)}
                      className="w-full px-2 py-1.5 bg-transparent outline-none text-[var(--fg)] text-sm cursor-pointer"
                    >
                      <option value="">-</option>
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>

                  {/* 등록일 */}
                  <td className="border-b border-r border-[var(--border)] p-0 last:border-r-0">
                    <input
                      type="date"
                      value={row.data["등록일"] ?? ""}
                      onChange={(e) => handleCellUpdate(row.id, "등록일", e.target.value)}
                      className="w-full px-2 py-1.5 bg-transparent outline-none text-[var(--fg)] text-sm cursor-pointer"
                    />
                  </td>

                  {/* Delete */}
                  <td className="border-b border-[var(--border)] w-10 text-center">
                    <button
                      onClick={(e) => handleDelete(row.id, e)}
                      title="삭제"
                      className="opacity-0 group-hover:opacity-100 text-[var(--fg-muted)] hover:text-red-500 w-full py-1.5 transition-all text-base leading-none"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {displayRows.length === 0 && (
          <p className="text-center py-12 text-sm text-[var(--fg-muted)]">
            {tab !== "전체"
              ? `"${tab}" 항목이 없습니다.`
              : "아직 문의 데이터가 없습니다."}
          </p>
        )}

        <button
          onClick={handleAddRow}
          className="mt-2 flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)] px-3 py-1.5 rounded transition-colors"
        >
          <span className="text-base font-light leading-none">+</span>
          <span>행 추가</span>
        </button>
      </div>
    </div>
  );
}
