"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarItemProps {
  href: string;
  label: string;
  depth?: number;
}

export default function SidebarItem({
  href,
  label,
  depth = 0,
}: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      className={`flex items-center h-7 pr-2 rounded text-sm text-[var(--fg)] transition-colors group
        ${isActive ? "bg-[var(--active)]" : "hover:bg-[var(--hover)]"}`}
    >
      <span className="truncate">{label}</span>
    </Link>
  );
}
