"use client";

import { createContext, useContext, type RefObject } from "react";

// tabGroup 블록마다 "지금 화면에 떠 있는 서브 에디터의 최신 내용을 부모
// 블록 prop에 반영하라"는 플러시 함수를 등록해두는 레지스트리.
// 저장 버튼을 누른 시점에 BlockEditor가 이 레지스트리를 순회하며 한 번에
// 동기화한다 — 타이핑 중에는 아무도 이 레지스트리를 읽지 않는다.
export type TabFlushRegistry = Map<string, () => void>;

export const TabSyncContext = createContext<RefObject<TabFlushRegistry> | null>(null);

export function useTabSyncRegistry(): RefObject<TabFlushRegistry> | null {
  return useContext(TabSyncContext);
}
