"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  slug: string;
  href: string;
  label: string;
  canEdit: boolean;
}

export default function PageSidebarItem({ slug, href, label, canEdit }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = pathname === href;
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`"${label}" 페이지를 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/pages/${slug}`, { method: "DELETE" });
      if (pathname === href) router.push("/");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className={`group flex items-center h-7 rounded text-sm text-[var(--fg)] transition-colors
        ${isActive ? "bg-[var(--active)]" : "hover:bg-[var(--hover)]"}`}
    >
      <Link href={href} className="flex items-center flex-1 min-w-0 pl-2">
        <span className="truncate">{label}</span>
      </Link>
      {canEdit && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="페이지 삭제"
          className="opacity-0 group-hover:opacity-100 shrink-0 w-6 h-6 mr-1 flex items-center justify-center rounded text-[var(--fg-muted)] hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30"
        >
          {deleting ? "…" : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 3h8M5 3V2h2v1M4.5 3v6.5h3V3"/>
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
