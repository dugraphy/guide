"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { DatabaseDef, DatabaseRow } from "@/lib/databases";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { ResizableTh } from "@/components/table/ResizableTh";
import { TABLE } from "@/components/table/tableStyles";
import { BadgeSelect, StaticBadge } from "@/components/table/BadgeSelect";

const TABS = ["전체", "예정", "상담중", "작업중", "완료", "보류"];
const INDUSTRY_OPTIONS = ["쇼핑몰", "병의원", "숙박업", "기업", "기타"];
const STATUS_OPTIONS = ["예정", "상담중", "작업중", "완료", "보류"];

const COLS = [
  { id: "업체명",   label: "클라이언트명", defaultWidth: 140 },
  { id: "이름",    label: "이름",     defaultWidth: 90  },
  { id: "연락처",  label: "연락처",   defaultWidth: 130 },
  { id: "상담목적", label: "상담목적", defaultWidth: 180 },
  { id: "업종",    label: "업종",     defaultWidth: 90  },
  { id: "예산범위", label: "예산범위", defaultWidth: 160 },
  { id: "희망기간", label: "희망기간", defaultWidth: 150 },
  { id: "진행여부", label: "진행여부", defaultWidth: 90  },
  { id: "등록일",  label: "등록일",   defaultWidth: 130 },
] as const;

const DEFAULT_WIDTHS = Object.fromEntries(COLS.map((c) => [c.id, c.defaultWidth]));

interface Props {
  db: DatabaseDef;
  initialRows: DatabaseRow[];
  initialTab: string;
  canEdit: boolean;
}

export default function InquiryClientsView({ db, initialRows, initialTab, canEdit }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<DatabaseRow[]>(initialRows);
  const rowsRef = useRef<DatabaseRow[]>(initialRows);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [tab, setTab] = useState(TABS.includes(initialTab as typeof TABS[number]) ? initialTab : "전체");

  const { widths, containerRef, startResize, getWidth, totalWidth, allowScroll } = useResizableColumns(
    "column-widths-clients",
    DEFAULT_WIDTHS
  );

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
    router.replace(`/db/inquiry-clients${p.toString() ? `?${p}` : ""}`, { scroll: false });
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
    router.push(`/db/clients${업체명 ? `?highlight=${encodeURIComponent(업체명)}` : ""}`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-8 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-[var(--fg)]">{db.name}</h1>
          {canEdit && (
            <button
              onClick={handleAddRow}
              className="flex items-center gap-1.5 text-sm bg-[var(--accent)] text-white px-3 py-1.5 rounded hover:opacity-90 transition-opacity"
            >
              <span className="text-base font-light leading-none">+</span>
              문의 추가
            </button>
          )}
        </div>
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
        <div className="border-b border-[var(--border)]" />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 py-4">
        <div ref={containerRef} className={`${TABLE.wrapper}${!allowScroll ? " md:overflow-x-hidden" : ""}`}>
          <table
            className={TABLE.table}
            style={{ tableLayout: "fixed", width: "100%", minWidth: allowScroll ? totalWidth : undefined }}
          >
            <thead>
              <tr>
                {COLS.map((col) => (
                  <ResizableTh
                    key={col.id}
                    colId={col.id}
                    width={getWidth(col.id)}
                    onResizeStart={startResize}
                  >
                    {col.label}
                  </ResizableTh>
                ))}
                <th className={TABLE.thSpacer} />
                {canEdit && <th className={TABLE.thAction} style={{ width: 40 }} />}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, idx) => (
                <tr key={row.id} className={TABLE.tr(idx)}>
                  {/* 업체명 */}
                  <td className={TABLE.td}>
                    <button
                      onClick={() => goToClients(row.data["업체명"] || "")}
                      title="클라이언트 관리에서 보기"
                      className="w-full px-2 py-2 text-sm font-semibold text-[var(--accent)] hover:underline text-left truncate block"
                    >
                      {row.data["업체명"] || <span className="text-[var(--fg-muted)]">-</span>}
                    </button>
                  </td>
                  {/* 이름 */}
                  <td className={TABLE.td}>
                    {canEdit ? (
                      <input type="text" value={row.data["이름"] ?? ""} onChange={(e) => handleCellUpdate(row.id, "이름", e.target.value)} className={TABLE.cellInput} placeholder="-" />
                    ) : (
                      <span className={TABLE.cellReadOnly}>{row.data["이름"] || "-"}</span>
                    )}
                  </td>
                  {/* 연락처 */}
                  <td className={TABLE.td}>
                    {canEdit ? (
                      <input type="text" value={row.data["연락처"] ?? ""} onChange={(e) => handleCellUpdate(row.id, "연락처", e.target.value)} className={TABLE.cellInput} placeholder="-" />
                    ) : (
                      <span className={TABLE.cellReadOnly}>{row.data["연락처"] || "-"}</span>
                    )}
                  </td>
                  {/* 상담목적 */}
                  <td className={TABLE.td}>
                    {canEdit ? (
                      <input type="text" value={row.data["상담목적"] ?? ""} onChange={(e) => handleCellUpdate(row.id, "상담목적", e.target.value)} className={TABLE.cellInput} placeholder="-" />
                    ) : (
                      <span className={TABLE.cellReadOnly}>{row.data["상담목적"] || "-"}</span>
                    )}
                  </td>
                  {/* 업종 */}
                  <td className={TABLE.td}>
                    <div className="px-2 py-2">
                      {canEdit ? (
                        <BadgeSelect colId="업종" value={row.data["업종"] ?? ""} options={INDUSTRY_OPTIONS} onChange={(v) => handleCellUpdate(row.id, "업종", v)} />
                      ) : (
                        <StaticBadge colId="업종" value={row.data["업종"] ?? ""} />
                      )}
                    </div>
                  </td>
                  {/* 예산범위 */}
                  <td className={TABLE.td}>
                    {canEdit ? (
                      <input type="text" value={row.data["예산범위"] ?? ""} onChange={(e) => handleCellUpdate(row.id, "예산범위", e.target.value)} className={TABLE.cellInput} placeholder="-" />
                    ) : (
                      <span className={TABLE.cellReadOnly}>{row.data["예산범위"] || "-"}</span>
                    )}
                  </td>
                  {/* 희망기간 */}
                  <td className={TABLE.td}>
                    {canEdit ? (
                      <input type="text" value={row.data["희망기간"] ?? ""} onChange={(e) => handleCellUpdate(row.id, "희망기간", e.target.value)} className={TABLE.cellInput} placeholder="-" />
                    ) : (
                      <span className={TABLE.cellReadOnly}>{row.data["희망기간"] || "-"}</span>
                    )}
                  </td>
                  {/* 진행여부 */}
                  <td className={TABLE.td}>
                    <div className="px-2 py-2">
                      {canEdit ? (
                        <BadgeSelect colId="진행여부" value={row.data["진행여부"] ?? ""} options={STATUS_OPTIONS} onChange={(v) => handleCellUpdate(row.id, "진행여부", v)} />
                      ) : (
                        <StaticBadge colId="진행여부" value={row.data["진행여부"] ?? ""} />
                      )}
                    </div>
                  </td>
                  {/* 등록일 */}
                  <td className={TABLE.td}>
                    {canEdit ? (
                      <input type="date" value={row.data["등록일"] ?? ""} onChange={(e) => handleCellUpdate(row.id, "등록일", e.target.value)} className={TABLE.cellSelect} />
                    ) : (
                      <span className={TABLE.cellReadOnly}>{row.data["등록일"] || "-"}</span>
                    )}
                  </td>
                  {/* 삭제 */}
                  <td className={TABLE.tdSpacer} />
                  {canEdit && (
                    <td className={TABLE.tdAction}>
                      <button onClick={(e) => handleDelete(row.id, e)} title="삭제" className={TABLE.deleteBtn}>×</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {displayRows.length === 0 && (
          <p className="text-center py-12 text-sm text-[var(--fg-muted)]">
            {tab !== "전체" ? `"${tab}" 항목이 없습니다.` : "아직 문의 데이터가 없습니다."}
          </p>
        )}

      </div>
    </div>
  );
}
