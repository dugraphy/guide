export const TABLE = {
  wrapper: "overflow-x-auto rounded-lg border border-[var(--border)] shadow-sm",
  table: "text-sm border-collapse",
  th: "relative text-left px-3 py-2.5 text-xs font-medium text-[var(--fg-muted)] bg-[var(--bg-secondary)] border-b border-r border-[var(--border)] whitespace-nowrap select-none overflow-visible",
  thAction: "w-10 bg-[var(--bg-secondary)] border-b border-[var(--border)]",
  td: "border-b border-r border-[var(--border)] p-0",
  tdAction: "border-b border-[var(--border)] w-10 text-center",
  thSpacer: "bg-[var(--bg-secondary)] border-b border-[var(--border)]",
  tdSpacer: "border-b border-[var(--border)]",
  tr: (idx: number) =>
    `group transition-colors duration-150 hover:bg-[var(--hover)] ${
      idx % 2 === 1 ? "bg-[var(--bg-secondary)]/40" : ""
    }`,
  cellInput:
    "w-full px-2 py-2 bg-transparent outline-none text-[var(--fg)] text-sm placeholder:text-[var(--fg-muted)]",
  cellSelect:
    "w-full px-2 py-2 bg-transparent outline-none text-[var(--fg)] text-sm cursor-pointer",
  deleteBtn:
    "opacity-0 group-hover:opacity-100 text-[var(--fg-muted)] hover:text-red-500 w-full py-2 transition-all text-base leading-none",
} as const;
