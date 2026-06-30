"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useCallback } from "react";
import type { PageData } from "@/lib/data";
import EditablePageHeader from "./EditablePageHeader";

const BlockEditor = dynamic(() => import("./BlockEditor"), {
  ssr: false,
  loading: () => (
    <div className="px-1 py-2 text-sm text-[var(--fg-muted)] animate-pulse">
      에디터 불러오는 중…
    </div>
  ),
});

interface Props {
  page: PageData;
  isNew?: boolean;
}

export default function PageEditorWrapper({ page: initialPage, isNew }: Props) {
  const [page, setPage] = useState(initialPage);

  // 항상 최신 page를 참조 — setTimeout 클로저가 stale state를 보지 않게 함
  const pageRef = useRef(page);
  pageRef.current = page;

  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveToGitHub = useCallback(async () => {
    await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pageRef.current),
    });
  }, []);

  const handleTitleChange = useCallback(
    (title: string) => {
      setPage((prev) => ({ ...prev, title }));
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      titleTimerRef.current = setTimeout(saveToGitHub, 1500);
    },
    [saveToGitHub]
  );

  const handleBodyChange = useCallback(
    (body: string) => {
      setPage((prev) => ({ ...prev, body }));
      if (bodyTimerRef.current) clearTimeout(bodyTimerRef.current);
      bodyTimerRef.current = setTimeout(saveToGitHub, 2500);
    },
    [saveToGitHub]
  );

  return (
    <>
      <EditablePageHeader
        icon={page.icon}
        title={page.title}
        onTitleChange={handleTitleChange}
        isNew={isNew}
      />
      <div className="max-w-3xl px-14 py-4">
        <div className="border-t border-[var(--border)] mb-4" />
        <BlockEditor page={page} onBodyChange={handleBodyChange} />
      </div>
    </>
  );
}
