"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Settings, Receipt, Link as LinkIcon } from "lucide-react";

interface Props {
  email: string | null;
  role: string | null;
}

export default function AuthSection({ email, role }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleCopyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for browsers that block clipboard
      const el = document.createElement("input");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setToast(true);
    setTimeout(() => setToast(false), 2000);
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
    <>
      <div className="px-3 py-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-5 h-5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center text-xs font-bold shrink-0">
            {email[0].toUpperCase()}
          </span>
          <span className="text-xs text-[var(--fg)] truncate">{displayEmail}</span>
        </div>
        {role && (
          <div className="flex items-center justify-between mb-2 pl-7">
            <p className="text-[10px] text-[var(--fg-muted)]">
              {role === "owner" ? "관리자" : "멤버"}
            </p>
            <div className="flex items-center gap-0.5">
              {role === "owner" && (
                <>
                  <Link
                    href="/settings/business"
                    title="사업자정보 설정"
                    className="p-1 rounded text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-colors"
                  >
                    <Receipt size={13} />
                  </Link>
                  <Link
                    href="/admin"
                    title="관리자 설정"
                    className="p-1 rounded text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-colors"
                  >
                    <Settings size={13} />
                  </Link>
                </>
              )}
              <button
                type="button"
                onClick={handleCopyLink}
                title="현재 페이지 링크 복사"
                className="p-1 rounded text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-colors"
              >
                <LinkIcon size={13} />
              </button>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full text-left text-xs text-[var(--fg-muted)] hover:text-red-500 transition-colors pl-7"
        >
          로그아웃
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-4 z-50 px-3 py-2 rounded-lg bg-[var(--fg)] text-[var(--bg)] text-xs shadow-lg">
          링크가 복사되었습니다
        </div>
      )}
    </>
  );
}
