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

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef<TurnstileHandle>(null);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) {
      setError("캡차 인증을 완료해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        captchaToken,
      },
    });
    if (error) {
      setError(formatAuthError(error.message));
      setLoading(false);
      setCaptchaToken("");
      turnstileRef.current?.reset();
    } else if (data.session) {
      // 이메일 인증(Confirm email)이 꺼져 있어 signUp 즉시 세션이 발급됨 — 바로 로그인 처리
      router.push("/");
      router.refresh();
    } else {
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <div className="w-full max-w-sm px-8 py-10 text-center bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-sm">
          <p className="text-2xl mb-3">✅</p>
          <h1 className="text-lg font-bold text-[var(--fg)] mb-3">회원가입이 완료되었습니다</h1>
          <p className="text-sm text-[var(--fg-muted)] mb-6 leading-relaxed">
            이제 로그인해주세요.
          </p>
          <Link href="/login" className="text-sm text-[var(--accent)] hover:underline">
            로그인 페이지로 이동 →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center min-h-screen">
      <div className="w-full max-w-sm px-8 py-10 bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-sm">
        <h1 className="text-xl font-bold text-[var(--fg)] mb-6 text-center">회원가입</h1>
        <form onSubmit={handleSignup} className="space-y-4">
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
              placeholder="6자 이상"
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
            {loading ? "처리 중..." : "회원가입"}
          </button>
        </form>
        <p className="mt-5 text-xs text-center text-[var(--fg-muted)]">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-[var(--accent)] hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
