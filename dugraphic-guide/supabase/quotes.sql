-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Creates the `quotes` and `business_profile` tables for the "견적서" feature.
--
-- Unlike pages/databases (readable by everyone), quote records and the
-- business registration info are owner-only in both directions — they're a
-- back-office billing tool, not wiki content. The app never relies on RLS
-- for this (every route double-checks with requireOwnerOrForbidden()/
-- getSessionUser() first and reads/writes via the service-role admin
-- client — see lib/quotes.ts, lib/businessProfile.ts), but RLS is still the
-- safety net for direct anon/authenticated access.
--
-- Depends on public.is_owner() — run rls-hardening.sql first if you haven't.

-- ── business_profile: singleton row ─────────────────────────────────────
-- `id boolean primary key default true check (id)` is a standard Postgres
-- singleton-table trick: only one row can ever exist (id can only be
-- `true`), so the app never has to handle a "no profile yet" empty state —
-- it always upserts/updates the one row with id = true.
create table if not exists public.business_profile (
  id boolean primary key default true check (id),
  business_number text not null default '',
  company_name text not null default '',
  owner_name text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.business_profile (id) values (true) on conflict (id) do nothing;

alter table public.business_profile enable row level security;

drop policy if exists "Owners can view business profile" on public.business_profile;
create policy "Owners can view business profile"
  on public.business_profile for select
  using (public.is_owner());

drop policy if exists "Owners can update business profile" on public.business_profile;
create policy "Owners can update business profile"
  on public.business_profile for update
  using (public.is_owner())
  with check (public.is_owner());

-- ── quotes ────────────────────────────────────────────────────────────────
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  quote_date date not null,
  quote_type text not null check (quote_type in ('리뉴얼', '신규')),
  -- QuoteItem[] JSON: { name, unitPrice, discountPrice, qty, note }
  items jsonb not null default '[]'::jsonb,
  deposit_rate numeric not null default 30,
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.quotes enable row level security;

drop policy if exists "Owners can view quotes" on public.quotes;
create policy "Owners can view quotes"
  on public.quotes for select
  using (public.is_owner());

drop policy if exists "Owners can insert quotes" on public.quotes;
create policy "Owners can insert quotes"
  on public.quotes for insert
  with check (public.is_owner());

drop policy if exists "Owners can delete quotes" on public.quotes;
create policy "Owners can delete quotes"
  on public.quotes for delete
  using (public.is_owner());

-- vat_included: 이 견적서가 "부가세 포함" 기준으로 작성됐는지 여부. 목록
-- 화면(/quotes)에서 총 청구액을 정확히 계산하려면 필요하다. Safe to re-run.
alter table public.quotes
  add column if not exists vat_included boolean not null default false;

-- 계좌 정보: 견적서 엑셀의 계약금 안내에 입금 계좌를 표시하기 위한 필드.
-- Safe to re-run.
alter table public.business_profile
  add column if not exists bank_name text not null default '';
alter table public.business_profile
  add column if not exists account_number text not null default '';
alter table public.business_profile
  add column if not exists account_holder text not null default '';

-- 견적 유형 확장: 연장, 디자인 추가. Safe to re-run.
alter table public.quotes drop constraint if exists quotes_quote_type_check;
alter table public.quotes add constraint quotes_quote_type_check
  check (quote_type in ('리뉴얼', '신규', '연장', '디자인'));
