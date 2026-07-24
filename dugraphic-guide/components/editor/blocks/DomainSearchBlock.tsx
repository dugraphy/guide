"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { useState } from "react";
import { Search, ArrowRight } from "lucide-react";

// 가비아 도메인 검색은 GET 쿼리 파라미터로 검색어를 받지 않는다 — 실제로
// domain.gabia.com 메인 페이지의 검색 폼은 POST로 new_domain 필드를
// /regist/regist_step1.php 로 제출하며, 그 결과로 실제 검색 결과(추천 도메인
// 목록)가 렌더링되는 것을 직접 확인했다. 그래서 여기서도 동일하게 숨겨진
// <form method="post" target="_blank">을 만들어 제출하는 방식으로 새 탭을 연다.
const GABIA_SEARCH_ACTION = "https://domain.gabia.com/regist/regist_step1.php";

function openGabiaDomainSearch(domain: string) {
  const form = document.createElement("form");
  form.method = "post";
  form.action = GABIA_SEARCH_ACTION;
  form.target = "_blank";
  form.style.display = "none";

  const fields = { new_domain: domain, search_gubun: "domain_index", origin: "" };
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

function DomainSearchRenderer() {
  const [domain, setDomain] = useState("");

  const handleSearch = () => {
    const trimmed = domain.trim();
    if (!trimmed) return;
    openGabiaDomainSearch(trimmed);
  };

  return (
    <div contentEditable={false} className="my-1 w-full">
      {/* 버튼이 shrink-0인 채로 한 줄에 딱 맞춰져 있으면, 폭이 정확히
          맞아떨어질 때만 안 넘치고 폰트 렌더링/스크롤바 폭 차이로 살짝만
          좁아져도 본문 우측 경계 밖으로 튀어나간다. flex-wrap을 줘서
          폭이 부족할 때는 버튼이 같은 캡슐 안에서 다음 줄로 내려가도록
          해, 캡슐 폭이 항상 본문 영역 안에 맞도록 한다. */}
      <div className="flex flex-wrap items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg)] py-1 pr-1 pl-4 transition-shadow duration-150 focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]">
        <Search className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" strokeWidth={2} />
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") handleSearch();
          }}
          placeholder="원하는 도메인을 입력하세요 예: mysite.com"
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-muted)]"
        />
        <button
          type="button"
          onClick={handleSearch}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          가비아에서 가격 확인하기
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

const DomainSearchSpecFactory = createReactBlockSpec(
  {
    type: "domainSearch" as const,
    propSchema: {},
    content: "none" as const,
  },
  {
    render: () => <DomainSearchRenderer />,
  }
);

export const domainSearchSpec = DomainSearchSpecFactory();
