-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Creates public.account_secrets, a separate table holding each account's
-- current plaintext password so an owner can look it up from /admin.
--
-- SECURITY NOTE: storing plaintext passwords is not recommended practice.
-- This is a deliberate, acknowledged tradeoff for a small internal team —
-- see the /admin password-reveal feature. Kept in its own table (rather
-- than a column on public.profiles) specifically so it can have a strict
-- owner-only RLS policy independent of profiles' existing "self can view
-- own row" policy — a member must not be able to read this table for
-- their own account either.
--
-- Depends on public.is_owner() — run rls-hardening.sql first if you haven't.

create table if not exists public.account_secrets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_plain text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.account_secrets enable row level security;

-- No insert/update/delete policy for anon/authenticated roles is created —
-- the app only ever writes here via the service-role client, from
-- lib/admin-users.ts, after requireOwnerOrForbidden() has already run.
drop policy if exists "Only owners can view account secrets" on public.account_secrets;
create policy "Only owners can view account secrets"
  on public.account_secrets for select
  using (public.is_owner());
