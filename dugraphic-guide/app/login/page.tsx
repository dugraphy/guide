"use client";

import { useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Turnstile, { type TurnstileHandle } from "@/components/auth/Turnstile";

function formatAuthError(message: string): string {
  if (/captcha/i.test(message)) {
    return "캡차 인증에 실패했습니다. 다시 시도해주세요.";
  }
  return message;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef<TurnstileHandle>(null);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) {
      setError("캡차 인증을 완료해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    });
    if (error) {
      setError(formatAuthError(error.message));
      setLoading(false);
      setCaptchaToken("");
      turnstileRef.current?.reset();
    } else {
      router.push("/");
      router.refresh();
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center min-h-screen">
      <div className="w-full max-w-sm px-8 py-10 bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-sm">
        <h1 className="text-xl font-bold text-[var(--fg)] mb-6 text-center">로그인</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">이메일</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
              placeholder="example@email.com"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">비밀번호</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
              placeholder="비밀번호 입력"
            />
          </div>
          <Turnstile
            ref={turnstileRef}
            onVerify={setCaptchaToken}
            onExpire={() => setCaptchaToken("")}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading || !captchaToken}
            className="w-full py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-[10px] text-[var(--fg-muted)]">또는</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border border-[var(--border)] rounded-lg text-[var(--fg)] hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 16 4 9.1 8.6 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4c-2 1.4-4.6 2.3-7.6 2.3-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9 39.4 15.9 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.6 5.4C41.5 35.9 44 30.4 44 24c0-1.3-.1-2.7-.4-3.5z"/>
          </svg>
          {googleLoading ? "이동 중..." : "Google로 로그인"}
        </button>

        <p className="mt-5 text-xs text-center text-[var(--fg-muted)]">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="text-[var(--accent)] hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
