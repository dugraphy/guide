"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PageData } from "@/lib/data";
import EditablePageHeader, { type SaveStatus } from "./EditablePageHeader";

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
  const router = useRouter();
  const [page, setPage] = useState(initialPage);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const pageRef = useRef(page);
  pageRef.current = page;

  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSave = useCallback(async () => {
    setSaveStatus("saving");
    try {
      await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pageRef.current),
      });
      setSaveStatus("saved");
      if (savedResetTimerRef.current) clearTimeout(savedResetTimerRef.current);
      savedResetTimerRef.current = setTimeout(() => setSaveStatus("idle"), 1500);
      router.refresh();
    } catch {
      setSaveStatus("idle");
    }
  }, [router]);

  const handleSaveClick = useCallback(() => {
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    if (bodyTimerRef.current) clearTimeout(bodyTimerRef.current);
    performSave();
  }, [performSave]);

  const handleTitleChange = useCallback(
    (title: string) => {
      setPage((prev) => ({ ...prev, title }));
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      titleTimerRef.current = setTimeout(performSave, 1500);
    },
    [performSave]
  );

  const handleBodyChange = useCallback(
    (body: string) => {
      setPage((prev) => ({ ...prev, body }));
      if (bodyTimerRef.current) clearTimeout(bodyTimerRef.current);
      bodyTimerRef.current = setTimeout(performSave, 2500);
    },
    [performSave]
  );

  return (
    <>
      <EditablePageHeader
        icon={page.icon}
        title={page.title}
        onTitleChange={handleTitleChange}
        isNew={isNew}
        onSave={handleSaveClick}
        saveStatus={saveStatus}
      />
      <div className="max-w-3xl px-14 py-4">
        <div className="border-t border-[var(--border)] mb-4" />
        <BlockEditor page={page} onBodyChange={handleBodyChange} />
      </div>
    </>
  );
}
