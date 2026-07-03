"use client";

import { useRouter } from "next/navigation";

export default function NewQuoteButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/quotes/new")}
      className="flex items-center gap-1.5 h-7 px-2 mt-1 rounded text-sm text-[var(--fg-muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)] transition-colors w-full text-left"
    >
      <span className="w-5 text-center leading-none">+</span>
      <span>새 견적서</span>
    </button>
  );
}
