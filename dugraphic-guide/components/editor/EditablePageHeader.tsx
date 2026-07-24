"use client";

import { useEffect, useRef } from "react";

// idle(기본, 변경사항 없음) → dirty(저장 필요, 변경사항 있음) → saving(저장 중) → idle(저장 완료)
export type SaveStatus = "idle" | "dirty" | "saving";

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: "저장",
  dirty: "저장 필요",
  saving: "저장 중...",
};

interface Props {
  title: string;
  onTitleChange: (title: string) => void;
  isNew?: boolean;
  onSave?: () => void;
  saveStatus?: SaveStatus;
  readOnly?: boolean;
}

export default function EditablePageHeader({
  title,
  onTitleChange,
  isNew,
  onSave,
  saveStatus = "idle",
  readOnly,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isNew]);

  return (
    <div className="px-14 pt-8 pb-0">
      <div className="flex items-center justify-between mb-3">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="제목 없음"
          readOnly={readOnly}
          className="flex-1 min-w-0 text-2xl font-bold text-[var(--fg)] leading-tight bg-transparent border-none outline-none placeholder:text-[var(--fg-muted)]"
        />
        {onSave && (
          <button
            onClick={onSave}
            disabled={saveStatus === "saving"}
            className={`shrink-0 ml-4 text-xs px-3 py-1.5 rounded font-medium transition-colors duration-150
              ${
                saveStatus === "dirty" || saveStatus === "saving"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  : "bg-[var(--hover)] text-[var(--fg-muted)] hover:bg-[var(--active)] hover:text-[var(--fg)]"
              }
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {SAVE_LABEL[saveStatus]}
          </button>
        )}
      </div>
    </div>
  );
}
