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

// 자동저장 없음: 서버로 나가는 요청은 오직 저장 버튼 클릭 한 곳뿐이다.
// 타이핑 중에는 BlockEditor·TabGroupBlock 내부 상태만 바뀌고, 이 컴포넌트
// 조차 리렌더되지 않는다. 저장 버튼을 누르지 않고 새로고침/이동하면
// 변경사항이 사라지는 것은 의도된 동작이다.
export default function PageEditorWrapper({ page: initialPage, isNew, canEdit }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialPage.title);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const titleRef = useRef(initialPage.title);
  const savedResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // BlockEditor가 마운트 시 이 ref에 "지금 문서를 JSON으로 돌려주는 함수"를
  // 등록해준다. 저장 버튼을 누른 순간에만 호출해 최신 body를 얻는다.
  const getBodyRef = useRef<() => string>(() => initialPage.body);
  const registerGetBody = useCallback((getBody: () => string) => {
    getBodyRef.current = getBody;
  }, []);

  const handleTitleChange = useCallback((next: string) => {
    setTitle(next);
    titleRef.current = next;
  }, []);

  const handleSaveClick = useCallback(async () => {
    if (!canEdit) return;
    setSaveStatus("saving");
    const payload: PageData = {
      ...initialPage,
      title: titleRef.current,
      body: getBodyRef.current(),
    };
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save failed");
      setSaveStatus("saved");
      if (savedResetTimerRef.current) clearTimeout(savedResetTimerRef.current);
      savedResetTimerRef.current = setTimeout(() => setSaveStatus("idle"), 1500);
      router.refresh();
    } catch {
      setSaveStatus("idle");
      showErrorToast("저장에 실패했습니다. 다시 시도해주세요.");
    }
  }, [router, canEdit, initialPage]);

  return (
    <>
      <EditablePageHeader
        title={title}
        onTitleChange={handleTitleChange}
        isNew={isNew}
        onSave={canEdit ? handleSaveClick : undefined}
        saveStatus={saveStatus}
        readOnly={!canEdit}
      />
      <div className="px-8 py-4">
        <div className="border-t border-[var(--border)] mb-4" />
        <BlockEditor page={initialPage} registerGetBody={registerGetBody} editable={canEdit} />
      </div>
    </>
  );
}
