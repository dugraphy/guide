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
  {"type":"table","content":{"type":"tableContent","rows":[
    {"cells":["항목","단가","조건","비고"]},
    {"cells":["","","",""]},
    {"cells":["","","",""]}
  ]}}
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
