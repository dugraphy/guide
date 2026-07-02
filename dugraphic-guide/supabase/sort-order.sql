-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Adds drag-and-drop ordering support to the "페이지" and "데이터베이스"
-- 사이드바 목록. Safe to re-run.

alter table public.pages
  add column if not exists sort_order integer;

alter table public.databases
  add column if not exists sort_order integer;

-- Backfill: seed initial order from the current alphabetical listing so
-- existing installs keep their current order until someone drags an item.
-- ("home" is excluded from the sidebar list, so it's excluded here too.)
with ranked as (
  select slug, row_number() over (order by title) - 1 as rn
  from public.pages
  where slug <> 'home'
)
update public.pages p
set sort_order = ranked.rn
from ranked
where p.slug = ranked.slug
  and p.sort_order is null;

with ranked as (
  select slug, row_number() over (order by name) - 1 as rn
  from public.databases
)
update public.databases d
set sort_order = ranked.rn
from ranked
where d.slug = ranked.slug
  and d.sort_order is null;
