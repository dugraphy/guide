"use client";

import dynamic from "next/dynamic";
import type { PageData } from "@/lib/data";

// BlockNote은 브라우저 전용 API를 사용하므로 SSR을 비활성화
const BlockEditor = dynamic(() => import("./BlockEditor"), {
  ssr: false,
  loading: () => (
    <div className="px-1 py-2 text-sm text-[var(--fg-muted)] animate-pulse">
      에디터 불러오는 중...
    </div>
  ),
});

export default function EditorLoader({ page }: { page: PageData }) {
  return <BlockEditor page={page} />;
}
