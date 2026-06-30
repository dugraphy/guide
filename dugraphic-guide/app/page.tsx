import PageHeader from "@/components/editor/PageHeader";
import { PAGES } from "@/lib/data";
import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <PageHeader
        icon="👋"
        title="안녕하세요!"
        description="Dugraphic Guide 워크스페이스에 오신 걸 환영합니다."
      />

      <div className="max-w-3xl px-24 py-4">
        <div className="border-t border-[var(--border)] mb-8" />

        <section>
          <h2 className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider mb-3">
            페이지
          </h2>
          <div className="flex flex-col gap-1.5">
            {PAGES.map((page) => (
              <Link
                key={page.slug}
                href={`/page/${page.slug}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--hover)] transition-colors group"
              >
                <span className="text-2xl">{page.icon}</span>
                <div>
                  <div className="text-sm font-medium text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">
                    {page.title}
                  </div>
                  <div className="text-xs text-[var(--fg-muted)]">
                    {page.description}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
