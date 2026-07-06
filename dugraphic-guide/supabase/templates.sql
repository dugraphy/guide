-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Creates the `templates` table used by the BlockNote slash menu's "템플릿"
-- section, adds RLS (read for everyone, write for owner only — same pattern
-- as rls-hardening.sql, reusing its public.is_owner() helper), and seeds the
-- 7 default templates. Safe to re-run: the seed insert is keyed on the
-- unique `name` column and upserts, so re-running after editing a template's
-- blocks below re-syncs the existing row instead of being skipped.
--
-- Depends on public.is_owner() — run rls-hardening.sql first if you haven't.

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default '📄',
  -- BlockNote PartialBlock[] JSON, inserted as-is at the cursor when picked
  -- from the slash menu (editor.insertBlocks(blocks, ...)).
  blocks jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.templates enable row level security;

drop policy if exists "Templates are viewable by everyone" on public.templates;
create policy "Templates are viewable by everyone"
  on public.templates for select
  using (true);

drop policy if exists "Owners can insert templates" on public.templates;
create policy "Owners can insert templates"
  on public.templates for insert
  with check (public.is_owner());

drop policy if exists "Owners can update templates" on public.templates;
create policy "Owners can update templates"
  on public.templates for update
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "Owners can delete templates" on public.templates;
create policy "Owners can delete templates"
  on public.templates for delete
  using (public.is_owner());

-- ── seed: 7 default templates ───────────────────────────────────────────
-- Each `todo` block's `dueDate` prop is an ISO "YYYY-MM-DD" string (empty =
-- no date). Left blank here on purpose — it's designed to be filled in per
-- item later and reused by future percentage-complete / calendar features.
--
-- No leading heading block on purpose: the slash menu item already shows the
-- template name, so repeating it as the first line of the inserted content
-- would be redundant.
insert into public.templates (name, icon, sort_order, blocks) values

('업무 목록', '✅', 1, $tpl1$[
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"담당자: 홍길동 — 업무 내용을 입력하세요"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"담당자: 김철수 — 업무 내용을 입력하세요"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"담당자: 이영희 — 업무 내용을 입력하세요"}
]$tpl1$::jsonb),

('주간업무', '📅', 2, $tpl2$[
  {"type":"heading","props":{"level":2},"content":"월요일"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"heading","props":{"level":2},"content":"화요일"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"heading","props":{"level":2},"content":"수요일"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"heading","props":{"level":2},"content":"목요일"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"heading","props":{"level":2},"content":"금요일"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"heading","props":{"level":2},"content":"토요일"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"heading","props":{"level":2},"content":"일요일"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"}
]$tpl2$::jsonb),

('월간업무', '🗓️', 3, $tpl3$[
  {"type":"heading","props":{"level":2},"content":"1주차"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"heading","props":{"level":2},"content":"2주차"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"heading","props":{"level":2},"content":"3주차"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"heading","props":{"level":2},"content":"4주차"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"heading","props":{"level":2},"content":"5주차"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"},
  {"type":"todo","props":{"checked":false,"dueDate":""},"content":"업무 내용을 입력하세요"}
]$tpl3$::jsonb),

('실수리스트', '⚠️', 4, $tpl4$[
  {"type":"table","content":{"type":"tableContent","rows":[
    {"cells":["발생일","내용","원인","담당자"]},
    {"cells":["","","",""]},
    {"cells":["","","",""]}
  ]}}
]$tpl4$::jsonb),

('재발방지', '🛡️', 5, $tpl5$[
  {"type":"table","content":{"type":"tableContent","rows":[
    {"cells":["원인","대책","적용일","확인여부"]},
    {"cells":["","","",""]},
    {"cells":["","","",""]}
  ]}}
]$tpl5$::jsonb),

('가격정책', '💰', 6, $tpl6$[
  {"type":"paragraph","content":"본 견적은 프로젝트 범위 확인 후 상담을 통해 최종 산정됩니다. 아래 기준 단가는 참고용입니다."},
  {"type":"heading","props":{"level":3},"content":"기준 단가표"},
  {"type":"tabGroup","props":{"tabs":"[{\"title\":\"자체 개발형\",\"content\":[{\"type\":\"paragraph\",\"content\":\"순수 서버·도메인 연결 비용입니다. 직접 개발한 사이트를 안정적으로 운영하기 위한 서버 호스팅과 도메인 연결 비용이며, 디자인·개발 비용과는 별도로 청구됩니다.\"},{\"type\":\"table\",\"content\":{\"type\":\"tableContent\",\"rows\":[{\"cells\":[\"등급\",\"대상\",\"가격\"]},{\"cells\":[\"라이트\",\"\",\"\"]},{\"cells\":[\"스탠다드\",\"\",\"\"]},{\"cells\":[\"프로\",\"\",\"\"]}]}}]},{\"title\":\"웹빌더형\",\"content\":[{\"type\":\"paragraph\",\"content\":\"웹빌더 소프트웨어, 디자인 템플릿 이용료와 호스팅이 포함된 플랫폼 구독 비용입니다. 별도의 서버 관리 없이 웹빌더사가 제공하는 환경을 그대로 사용합니다.\"},{\"type\":\"table\",\"content\":{\"type\":\"tableContent\",\"rows\":[{\"cells\":[\"등급\",\"대상\",\"가격\"]},{\"cells\":[\"라이트\",\"\",\"\"]},{\"cells\":[\"스탠다드\",\"\",\"\"]},{\"cells\":[\"프로\",\"\",\"\"]}]}}]}]","activeTab":0}},
  {"type":"heading","props":{"level":3},"content":"가격이 달라지는 경우"},
  {"type":"calloutBox","props":{"items":"[\"레퍼런스 있음: 기본가 × 1.0\",\"레퍼런스 없이 처음부터 컨셉 설계: 기본가에 (편집 가능한 금액)원 추가\",\"일러스트 제작: 건당 (편집 가능한 금액)원 추가\",\"플랫폼 마이그레이션: 건당 (편집 가능한 금액)원 추가\"]"}},
  {"type":"heading","props":{"level":3},"content":"계약금/잔금 기준"},
  {"type":"calloutBox","props":{"items":"[\"계약금은 시안 작업 비용이며, 계약금 입금 시 계약이 확정됩니다.\",\"결과물 제작이 완료되면 잔금 입금 시 결과물이 제공됩니다.\"]"}},
  {"type":"heading","props":{"level":3},"content":"계약금 및 취소 규정"},
  {"type":"calloutBox","props":{"items":"[\"계약금 입금 시점부터 시안 기획 및 초기 작업이 착수되며, 이는 단순 예약금이 아닌 초기 작업에 대한 대가로 간주됩니다.\",\"시안 전달 후 (편집 가능한 숫자)일 이내 별도의 이의 제기가 없을 경우, 해당 시안은 승인된 것으로 간주하며 이후 계약금은 환불되지 않습니다.\",\"시안 승인(문자/카카오톡/이메일을 통한 명시적 승인 포함) 이후 작업이 진행된 경우, 계약금은 환불되지 않습니다.\"]"}}
]$tpl6$::jsonb),

('환불정책', '📋', 7, $tpl7$[
  {"type":"heading","props":{"level":3},"content":"제1조 (목적)"},
  {"type":"paragraph","content":"이 환불정책은 서비스 이용에 대한 환불 기준과 절차를 정합니다."},
  {"type":"heading","props":{"level":3},"content":"제2조 (환불 기준)"},
  {"type":"paragraph","content":"환불 기준에 대한 설명을 입력하세요."},
  {"type":"heading","props":{"level":3},"content":"제3조 (환불 절차)"},
  {"type":"paragraph","content":"환불 절차에 대한 설명을 입력하세요."},
  {"type":"heading","props":{"level":3},"content":"제4조 (예외 사항)"},
  {"type":"paragraph","content":"환불이 제한되는 예외 사항을 입력하세요."}
]$tpl7$::jsonb)

on conflict (name) do update set
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  blocks = excluded.blocks;
