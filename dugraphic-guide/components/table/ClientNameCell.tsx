"use client";

import { useEffect, useState } from "react";

interface Props {
  value: string;
  onCommit: (newName: string) => Promise<void>;
  className?: string;
}

// 클라이언트명(업체명) 인라인 편집 입력. blur 시점에 값이 바뀌어 있으면
// "다른 데이터베이스의 동일 업체명 행도 함께 바뀐다"는 확인 다이얼로그를
// 띄우고, 확인해야만 실제로 저장(onCommit)한다. 취소하면 원래 값으로 되돌림.
export function ClientNameCell({ value, onCommit, className }: Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleBlur = async () => {
    if (draft === value) return;
    const from = value || "(빈 값)";
    const to = draft || "(빈 값)";
    const confirmed = window.confirm(
      `"${from}"를 "${to}"로 변경하면 다른 데이터베이스의 동일 업체명 행도 함께 변경됩니다. 계속하시겠습니까?`
    );
    if (!confirmed) {
      setDraft(value);
      return;
    }
    await onCommit(draft);
  };

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onClick={(e) => e.stopPropagation()}
      className={className}
      placeholder="-"
    />
  );
}
