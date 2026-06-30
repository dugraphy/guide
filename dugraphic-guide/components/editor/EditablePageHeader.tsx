"use client";

import { useEffect, useRef } from "react";

interface Props {
  icon?: string;
  title: string;
  onTitleChange: (title: string) => void;
  isNew?: boolean;
}

export default function EditablePageHeader({ icon, title, onTitleChange, isNew }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isNew]);

  return (
    <div className="max-w-3xl px-24 pt-16 pb-4">
      {icon && <div className="text-5xl mb-3">{icon}</div>}
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="제목 없음"
        className="w-full text-4xl font-bold text-[var(--fg)] leading-tight mb-2 bg-transparent border-none outline-none placeholder:text-[var(--fg-muted)]"
      />
    </div>
  );
}
