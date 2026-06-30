"use client";

import { PAGES } from "@/lib/data";
import SidebarItem from "./SidebarItem";

const NAV_ITEMS = [
  { href: "/", icon: "🏠", label: "홈" },
];

export default function Sidebar() {
  return (
    <aside
      className="flex flex-col shrink-0 border-r border-[var(--border)] bg-[var(--bg-secondary)] overflow-y-auto h-full"
      style={{ width: "var(--sidebar-width)" }}
    >
      {/* 워크스페이스 헤더 */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-[var(--border)]">
        <div className="w-6 h-6 rounded bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold shrink-0">
          D
        </div>
        <span className="font-semibold text-sm truncate">Dugraphic Guide</span>
      </div>

      <nav className="flex flex-col gap-0.5 px-1 py-2">
        {/* 기본 내비게이션 */}
        {NAV_ITEMS.map((item) => (
          <SidebarItem key={item.href} {...item} />
        ))}

        {/* 페이지 섹션 */}
        <div className="mt-4 mb-1 px-2">
          <span className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">
            페이지
          </span>
        </div>

        {PAGES.map((page) => (
          <SidebarItem
            key={page.slug}
            href={`/page/${page.slug}`}
            icon={page.icon}
            label={page.title}
          />
        ))}

        {/* 새 페이지 */}
        <button className="flex items-center gap-1.5 h-7 px-2 mt-1 rounded text-sm text-[var(--fg-muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)] transition-colors w-full text-left">
          <span className="w-5 text-center leading-none">+</span>
          <span>새 페이지</span>
        </button>
      </nav>
    </aside>
  );
}
