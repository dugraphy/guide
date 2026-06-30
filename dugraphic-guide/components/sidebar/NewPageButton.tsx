"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewPageButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const slug = `page-${Date.now()}`;
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          icon: "📄",
          title: "제목 없음",
          description: "",
          body: "[]",
        }),
      });
      if (res.ok) {
        router.push(`/page/${slug}?new=1`);
        router.refresh(); // Sidebar(서버 컴포넌트) 캐시 무효화 → 새 페이지 목록 반영
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 h-7 px-2 mt-1 rounded text-sm text-[var(--fg-muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)] transition-colors w-full text-left disabled:opacity-50"
    >
      <span className="w-5 text-center leading-none">{loading ? "…" : "+"}</span>
      <span>새 페이지</span>
    </button>
  );
}
