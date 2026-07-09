"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PageData } from "@/lib/data";
import EditablePageHeader, { type SaveStatus } from "./EditablePageHeader";
import { showErrorToast } from "@/components/Toast";

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
  canEdit: boolean;
}

export default function PageEditorWrapper({ page: initialPage, isNew, canEdit }: Props) {
  const router = useRouter();
  const [page, setPage] = useState(initialPage);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // 저장 payload의 단일 소스. title/body 변경 핸들러가 각각 직접 갱신한다
  // (렌더마다 `pageRef.current = page`로 동기화하면, body를 ref에만 반영해
  // 리렌더를 건너뛰는 아래 최적화가 title 변경 시 stale body로 덮어써진다).
  const pageRef = useRef(initialPage);

  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSave = useCallback(
    async (optimistic = false) => {
      if (!canEdit) return;
      // 저장 버튼 클릭 시: 응답을 기다리지 않고 "저장됨"부터 즉시 보여준다.
      if (optimistic) {
        setSaveStatus("saved");
        if (savedResetTimerRef.current) clearTimeout(savedResetTimerRef.current);
        savedResetTimerRef.current = setTimeout(() => setSaveStatus("idle"), 1500);
      } else {
        setSaveStatus("saving");
      }
      try {
        const res = await fetch("/api/pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pageRef.current),
        });
        if (!res.ok) throw new Error("save failed");
        if (!optimistic) {
          setSaveStatus("saved");
          if (savedResetTimerRef.current) clearTimeout(savedResetTimerRef.current);
          savedResetTimerRef.current = setTimeout(() => setSaveStatus("idle"), 1500);
        }
        router.refresh();
      } catch {
        setSaveStatus("idle");
        showErrorToast("저장에 실패했습니다. 다시 시도해주세요.");
      }
    },
    [router, canEdit]
  );

  const handleSaveClick = useCallback(() => {
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    if (bodyTimerRef.current) clearTimeout(bodyTimerRef.current);
    performSave(true);
  }, [performSave]);

  const handleTitleChange = useCallback(
    (title: string) => {
      setPage((prev) => ({ ...prev, title }));
      pageRef.current = { ...pageRef.current, title };
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      titleTimerRef.current = setTimeout(performSave, 1500);
    },
    [performSave]
  );

  // 셀 하나만 고쳐도 body는 300ms마다 바뀔 수 있다. 여기서 setPage로 React
  // state를 갱신하면 페이지 전체가 리렌더되고, 그때마다 BlockEditor에 새
  // page prop이 흘러들어가 큰 문서를 다시 파싱하는 낭비가 생긴다(테이블이
  // 클수록 체감 타이핑 지연으로 이어짐). body는 화면에 반영할 필요가 없는
  // "저장용 스냅샷"일 뿐이므로 리렌더를 유발하지 않는 ref에만 담아둔다.
  const handleBodyChange = useCallback(
    (body: string) => {
      pageRef.current = { ...pageRef.current, body };
      if (bodyTimerRef.current) clearTimeout(bodyTimerRef.current);
      bodyTimerRef.current = setTimeout(performSave, 2500);
    },
    [performSave]
  );

  return (
    <>
      <EditablePageHeader
        title={page.title}
        onTitleChange={handleTitleChange}
        isNew={isNew}
        onSave={canEdit ? handleSaveClick : undefined}
        saveStatus={saveStatus}
        readOnly={!canEdit}
      />
      <div className="px-8 py-4">
        <div className="border-t border-[var(--border)] mb-4" />
        <BlockEditor page={initialPage} onBodyChange={handleBodyChange} editable={canEdit} />
      </div>
    </>
  );
}
