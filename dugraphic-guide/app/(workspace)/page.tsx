import PageHeader from "@/components/editor/PageHeader";

const QUICK_LINKS = [
  { icon: "📄", label: "시작하기", href: "/page/getting-started", desc: "프로젝트 개요와 사용 방법" },
  { icon: "🎨", label: "디자인 시스템", href: "/page/design-system", desc: "컴포넌트 & 스타일 가이드" },
  { icon: "📝", label: "노트", href: "/page/notes", desc: "자유로운 메모 공간" },
];

export default function HomePage() {
  return (
    <div>
      <PageHeader
        icon="👋"
        title="안녕하세요!"
        description="Dugraphic Guide 워크스페이스에 오신 걸 환영합니다."
      />

      <div className="max-w-3xl px-24 py-4">
        {/* 구분선 */}
        <div className="border-t border-[var(--border)] mb-8" />

        {/* 빠른 이동 */}
        <section className="mb-10">
          <h2 className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider mb-3">
            빠른 이동
          </h2>
          <div className="grid grid-cols-1 gap-1.5">
            {QUICK_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--hover)] transition-colors group"
              >
                <span className="text-2xl">{link.icon}</span>
                <div>
                  <div className="text-sm font-medium text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">
                    {link.label}
                  </div>
                  <div className="text-xs text-[var(--fg-muted)]">{link.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* 빈 블록 힌트 */}
        <div className="text-[var(--fg-muted)] text-sm">
          <span className="select-none">여기를 클릭해 블록을 추가하거나 </span>
          <kbd className="px-1.5 py-0.5 rounded text-xs border border-[var(--border)] bg-[var(--bg-secondary)]">
            /
          </kbd>
          <span className="select-none"> 를 눌러 명령어를 입력하세요.</span>
        </div>
      </div>
    </div>
  );
}
