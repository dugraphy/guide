"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { useState, useEffect, useRef } from "react";
import type { PageData } from "@/lib/data";

function PageLinkRenderer({
  block,
  editor,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  block: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any;
}) {
  const { pageSlug, pageTitle, pageIcon, pageDescription } =
    block.props as {
      pageSlug: string;
      pageTitle: string;
      pageIcon: string;
      pageDescription: string;
    };

  const [pages, setPages] = useState<PageData[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pageSlug) {
      setLoading(true);
      fetch("/api/pages")
        .then((r) => r.json())
        .then((data: PageData[]) => {
          setPages(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [pageSlug]);

  const filtered =
    query
      ? pages.filter(
          (p) =>
            p.title.toLowerCase().includes(query.toLowerCase()) ||
            p.slug.toLowerCase().includes(query.toLowerCase())
        )
      : pages;

  const selectPage = (page: PageData) => {
    editor.updateBlock(block.id, {
      props: {
        pageSlug: page.slug,
        pageTitle: page.title,
        pageIcon: page.icon || "📄",
        pageDescription: page.description || "",
      },
    });
  };

  if (pageSlug) {
    return (
      <div contentEditable={false} className="my-0.5">
        <a
          href={`/page/${pageSlug}`}
          className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--hover)] transition-colors group no-underline"
        >
          <span className="text-2xl shrink-0">{pageIcon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">
              {pageTitle}
            </div>
            {pageDescription && (
              <div className="text-xs text-[var(--fg-muted)] truncate">
                {pageDescription}
              </div>
            )}
          </div>
          <span className="text-[var(--fg-muted)] text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            열기 →
          </span>
        </a>
      </div>
    );
  }

  return (
    <div
      contentEditable={false}
      className="my-0.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3"
    >
      <div className="text-xs font-medium text-[var(--fg-muted)] mb-2">
        페이지 선택
      </div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="페이지 검색..."
        className="w-full text-sm bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 mb-2 outline-none text-[var(--fg)] placeholder:text-[var(--fg-muted)]"
      />
      {loading ? (
        <div className="text-xs text-[var(--fg-muted)] py-1 text-center">
          불러오는 중...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-xs text-[var(--fg-muted)] py-1 text-center">
          {query ? "검색 결과 없음" : "페이지가 없습니다."}
        </div>
      ) : (
        <ul className="max-h-48 overflow-y-auto -mx-1">
          {filtered.map((page) => (
            <li key={page.slug}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectPage(page);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-[var(--hover)] text-[var(--fg)] transition-colors"
              >
                <span className="text-base shrink-0">{page.icon}</span>
                <span className="truncate">{page.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const PageLinkSpecFactory = createReactBlockSpec(
  {
    type: "pageLink" as const,
    propSchema: {
      pageSlug: { default: "" },
      pageTitle: { default: "" },
      pageIcon: { default: "📄" },
      pageDescription: { default: "" },
    },
    content: "none" as const,
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block, editor }: any) => (
      <PageLinkRenderer block={block} editor={editor} />
    ),
  }
);

export const pageLinkSpec = PageLinkSpecFactory();
