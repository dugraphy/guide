"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

type FlowType = "invite" | "recovery" | null;

// Supabase 클라이언트가 해시를 파싱해 지우기 전에(useState 초기화는 첫 렌더에서
// 동기적으로 실행됨) type=invite|recovery 값을 먼저 읽어둔다.
function readFlowType(): FlowType {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  const type = new URLSearchParams(hash).get("type");
  return type === "invite" || type === "recovery" ? type : null;
}

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [flowType] = useState<FlowType>(() => readFlowType());
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  useEffect(() => {
    // invite/recovery 메일 링크를 거쳐 오면 Supabase 클라이언트가 URL 해시의
    // access_token을 자동으로 파싱해 세션을 발급한다. type과 무관하게
    // 세션이 확정되는 시점은 onAuthStateChange로만 정확히 알 수 있으므로
    // (invite → SIGNED_IN, recovery → PASSWORD_RECOVERY), 유효성 판단은
    // type이 아니라 세션 유무만으로 한다.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? "ready" : "invalid");
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  if (status === "checking") {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <p className="text-sm text-[var(--fg-muted)]">링크를 확인하는 중입니다...</p>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <div className="w-full max-w-sm px-8 py-10 text-center bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-sm">
          <h1 className="text-lg font-bold text-[var(--fg)] mb-3">
            유효하지 않은 링크입니다
          </h1>
          <p className="text-sm text-[var(--fg-muted)]">
            {flowType === "recovery"
              ? "비밀번호 재설정 링크가 만료되었거나 이미 사용되었습니다. 로그인 페이지에서 다시 요청해주세요."
              : "초대 링크가 만료되었거나 이미 사용되었습니다. 관리자에게 새 초대를 요청해주세요."}
          </p>
        </div>
      </div>
    );
  }

  const isRecovery = flowType === "recovery";

  return (
    <div className="flex flex-1 items-center justify-center min-h-screen">
      <div className="w-full max-w-sm px-8 py-10 bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-sm">
        <h1 className="text-xl font-bold text-[var(--fg)] mb-2 text-center">
          {isRecovery ? "비밀번호 재설정" : "비밀번호 설정"}
        </h1>
        <p className="text-xs text-[var(--fg-muted)] mb-6 text-center">
          {isRecovery
            ? "계정에 사용할 새 비밀번호를 입력해주세요."
            : "계정이 생성되었습니다. 사용할 비밀번호를 설정해주세요."}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">
              새 비밀번호
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
              placeholder="6자 이상"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">
              비밀번호 확인
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
              placeholder="다시 입력"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading
              ? "설정 중..."
              : isRecovery
                ? "비밀번호 재설정하기"
                : "비밀번호 설정하고 시작하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
