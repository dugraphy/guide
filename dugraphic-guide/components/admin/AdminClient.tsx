"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import type { AccountRow } from "@/lib/admin-users";

interface Props {
  accounts: AccountRow[];
  currentUserId: string | null;
}

function generateTempPassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

export default function AdminClient({ accounts, currentUserId }: Props) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // 값이 null이면 "조회는 됐지만 account_secrets에 기록이 없음"(이 기능 도입
  // 이전부터 있던 계정)을 의미하고, key 자체가 없으면 "아직 조회 안 함"이다.
  const [passwordCache, setPasswordCache] = useState<Record<string, string | null>>({});
  const [visiblePasswordIds, setVisiblePasswordIds] = useState<Set<string>>(new Set());
  const [loadingPasswordId, setLoadingPasswordId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordChanged, setPasswordChanged] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    setCreated(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCreateError(data.error ?? "계정 생성에 실패했습니다.");
    } else {
      setCreated({ email, password });
      setEmail("");
      setPassword("");
      router.refresh();
    }
    setCreating(false);
  };

  const handleCopyCreated = () => {
    if (!created) return;
    navigator.clipboard.writeText(`이메일: ${created.email}\n비밀번호: ${created.password}`);
  };

  const handleRoleChange = async (id: string, role: string) => {
    setBusyId(id);
    setError("");
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "권한 변경에 실패했습니다.");
    router.refresh();
    setBusyId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 계정을 삭제하시겠습니까?")) return;
    setBusyId(id);
    setError("");
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "삭제에 실패했습니다.");
    router.refresh();
    setBusyId(null);
  };

  const handleTogglePassword = async (id: string) => {
    if (visiblePasswordIds.has(id)) {
      setVisiblePasswordIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    if (!(id in passwordCache)) {
      setLoadingPasswordId(id);
      const res = await fetch(`/api/admin/users/${id}/password`);
      const data = await res.json().catch(() => ({}));
      setLoadingPasswordId(null);
      if (!res.ok) {
        setError(data.error ?? "비밀번호 조회에 실패했습니다.");
        return;
      }
      setPasswordCache((prev) => ({ ...prev, [id]: data.password }));
    }
    setVisiblePasswordIds((prev) => new Set(prev).add(id));
  };

  const handleResetPassword = async (id: string) => {
    if (
      !confirm(
        "이 계정의 비밀번호를 새로 발급하시겠습니까?\n기존 비밀번호는 더 이상 사용할 수 없게 됩니다."
      )
    )
      return;
    const newPassword = generateTempPassword();
    setResettingId(id);
    setError("");
    const res = await fetch(`/api/admin/users/${id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setResettingId(null);
    if (!res.ok) {
      setError(data.error ?? "비밀번호 재설정에 실패했습니다.");
      return;
    }
    setPasswordCache((prev) => ({ ...prev, [id]: newPassword }));
    setVisiblePasswordIds((prev) => new Set(prev).add(id));
  };

  const handleChangeMyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChanged(false);
    if (newPassword.length < 6) {
      setPasswordError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    setChangingPassword(true);
    setPasswordError("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordError(error.message);
    } else {
      // account_secrets에 저장된 평문 비밀번호도 같이 갱신한다. 새 비밀번호
      // 값은 서버가 알 수 없으므로(브라우저에서 Supabase Auth로 직접 바꿈)
      // 여기서 명시적으로 넘겨준다. 실패해도 비밀번호 자체는 이미 바뀐
      // 상태이므로 사용자에게는 성공으로 안내하고 콘솔에만 남긴다.
      const syncRes = await fetch("/api/account/password-secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!syncRes.ok) {
        console.error("account_secrets 동기화 실패:", await syncRes.json().catch(() => ({})));
      }
      setNewPassword("");
      setPasswordChanged(true);
    }
    setChangingPassword(false);
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-[var(--fg)] mb-3">계정 생성</h2>
        <form onSubmit={handleCreate} className="space-y-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
          />
          <div className="flex gap-2">
            <input
              type="text"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 (6자 이상)"
              className="flex-1 px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => setPassword(generateTempPassword())}
              className="px-3 py-2 text-xs font-medium border border-[var(--border)] rounded-lg text-[var(--fg)] hover:bg-[var(--hover)] transition-colors whitespace-nowrap"
            >
              임시 비밀번호 자동 생성
            </button>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {creating ? "생성 중..." : "계정 생성"}
          </button>
        </form>
        <p className="mt-2 text-xs text-[var(--fg-muted)]">
          이메일 발송 없이 즉시 로그인 가능한 계정이 생성됩니다. 아래 정보를
          복사해 직접 전달해주세요.
        </p>
        {createError && <p className="mt-2 text-xs text-red-500">{createError}</p>}

        {created && (
          <div className="mt-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-xs space-y-1.5">
            <p className="text-[var(--fg)] font-medium">계정이 생성되었습니다</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--fg-muted)]">이메일</span>
              <code className="text-[var(--fg)]">{created.email}</code>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--fg-muted)]">비밀번호</span>
              <code className="text-[var(--fg)]">{created.password}</code>
            </div>
            <button
              type="button"
              onClick={handleCopyCreated}
              className="text-[var(--accent)] hover:underline"
            >
              복사하기
            </button>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[var(--fg)] mb-3">내 비밀번호 변경</h2>
        <form onSubmit={handleChangeMyPassword} className="flex gap-2">
          <input
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="새 비밀번호 (6자 이상)"
            className="flex-1 px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={changingPassword}
            className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
          >
            {changingPassword ? "변경 중..." : "비밀번호 변경"}
          </button>
        </form>
        {passwordError && <p className="mt-2 text-xs text-red-500">{passwordError}</p>}
        {passwordChanged && (
          <p className="mt-2 text-xs text-[var(--accent)]">비밀번호가 변경되었습니다.</p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[var(--fg)] mb-3">계정 목록</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--fg-muted)] border-b border-[var(--border)]">
              <th className="py-2 font-medium">이메일</th>
              <th className="py-2 font-medium">권한</th>
              <th className="py-2 font-medium">비밀번호</th>
              <th className="py-2 font-medium">가입일</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const isSelf = account.id === currentUserId;
              return (
                <tr key={account.id} className="border-b border-[var(--border)]">
                  <td className="py-2 text-[var(--fg)]">{account.email}</td>
                  <td className="py-2">
                    <select
                      value={account.role ?? "member"}
                      disabled={isSelf || busyId === account.id}
                      onChange={(e) => handleRoleChange(account.id, e.target.value)}
                      className="px-2 py-1 text-xs border border-[var(--border)] rounded bg-[var(--bg)] text-[var(--fg)] disabled:opacity-50"
                    >
                      <option value="member">member</option>
                      <option value="owner">owner</option>
                    </select>
                  </td>
                  <td className="py-2">
                    {visiblePasswordIds.has(account.id) && passwordCache[account.id] === null ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--fg-muted)]">
                          저장된 비밀번호 정보가 없습니다 (이 계정 생성 이후 추가된 기능이라
                          이전 계정은 기록이 없을 수 있음)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleResetPassword(account.id)}
                          disabled={resettingId === account.id}
                          className="text-xs text-[var(--accent)] hover:underline disabled:opacity-50 whitespace-nowrap"
                        >
                          {resettingId === account.id ? "재설정 중..." : "비밀번호 재설정"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs text-[var(--fg)]">
                          {visiblePasswordIds.has(account.id)
                            ? passwordCache[account.id]
                            : "••••••"}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleTogglePassword(account.id)}
                          disabled={loadingPasswordId === account.id}
                          className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors disabled:opacity-50"
                          aria-label={
                            visiblePasswordIds.has(account.id) ? "비밀번호 숨기기" : "비밀번호 보기"
                          }
                        >
                          {visiblePasswordIds.has(account.id) ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="py-2 text-[var(--fg-muted)]">
                    {new Date(account.createdAt).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleDelete(account.id)}
                      disabled={isSelf || busyId === account.id}
                      className="text-xs text-[var(--fg-muted)] hover:text-red-500 transition-colors disabled:opacity-30"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        {currentUserId && (
          <p className="mt-2 text-xs text-[var(--fg-muted)]">
            본인 계정의 권한 변경/삭제는 잠금 방지를 위해 제한됩니다.
          </p>
        )}
      </section>
    </div>
  );
}
