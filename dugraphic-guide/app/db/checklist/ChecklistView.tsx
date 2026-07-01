"use client";

import { useState } from "react";
import type { DatabaseDef, DatabaseRow } from "@/lib/databases";

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
  onClose,
}: {
  row: DatabaseRow;
  onClose: () => void;
}) {
  let entries: { q: string; a: string }[] = [];
  try {
    const parsed = JSON.parse((row.data[ANSWER_KEY] as string) || "[]");
    if (Array.isArray(parsed)) {
      entries = parsed.filter((item) => item.a !== "");
    }
  } catch {
    /* ignore */
  }

  return (
    <div className="p-6">
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

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  db: DatabaseDef;
  initialRows: DatabaseRow[];
}

export default function ChecklistView({ db, initialRows }: Props) {
  const [rows, setRows] = useState<DatabaseRow[]>(initialRows);
  const [selectedRow, setSelectedRow] = useState<DatabaseRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const answerCol = db.columns.find((c) => c.id === ANSWER_KEY);
  const questions = answerCol?.questions ?? [];

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
    await fetch(`/api/databases/${db.slug}/rows/${rowId}`, {
      method: "DELETE",
    });
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    if (selectedRow?.id === rowId) setSelectedRow(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 shrink-0 flex items-center justify-between border-b border-[var(--border)]">
        <h1 className="text-2xl font-bold text-[var(--fg)]">{db.name}</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-sm bg-[var(--accent)] text-white px-3 py-1.5 rounded hover:opacity-90 transition-opacity"
        >
          <span className="text-base font-light leading-none">+</span>
          새 상담 기록
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 py-4">
        {rows.length === 0 ? (
          <p className="text-center py-12 text-sm text-[var(--fg-muted)]">
            아직 상담 기록이 없습니다. 새 상담 기록을 추가해보세요.
          </p>
        ) : (
          <div className="rounded border border-[var(--border)] overflow-hidden">
            <table className="text-sm border-collapse w-full">
              <thead>
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--fg-muted)] bg-[var(--bg-secondary)] border-b border-r border-[var(--border)]">
                    업체명
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--fg-muted)] bg-[var(--bg-secondary)] border-b border-r border-[var(--border)] w-32">
                    업종
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--fg-muted)] bg-[var(--bg-secondary)] border-b border-[var(--border)] w-36">
                    작성일
                  </th>
                  <th className="w-10 bg-[var(--bg-secondary)] border-b border-[var(--border)]" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedRow(row)}
                    className={`group cursor-pointer transition-colors hover:bg-[var(--hover)] ${
                      idx % 2 === 1 ? "bg-[var(--bg-secondary)]/40" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 border-b border-r border-[var(--border)] font-medium text-[var(--fg)]">
                      {row.data["업체명"] || (
                        <span className="text-[var(--fg-muted)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 border-b border-r border-[var(--border)] text-[var(--fg-muted)]">
                      {row.data["업종"] || "-"}
                    </td>
                    <td className="px-4 py-2.5 border-b border-[var(--border)] text-[var(--fg-muted)]">
                      {row.data["작성일"] || "-"}
                    </td>
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
        )}
      </div>

      {/* View modal */}
      {selectedRow && (
        <Modal onClose={() => setSelectedRow(null)}>
          <ViewModal
            row={selectedRow}
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
