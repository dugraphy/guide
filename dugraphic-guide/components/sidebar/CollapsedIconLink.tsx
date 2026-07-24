"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface Props {
  href: string;
  label: string;
  icon: ReactNode;
}

export default function CollapsedIconLink({ href, label, icon }: Props) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center w-10 h-8 rounded text-[var(--fg)] text-base shrink-0 transition-colors
        ${isActive ? "bg-[var(--active)]" : "hover:bg-[var(--hover)]"}`}
    >
      {icon}
    </Link>
  );
}
