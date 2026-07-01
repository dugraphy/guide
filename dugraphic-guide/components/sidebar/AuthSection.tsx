"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  email: string | null;
  role: string | null;
}

export default function AuthSection({ email, role }: Props) {
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (!email) {
    return (
      <div className="px-3 py-3 border-t border-[var(--border)]">
        <Link
          href="/login"
          className="flex items-center justify-center w-full py-1.5 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] border border-[var(--border)] rounded hover:bg-[var(--hover)] transition-colors"
        >
          로그인
        </Link>
      </div>
    );
  }

  const displayEmail = email.length > 22 ? `${email.slice(0, 10)}…${email.slice(email.lastIndexOf("@"))}` : email;

  return (
    <div className="px-3 py-3 border-t border-[var(--border)]">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-5 h-5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center text-xs font-bold shrink-0">
          {email[0].toUpperCase()}
        </span>
        <span className="text-xs text-[var(--fg)] truncate">{displayEmail}</span>
      </div>
      {role && (
        <p className="text-[10px] text-[var(--fg-muted)] mb-2 pl-7">
          {role === "owner" ? "관리자" : "멤버"}
        </p>
      )}
      <button
        onClick={handleLogout}
        className="w-full text-left text-xs text-[var(--fg-muted)] hover:text-red-500 transition-colors pl-7"
      >
        로그아웃
      </button>
    </div>
  );
}
