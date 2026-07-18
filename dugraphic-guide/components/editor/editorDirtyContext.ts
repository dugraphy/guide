"use client";

import { createContext, useContext } from "react";

// 메인 에디터·탭 서브 에디터 어디서 바뀌든 저장 버튼 상태("저장 필요")를
// 즉시 갱신할 수 있도록, 마킹 함수를 트리 전체에 내려준다.
export const EditorDirtyContext = createContext<(() => void) | null>(null);

export function useMarkEditorDirty(): (() => void) | null {
  return useContext(EditorDirtyContext);
}
