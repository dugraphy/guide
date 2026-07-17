"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { useState } from "react";

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
      <div className="flex items-center gap-2">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") handleSearch();
          }}
          placeholder="원하는 도메인을 입력하세요 예: mysite.com"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--accent)]"
        />
        <button
          type="button"
          onClick={handleSearch}
          className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          가비아에서 가격 확인하기
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
