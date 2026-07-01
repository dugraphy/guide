"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { DatabaseDef, DatabaseRow, Column } from "@/lib/databases";

interface Props {
  db: DatabaseDef;
  initialRows: DatabaseRow[];
  initialStatus: string;
  initialIndustry: string;
  initialHighlight?: string;
}

// Column min-widths by type / name
function colMinWidth(col: Column): number {
  if (col.type === "date") return 135;
  if (col.type === "select") return 100;
  if (col.name === "메모") return 220;
  return 120;
}

export default function DatabaseView({
  db,
  initialRows,
  initialStatus,
  initialIndustry,
  initialHighlight,
}: Props) {
  const router = useRouter();

  // ── rows state with ref for debounced saves ──────────────────────────────
  const [rows, setRows] = useState<DatabaseRow[]>(initialRows);
  const rowsRef = useRef<DatabaseRow[]>(initialRows);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── highlight state ───────────────────────────────────────────────────────
  const [highlightId, setHighlightId] = useState<string | null>(() => {
    if (!initialHighlight) return null;
    return initialRows.find((r) => r.data["업체명"] === initialHighlight)?.id ?? null;
  });
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (!highlightId) return;
    highlightRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(t);
  }, [highlightId]);

  // ── filter state ─────────────────────────────────────────────────────────
  const [status, setStatus] = useState(initialStatus || "전체");
  const [industry, setIndustry] = useState(initialIndustry || "");

  // ── column metadata ───────────────────────────────────────────────────────
  const statusCol = db.columns.find(
    (c) => c.name === "상태" && c.type === "select"
  );
  const industryCol = db.columns.find(
    (c) => c.name === "업종" && c.type === "select"
  );
  const deadlineColId = db.columns.find(
    (c) => c.name === "마감 일자" && c.type === "date"
  )?.id;
  const statusTabs = statusCol
    ? ["전체", ...(statusCol.options ?? [])]
    : null;

  // ── filtered + sorted display rows ───────────────────────────────────────
  const displayRows = (() => {
    let result = rows;
    if (status !== "전체" && statusCol) {
      result = result.filter((r) => r.data[statusCol.id] === status);
    }
    if (industry && industryCol) {
      result = result.filter((r) => r.data[industryCol.id] === industry);
    }
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
      router.replace(`/db/${db.slug}${qs ? `?${qs}` : ""}`, {
        scroll: false,
      });
    },
    [router, db.slug]
  );

  const changeStatus = (s: string) => {
    setStatus(s);
    updateUrl(s, industry);
  };
  const changeIndustry = (ind: string) => {
    setIndustry(ind);
    updateUrl(status, ind);
  };

  // ── cell update with debounced save ──────────────────────────────────────
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

  // ── row add ───────────────────────────────────────────────────────────────
  const handleAddRow = async () => {
    const emptyData: Record<string, string> = {};
    db.columns.forEach((c) => {
      emptyData[c.id] = "";
    });
    const resp = await fetch(`/api/databases/${db.slug}/rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emptyData),
    });
    const newRow: DatabaseRow = await resp.json();
    rowsRef.current = [...rowsRef.current, newRow];
    setRows([...rowsRef.current]);
  };

  // ── row delete ───────────────────────────────────────────────────────────
  const handleDeleteRow = async (rowId: string) => {
    if (saveTimers.current[rowId]) {
      clearTimeout(saveTimers.current[rowId]);
      delete saveTimers.current[rowId];
    }
    await fetch(`/api/databases/${db.slug}/rows/${rowId}`, {
      method: "DELETE",
    });
    rowsRef.current = rowsRef.current.filter((r) => r.id !== rowId);
    setRows([...rowsRef.current]);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="px-8 pt-8 pb-0 shrink-0">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-4">{db.name}</h1>

        <div className="flex items-end justify-between">
          {/* Status tabs */}
          {statusTabs ? (
            <div className="flex">
              {statusTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => changeStatus(tab)}
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
          ) : (
            <div />
          )}

          {/* Industry dropdown filter */}
          {industryCol && (industryCol.options?.length ?? 0) > 0 && (
            <div className="mb-0.5">
              <select
                value={industry}
                onChange={(e) => changeIndustry(e.target.value)}
                className="text-sm border border-[var(--border)] rounded px-2 py-1 bg-[var(--bg)] text-[var(--fg)] outline-none cursor-pointer"
              >
                <option value="">업종 전체</option>
                {industryCol.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="border-b border-[var(--border)]" />
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto px-8 py-4">
        <div className="overflow-x-auto rounded border border-[var(--border)]">
          <table className="text-sm border-collapse" style={{ minWidth: "100%" }}>
            <thead>
              <tr>
                {db.columns.map((col) => (
                  <th
                    key={col.id}
                    style={{ minWidth: colMinWidth(col) }}
                    className="text-left px-3 py-2 text-xs font-medium text-[var(--fg-muted)] bg-[var(--bg-secondary)] border-b border-r border-[var(--border)] whitespace-nowrap last:border-r-0"
                  >
                    {col.name}
                  </th>
                ))}
                <th className="w-10 bg-[var(--bg-secondary)] border-b border-[var(--border)]" />
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, idx) => (
                <tr
                  key={row.id}
                  ref={row.id === highlightId ? highlightRowRef : undefined}
                  className={`group transition-colors hover:bg-[var(--hover)] ${
                    row.id === highlightId
                      ? "bg-[var(--accent)]/10 outline outline-2 outline-[var(--accent)]"
                      : idx % 2 === 1
                      ? "bg-[var(--bg-secondary)]/40"
                      : ""
                  }`}
                >
                  {db.columns.map((col) => {
                    const value = row.data[col.id] ?? "";
                    return (
                      <td
                        key={col.id}
                        className="border-b border-r border-[var(--border)] p-0 last:border-r-0"
                      >
                        {col.type === "select" ? (
                          <select
                            value={value}
                            onChange={(e) =>
                              handleCellUpdate(row.id, col.id, e.target.value)
                            }
                            className="w-full px-2 py-1.5 bg-transparent outline-none text-[var(--fg)] text-sm cursor-pointer"
                          >
                            <option value="">-</option>
                            {col.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : col.type === "date" ? (
                          <input
                            type="date"
                            value={value}
                            onChange={(e) =>
                              handleCellUpdate(row.id, col.id, e.target.value)
                            }
                            className="w-full px-2 py-1.5 bg-transparent outline-none text-[var(--fg)] text-sm cursor-pointer"
                          />
                        ) : (
                          <input
                            type="text"
                            value={value}
                            onChange={(e) =>
                              handleCellUpdate(row.id, col.id, e.target.value)
                            }
                            className="w-full px-2 py-1.5 bg-transparent outline-none text-[var(--fg)] text-sm placeholder:text-[var(--fg-muted)]"
                            placeholder="-"
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="border-b border-[var(--border)] w-10 text-center">
                    <button
                      onClick={() => handleDeleteRow(row.id)}
                      title="행 삭제"
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

        {/* Empty state */}
        {displayRows.length === 0 && (
          <p className="text-center py-12 text-sm text-[var(--fg-muted)]">
            {status !== "전체" || industry
              ? "필터 조건에 맞는 항목이 없습니다."
              : "아직 데이터가 없습니다. 행을 추가해보세요."}
          </p>
        )}

        {/* Add row */}
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
