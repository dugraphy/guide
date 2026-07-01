"use client";

import { useState } from "react";
import type { DatabaseDef, DatabaseRow } from "@/lib/databases";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { ResizableTh } from "@/components/table/ResizableTh";
import { TABLE } from "@/components/table/tableStyles";

const CHECKLIST_COLS = [
  { id: "업체명", defaultWidth: 140 },
  { id: "메모",   defaultWidth: 200 },
  { id: "업종",   defaultWidth: 100 },
  { id: "작성일", defaultWidth: 130 },
] as const;
const CHECKLIST_DEFAULT_WIDTHS = Object.fromEntries(
  CHECKLIST_COLS.map((c) => [c.id, c.defaultWidth])
);

const ANSWER_KEY = "답변";

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg)] rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── View modal ────────────────────────────────────────────────────────────────

function ViewModal({
  row,
  onMemoSave,
  onClose,
}: {
  row: DatabaseRow;
  onMemoSave: (memo: string) => Promise<void>;
  onClose: () => void;
}) {
  const [memo, setMemo] = useState(row.data["메모"] ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  let entries: { q: string; a: string }[] = [];
  try {
    const parsed = JSON.parse((row.data[ANSWER_KEY] as string) || "[]");
    if (Array.isArray(parsed)) {
      entries = parsed.filter((item) => item.a !== "");
    }
  } catch {
    /* ignore */
  }

  const handleSaveMemo = async () => {
    setSaving(true);
    try {
      await onMemoSave(memo);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--fg)]">
            {row.data["업체명"] || "미입력"}
          </h2>
          <p className="text-sm text-[var(--fg-muted)] mt-0.5 flex gap-3">
            {row.data["업종"] && <span>{row.data["업종"]}</span>}
            {row.data["작성일"] && <span>{row.data["작성일"]}</span>}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--fg-muted)] hover:text-[var(--fg)] text-2xl leading-none ml-4 -mt-0.5"
        >
          ×
        </button>
      </div>

      {/* 내부 메모 */}
      <div className="rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] p-3 mb-4">
        <p className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wide mb-1.5">
          내부 메모
        </p>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
          placeholder="팀 내부용 메모를 입력하세요"
          className="w-full bg-transparent text-sm text-[var(--fg)] outline-none resize-none placeholder:text-[var(--fg-muted)]/60"
        />
        <div className="flex justify-end mt-1">
          <button
            onClick={handleSaveMemo}
            disabled={saving}
            className="text-xs px-3 py-1 rounded bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "저장 중..." : saved ? "저장됨 ✓" : "저장"}
          </button>
        </div>
      </div>

      {/* 답변 내용 */}
      <div className="border-t border-[var(--border)] pt-4 space-y-4">
        {entries.length > 0 ? (
          entries.map(({ q, a }, idx) => (
            <div key={idx}>
              <p className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wide mb-1">
                {q}
              </p>
              <p className="text-sm text-[var(--fg)] whitespace-pre-wrap min-h-[1.25rem]">
                {a}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--fg-muted)] italic">답변 내용이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

// ── Add modal ─────────────────────────────────────────────────────────────────

function AddModal({
  db,
  questions,
  onSubmit,
  onClose,
}: {
  db: DatabaseDef;
  questions: string[];
  onSubmit: (data: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const industryCol = db.columns.find((c) => c.id === "업종");

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const answers: Record<string, string> = {};
      questions.forEach((q) => {
        answers[q] = form[q] ?? "";
      });
      const data: Record<string, string> = {
        업체명: form["업체명"] ?? "",
        업종: form["업종"] ?? "",
        작성일: form["작성일"] ?? "",
        [ANSWER_KEY]: JSON.stringify(answers),
      };
      await onSubmit(data);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-[var(--fg)]">새 상담 기록</h2>
        <button
          onClick={onClose}
          className="text-[var(--fg-muted)] hover:text-[var(--fg)] text-2xl leading-none"
        >
          ×
        </button>
      </div>

      {/* 기본 정보 */}
      <div className="space-y-3 mb-5">
        <div>
          <label className="text-xs font-medium text-[var(--fg-muted)] block mb-1">
            업체명
          </label>
          <input
            type="text"
            value={form["업체명"] ?? ""}
            onChange={(e) => set("업체명", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
            placeholder="업체명 입력"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--fg-muted)] block mb-1">
            업종
          </label>
          <select
            value={form["업종"] ?? ""}
            onChange={(e) => set("업종", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)] cursor-pointer"
          >
            <option value="">선택</option>
            {industryCol?.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--fg-muted)] block mb-1">
            작성일
          </label>
          <input
            type="date"
            value={form["작성일"] ?? ""}
            onChange={(e) => set("작성일", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)] cursor-pointer"
          />
        </div>
      </div>

      {/* 상담 내용 */}
      {questions.length > 0 && (
        <div className="border-t border-[var(--border)] pt-4 space-y-3 mb-5">
          <p className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider">
            상담 내용
          </p>
          {questions.map((q) => (
            <div key={q}>
              <label className="text-xs font-medium text-[var(--fg-muted)] block mb-1">
                {q}
              </label>
              <textarea
                value={form[q] ?? ""}
                onChange={(e) => set(q, e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)] resize-none"
                placeholder="답변 입력"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] rounded transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}

// ── Industry badge ────────────────────────────────────────────────────────────

const INDUSTRY_BADGE: Record<string, string> = {
  쇼핑몰: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  병의원: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  숙박업: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  기업:   "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};
const BADGE_DEFAULT = "bg-[var(--bg-secondary)] text-[var(--fg-muted)]";

function IndustryBadge({ value }: { value: string }) {
  if (!value) return <span className="text-[var(--fg-muted)]">-</span>;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        INDUSTRY_BADGE[value] ?? BADGE_DEFAULT
      }`}
    >
      {value}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  db: DatabaseDef;
  initialRows: DatabaseRow[];
}

export default function ChecklistView({ db, initialRows }: Props) {
  const [rows, setRows] = useState<DatabaseRow[]>(initialRows);
  const [selectedRow, setSelectedRow] = useState<DatabaseRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("");
  const [sortDesc, setSortDesc] = useState(true);

  const answerCol = db.columns.find((c) => c.id === ANSWER_KEY);
  const questions = answerCol?.questions ?? [];
  const industryOptions = db.columns.find((c) => c.id === "업종")?.options ?? [];

  const { containerRef, startResize, getWidth, totalWidth, allowScroll } = useResizableColumns(
    "column-widths-checklist",
    CHECKLIST_DEFAULT_WIDTHS
  );

  const displayRows = (() => {
    let result = rows;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => (r.data["업체명"] ?? "").toLowerCase().includes(q));
    }
    if (industry) {
      result = result.filter((r) => r.data["업종"] === industry);
    }
    return [...result].sort((a, b) => {
      const da = a.data["작성일"] || "";
      const db_ = b.data["작성일"] || "";
      if (!da && !db_) return 0;
      if (!da) return sortDesc ? 1 : -1;
      if (!db_) return sortDesc ? -1 : 1;
      return sortDesc ? (da > db_ ? -1 : 1) : (da < db_ ? -1 : 1);
    });
  })();

  const handleAddSubmit = async (data: Record<string, string>) => {
    const resp = await fetch(`/api/databases/${db.slug}/rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const newRow: DatabaseRow = await resp.json();
    setRows((prev) => [newRow, ...prev]);
    setShowAdd(false);
  };

  const handleDelete = async (rowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("이 상담 기록을 삭제할까요?")) return;
    await fetch(`/api/databases/${db.slug}/rows/${rowId}`, { method: "DELETE" });
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    if (selectedRow?.id === rowId) setSelectedRow(null);
  };

  const handleMemoSave = async (memo: string) => {
    if (!selectedRow) return;
    const updatedData = { ...selectedRow.data, 메모: memo };
    await fetch(`/api/databases/${db.slug}/rows/${selectedRow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedData),
    });
    const updated = { ...selectedRow, data: updatedData };
    setRows((prev) => prev.map((r) => (r.id === selectedRow.id ? updated : r)));
    setSelectedRow(updated);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 shrink-0 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-[var(--fg)]">{db.name}</h1>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-sm bg-[var(--accent)] text-white px-3 py-1.5 rounded hover:opacity-90 transition-opacity"
          >
            <span className="text-base font-light leading-none">+</span>
            새 상담 기록
          </button>
        </div>

        {/* 검색 / 필터 */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="업체명 검색"
            className="text-sm border border-[var(--border)] rounded px-3 py-1.5 bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--fg-muted)] w-44"
          />
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="text-sm border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--bg)] text-[var(--fg)] outline-none cursor-pointer"
          >
            <option value="">업종 전체</option>
            {industryOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <button
            onClick={() => setSortDesc((v) => !v)}
            className="text-sm border border-[var(--border)] rounded px-3 py-1.5 bg-[var(--bg)] text-[var(--fg)] hover:bg-[var(--hover)] transition-colors"
          >
            작성일 {sortDesc ? "최신순 ↓" : "오래된순 ↑"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 py-4">
        {rows.length === 0 ? (
          <p className="text-center py-12 text-sm text-[var(--fg-muted)]">
            아직 상담 기록이 없습니다. 새 상담 기록을 추가해보세요.
          </p>
        ) : displayRows.length === 0 ? (
          <p className="text-center py-12 text-sm text-[var(--fg-muted)]">
            검색 결과가 없습니다.
          </p>
        ) : (
          <div ref={containerRef} className={TABLE.wrapper}>
            <table
              className={TABLE.table}
              style={{ tableLayout: "fixed", width: "100%", minWidth: allowScroll ? totalWidth : undefined }}
            >
              <thead>
                <tr>
                  <ResizableTh colId="업체명" width={getWidth("업체명")} onResizeStart={startResize}>업체명</ResizableTh>
                  <ResizableTh colId="메모"   width={getWidth("메모")}   onResizeStart={startResize}>메모</ResizableTh>
                  <ResizableTh colId="업종"   width={getWidth("업종")}   onResizeStart={startResize}>업종</ResizableTh>
                  <ResizableTh colId="작성일" width={getWidth("작성일")} onResizeStart={startResize}>작성일</ResizableTh>
                  <th className={TABLE.thSpacer} />
                  <th className={TABLE.thAction} style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedRow(row)}
                    className={`cursor-pointer ${TABLE.tr(idx)}`}
                  >
                    <td className={TABLE.td}>
                      <span className="block px-3 py-2 font-semibold text-[var(--fg)] truncate">
                        {row.data["업체명"] || <span className="text-[var(--fg-muted)] font-normal">-</span>}
                      </span>
                    </td>
                    <td className={TABLE.td}>
                      <span className="block px-3 py-2 text-sm text-[var(--fg-muted)] truncate">
                        {row.data["메모"] || "-"}
                      </span>
                    </td>
                    <td className={TABLE.td}>
                      <span className="block px-3 py-2">
                        <IndustryBadge value={row.data["업종"] ?? ""} />
                      </span>
                    </td>
                    <td className={TABLE.td}>
                      <span className="block px-3 py-2 text-sm text-[var(--fg-muted)]">
                        {row.data["작성일"] || "-"}
                      </span>
                    </td>
                    <td className={TABLE.tdSpacer} />
                    <td className={TABLE.tdAction}>
                      <button
                        onClick={(e) => handleDelete(row.id, e)}
                        title="삭제"
                        className={TABLE.deleteBtn}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View modal */}
      {selectedRow && (
        <Modal onClose={() => setSelectedRow(null)}>
          <ViewModal
            row={selectedRow}
            onMemoSave={handleMemoSave}
            onClose={() => setSelectedRow(null)}
          />
        </Modal>
      )}

      {/* Add modal */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <AddModal
            db={db}
            questions={questions}
            onSubmit={handleAddSubmit}
            onClose={() => setShowAdd(false)}
          />
        </Modal>
      )}
    </div>
  );
}
