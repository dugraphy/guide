"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountRow } from "@/lib/admin-users";

interface Props {
  accounts: AccountRow[];
  currentUserId: string | null;
}

export default function AdminClient({ accounts, currentUserId }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "초대 발송에 실패했습니다.");
    } else {
      setEmail("");
      router.refresh();
    }
    setInviting(false);
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

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-[var(--fg)] mb-3">계정 생성</h2>
        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            className="flex-1 px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={inviting}
            className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
          >
            {inviting ? "발송 중..." : "계정 생성"}
          </button>
        </form>
        <p className="mt-2 text-xs text-[var(--fg-muted)]">
          입력한 이메일로 초대 메일이 발송됩니다. 초대받은 사람이 메일 속 링크를 눌러
          직접 비밀번호를 설정하면 계정이 활성화됩니다.
        </p>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[var(--fg)] mb-3">계정 목록</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--fg-muted)] border-b border-[var(--border)]">
              <th className="py-2 font-medium">이메일</th>
              <th className="py-2 font-medium">권한</th>
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
        {currentUserId && (
          <p className="mt-2 text-xs text-[var(--fg-muted)]">
            본인 계정의 권한 변경/삭제는 잠금 방지를 위해 제한됩니다.
          </p>
        )}
      </section>
    </div>
  );
}
