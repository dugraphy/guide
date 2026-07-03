-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Restricts SELECT on public.databases and public.database_rows to owners
-- only, superseding the "viewable by everyone" SELECT policies from
-- rls-hardening.sql. Safe to re-run.
--
-- WHY THIS IS NEEDED (unlike quotes/business_profile/account_secrets):
-- lib/databases.ts reads these two tables through the anon/publishable-key
-- client (lib/supabase.ts), not the service-role client. That means RLS is
-- the *actual* enforcement here, not just a defense-in-depth safety net —
-- anyone holding the public anon key (which is always extractable from the
-- client bundle) can call supabase.from('databases')... directly, bypassing
-- every app-level page redirect and requireOwnerOrForbidden() check. So
-- gating app/db/*/page.tsx and the /api/databases/* GET routes alone does
-- NOT actually restrict access to owners without this.
--
-- public.pages keeps its existing "viewable by everyone" policy — that's
-- genuinely public site content and is unrelated to this change.
--
-- Depends on public.is_owner() — run rls-hardening.sql first if you haven't.

drop policy if exists "Databases are viewable by everyone" on public.databases;
drop policy if exists "Only owners can view databases" on public.databases;
create policy "Only owners can view databases"
  on public.databases for select
  using (public.is_owner());

drop policy if exists "Database rows are viewable by everyone" on public.database_rows;
drop policy if exists "Only owners can view database rows" on public.database_rows;
create policy "Only owners can view database rows"
  on public.database_rows for select
  using (public.is_owner());
