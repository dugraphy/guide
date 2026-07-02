"use client";

import { useEffect, useRef } from "react";

export type SaveStatus = "idle" | "saving" | "saved";

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: "저장",
  saving: "저장 중...",
  saved: "저장됨 ✓",
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
    <div className="px-8 pt-16 pb-4">
      {onSave && (
        <div className="flex justify-end mb-4">
          <button
            onClick={onSave}
            disabled={saveStatus === "saving"}
            className={`text-xs px-3 py-1.5 rounded font-medium transition-all duration-150
              ${
                saveStatus === "saved"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-[var(--hover)] text-[var(--fg-muted)] hover:bg-[var(--active)] hover:text-[var(--fg)]"
              }
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {SAVE_LABEL[saveStatus]}
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="제목 없음"
        readOnly={readOnly}
        className="w-full text-4xl font-bold text-[var(--fg)] leading-tight mb-2 bg-transparent border-none outline-none placeholder:text-[var(--fg-muted)]"
      />
    </div>
  );
}
