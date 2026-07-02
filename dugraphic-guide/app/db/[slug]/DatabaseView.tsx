"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { DatabaseDef, DatabaseRow, Column } from "@/lib/databases";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { ResizableTh } from "@/components/table/ResizableTh";
import { TABLE } from "@/components/table/tableStyles";
import { BadgeSelect, StaticBadge } from "@/components/table/BadgeSelect";
import { ClientNameCell } from "@/components/table/ClientNameCell";
import { Spinner } from "@/components/Spinner";
import { showErrorToast } from "@/components/Toast";

const SLUG_STORAGE_KEY: Record<string, string> = {
  clients: "column-widths-companies",
};

function defaultColWidth(col: Column): number {
  if (col.type === "date") return 135;
  if (col.type === "select") return 110;
  if (col.name === "메모") return 220;
  return 130;
}

interface Props {
  db: DatabaseDef;
  initialRows: DatabaseRow[];
  initialStatus: string;
  initialIndustry: string;
  initialHighlight?: string;
  canEdit: boolean;
}

export default function DatabaseView({
  db,
  initialRows,
  initialStatus,
  initialIndustry,
  initialHighlight,
  canEdit,
}: Props) {
  const router = useRouter();

  // ── rows state ────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<DatabaseRow[]>(initialRows);
  const rowsRef = useRef<DatabaseRow[]>(initialRows);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // rowId -> { colId: 저장 시작 전 마지막 확정값 } — 실패 시 롤백용.
  const pendingPrev = useRef<Record<string, Record<string, string>>>({});
  // "rowId:colId" — 현재 저장 요청이 진행 중인 셀(작은 스피너 표시용).
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());

  // ── highlight ─────────────────────────────────────────────────────────────
  const [highlightId, setHighlightId] = useState<string | null>(() =>
    initialHighlight
      ? (initialRows.find((r) => r.data["업체명"] === initialHighlight)?.id ?? null)
      : null
  );
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (!highlightId) return;
    highlightRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(t);
  }, [highlightId]);

  // ── filters ───────────────────────────────────────────────────────────────
  const [status, setStatus] = useState(initialStatus || "전체");
  const [industry, setIndustry] = useState(initialIndustry || "");

  const statusCol = db.columns.find((c) => c.name === "상태" && c.type === "select");
  const industryCol = db.columns.find((c) => c.name === "업종" && c.type === "select");
  const deadlineColId = db.columns.find((c) => c.name === "마감 일자" && c.type === "date")?.id;
  const statusTabs = statusCol ? ["전체", ...(statusCol.options ?? [])] : null;

  const displayRows = (() => {
    let result = rows;
    if (status !== "전체" && statusCol)
      result = result.filter((r) => r.data[statusCol.id] === status);
    if (industry && industryCol)
      result = result.filter((r) => r.data[industryCol.id] === industry);
    if (deadlineColId) {
      result = [...result].sort((a, b) => {
        const da = a.data[deadlineColId] || "";
        const db_d = b.data[deadlineColId] || "";
        if (!da && !db_d) return 0;
        if (!da) return 1;
        if (!db_d) return -1;
        return da < db_d ? -1 : da > db_d ? 1 : 0;
      });
    }
    return result;
  })();

  // ── URL sync ──────────────────────────────────────────────────────────────
  const updateUrl = useCallback(
    (s: string, ind: string) => {
      const p = new URLSearchParams();
      if (s && s !== "전체") p.set("status", s);
      if (ind) p.set("업종", ind);
      const qs = p.toString();
      router.replace(`/db/${db.slug}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, db.slug]
  );

  // ── resizable columns ─────────────────────────────────────────────────────
  const defaultWidths = useMemo(() => {
    const m: Record<string, number> = {};
    db.columns.forEach((c) => { m[c.id] = defaultColWidth(c); });
    return m;
  }, [db.columns]);

  const storageKey = SLUG_STORAGE_KEY[db.slug] ?? `column-widths-${db.slug}`;
  const { widths, containerRef, startResize, getWidth, totalWidth, allowScroll } = useResizableColumns(storageKey, defaultWidths);

  // ── cell update (낙관적 업데이트: 화면 즉시 반영 → 백그라운드 저장 →
  // 실패 시 이전 값으로 롤백 + 에러 토스트) ──────────────────────────────────
  const handleCellUpdate = useCallback(
    (rowId: string, colId: string, value: string) => {
      if (!pendingPrev.current[rowId]) pendingPrev.current[rowId] = {};
      if (!(colId in pendingPrev.current[rowId])) {
        const current = rowsRef.current.find((r) => r.id === rowId);
        pendingPrev.current[rowId][colId] = current?.data[colId] ?? "";
      }

      rowsRef.current = rowsRef.current.map((r) =>
        r.id === rowId ? { ...r, data: { ...r.data, [colId]: value } } : r
      );
      setRows([...rowsRef.current]);
      setSavingCells((prev) => new Set(prev).add(`${rowId}:${colId}`));

      if (saveTimers.current[rowId]) clearTimeout(saveTimers.current[rowId]);
      saveTimers.current[rowId] = setTimeout(async () => {
        const row = rowsRef.current.find((r) => r.id === rowId);
        const prevValues = pendingPrev.current[rowId] ?? {};
        const dirtyCols = Object.keys(prevValues);
        delete pendingPrev.current[rowId];
        if (!row) return;
        try {
          const res = await fetch(`/api/databases/${db.slug}/rows/${rowId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(row.data),
          });
          if (!res.ok) throw new Error("save failed");
        } catch {
          rowsRef.current = rowsRef.current.map((r) =>
            r.id === rowId ? { ...r, data: { ...r.data, ...prevValues } } : r
          );
          setRows([...rowsRef.current]);
          showErrorToast("저장에 실패했습니다. 이전 값으로 되돌렸습니다.");
        } finally {
          setSavingCells((prev) => {
            const next = new Set(prev);
            dirtyCols.forEach((c) => next.delete(`${rowId}:${c}`));
            return next;
          });
        }
      }, 600);
    },
    [db.slug]
  );

  // 업체명은 debounce 없이 blur 시점(확인 다이얼로그 통과 후)에만 즉시 저장한다.
  const handleClientNameCommit = async (rowId: string, newName: string) => {
    const before = rowsRef.current.find((r) => r.id === rowId);
    const prevName = before?.data["업체명"] ?? "";
    rowsRef.current = rowsRef.current.map((r) =>
      r.id === rowId ? { ...r, data: { ...r.data, 업체명: newName } } : r
    );
    setRows([...rowsRef.current]);
    const row = rowsRef.current.find((r) => r.id === rowId);
    if (!row) return;
    const cellKey = `${rowId}:업체명`;
    setSavingCells((prev) => new Set(prev).add(cellKey));
    try {
      const res = await fetch(`/api/databases/${db.slug}/rows/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row.data),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      rowsRef.current = rowsRef.current.map((r) =>
        r.id === rowId ? { ...r, data: { ...r.data, 업체명: prevName } } : r
      );
      setRows([...rowsRef.current]);
      showErrorToast("클라이언트명 저장에 실패했습니다. 이전 값으로 되돌렸습니다.");
    } finally {
      setSavingCells((prev) => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
    }
  };

  const handleAddRow = async () => {
    const emptyData: Record<string, string> = {};
    db.columns.forEach((c) => { emptyData[c.id] = ""; });
    const resp = await fetch(`/api/databases/${db.slug}/rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emptyData),
    });
    const newRow: DatabaseRow = await resp.json();
    rowsRef.current = [...rowsRef.current, newRow];
    setRows([...rowsRef.current]);
  };

  const handleDeleteRow = async (rowId: string) => {
    if (saveTimers.current[rowId]) {
      clearTimeout(saveTimers.current[rowId]);
      delete saveTimers.current[rowId];
    }
    await fetch(`/api/databases/${db.slug}/rows/${rowId}`, { method: "DELETE" });
    rowsRef.current = rowsRef.current.filter((r) => r.id !== rowId);
    setRows([...rowsRef.current]);
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
              행 추가
            </button>
          )}
        </div>
        <div className="flex items-center justify-between">
          {statusTabs ? (
            <div className="flex">
              {statusTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setStatus(tab); updateUrl(tab, industry); }}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    status === tab
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          ) : <div />}

          {industryCol && (industryCol.options?.length ?? 0) > 0 && (
            <select
              value={industry}
              onChange={(e) => { setIndustry(e.target.value); updateUrl(status, e.target.value); }}
              className="text-sm border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--bg)] text-[var(--fg)] outline-none cursor-pointer"
            >
              <option value="">업종 전체</option>
              {industryCol.options?.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}
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
                {db.columns.map((col) => (
                  <ResizableTh
                    key={col.id}
                    colId={col.id}
                    width={getWidth(col.id)}
                    onResizeStart={startResize}
                  >
                    {col.name}
                  </ResizableTh>
                ))}
                <th className={TABLE.thSpacer} />
                {canEdit && <th className={TABLE.thAction} style={{ width: 40 }} />}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, idx) => (
                <tr
                  key={row.id}
                  ref={row.id === highlightId ? highlightRowRef : undefined}
                  className={
                    row.id === highlightId
                      ? "group transition-colors duration-150 bg-[var(--accent)]/10 outline outline-2 outline-[var(--accent)]"
                      : TABLE.tr(idx)
                  }
                >
                  {db.columns.map((col) => {
                    const value = row.data[col.id] ?? "";
                    const isSaving = savingCells.has(`${row.id}:${col.id}`);
                    return (
                      <td key={col.id} className={TABLE.td}>
                        {isSaving && (
                          <Spinner className="absolute top-1.5 right-1.5" />
                        )}
                        {col.type === "select" ? (
                          <div className="px-2 py-2">
                            {canEdit ? (
                              <BadgeSelect
                                colId={col.id}
                                value={value}
                                options={col.options ?? []}
                                onChange={(v) => handleCellUpdate(row.id, col.id, v)}
                              />
                            ) : (
                              <StaticBadge colId={col.id} value={value} />
                            )}
                          </div>
                        ) : canEdit && col.id === "업체명" ? (
                          <ClientNameCell
                            value={value}
                            onCommit={(newName) => handleClientNameCommit(row.id, newName)}
                            className={`${TABLE.cellInput} font-semibold`}
                          />
                        ) : canEdit && col.type === "date" ? (
                          <input
                            type="date"
                            value={value}
                            onChange={(e) => handleCellUpdate(row.id, col.id, e.target.value)}
                            className={TABLE.cellSelect}
                          />
                        ) : canEdit ? (
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => handleCellUpdate(row.id, col.id, e.target.value)}
                            className={`${TABLE.cellInput}${col.id === "업체명" ? " font-semibold" : ""}`}
                            placeholder="-"
                          />
                        ) : (
                          <span
                            className={`${TABLE.cellReadOnly}${col.id === "업체명" ? " font-semibold" : ""}`}
                          >
                            {value || "-"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className={TABLE.tdSpacer} />
                  {canEdit && (
                    <td className={TABLE.tdAction}>
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        title="행 삭제"
                        className={TABLE.deleteBtn}
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {displayRows.length === 0 && (
          <p className="text-center py-12 text-sm text-[var(--fg-muted)]">
            {status !== "전체" || industry
              ? "필터 조건에 맞는 항목이 없습니다."
              : "아직 데이터가 없습니다. 행을 추가해보세요."}
          </p>
        )}

      </div>
    </div>
  );
}
