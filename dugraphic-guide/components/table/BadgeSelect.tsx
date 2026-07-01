"use client";

const FALLBACK = "bg-[var(--bg-secondary)] text-[var(--fg-muted)]";

export const BADGE_COLORS: Record<string, Record<string, string>> = {
  업종: {
    쇼핑몰: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    병의원: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    숙박업: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    기업:   "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    기타:   "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
  상태: {
    신규:   "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    진행중: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    완료:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  진행여부: {
    예정:   "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    상담중: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    완료:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    보류:   "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
};

interface BadgeSelectProps {
  colId: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}

export function BadgeSelect({ colId, value, options, onChange }: BadgeSelectProps) {
  const map = BADGE_COLORS[colId] ?? {};
  const colorClass = value ? (map[value] ?? FALLBACK) : "text-[var(--fg-muted)]";
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`appearance-none rounded-full px-2.5 py-0.5 text-xs font-medium border-0 outline-none cursor-pointer transition-colors hover:opacity-80 ${colorClass}`}
    >
      <option value="">-</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

export function StaticBadge({ colId, value }: { colId: string; value: string }) {
  if (!value) return <span className="text-[var(--fg-muted)] text-xs">-</span>;
  const map = BADGE_COLORS[colId] ?? {};
  const colorClass = map[value] ?? FALLBACK;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {value}
    </span>
  );
}
