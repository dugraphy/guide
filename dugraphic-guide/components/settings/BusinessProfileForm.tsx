"use client";

import { useState } from "react";
import type { BusinessProfile } from "@/lib/businessProfile";

const FIELDS: { key: keyof BusinessProfile; label: string; placeholder: string }[] = [
  { key: "companyName", label: "상호", placeholder: "듀그래픽" },
  { key: "businessNumber", label: "사업자번호", placeholder: "000-00-00000" },
  { key: "ownerName", label: "대표자", placeholder: "홍길동" },
  { key: "phone", label: "전화번호", placeholder: "010-0000-0000" },
  { key: "address", label: "주소", placeholder: "서울특별시 ..." },
  { key: "email", label: "이메일", placeholder: "example@email.com" },
];

interface Props {
  initialProfile: BusinessProfile;
}

export default function BusinessProfileForm({ initialProfile }: Props) {
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (key: keyof BusinessProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    const res = await fetch("/api/business-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "저장에 실패했습니다.");
    } else {
      setSaved(true);
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {FIELDS.map(({ key, label, placeholder }) => (
        <div key={key}>
          <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">
            {label}
          </label>
          <input
            type="text"
            value={profile[key]}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
          />
        </div>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        {saved && <span className="text-xs text-[var(--accent)]">저장되었습니다</span>}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </form>
  );
}
