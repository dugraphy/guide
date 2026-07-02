-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Hardens RLS on profiles/pages/databases/database_rows to match the
-- owner/member model: everyone can read, only an owner can write. Replaces
-- any existing "public_all_..." (or other) fully-open policies. Safe to
-- re-run.
--
-- IMPORTANT — pair this with the accompanying app change: the write paths in
-- lib/pages.ts and lib/databases.ts (and app/api/databases/route.ts) now use
-- the Supabase service_role key instead of the anon/publishable key, because
-- those functions run on the server *after* requireOwnerOrForbidden() has
-- already checked the caller. service_role bypasses RLS by design — RLS
-- here is the safety net for anyone hitting Supabase directly with just the
-- anon key, not the mechanism the app itself relies on for authorization.

-- ── helper: is the current request's user an owner? ─────────────────────────
-- security definer so this can read profiles regardless of the caller's own
-- row-level visibility, and so other tables' policies can reuse it without
-- recursing back into profiles' own RLS.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'owner'
  );
$$;

-- ── reset: drop every existing policy on the tables we're locking down ──────
-- Covers unknown/legacy policy names (e.g. "public_all_databases") so none
-- of them linger alongside the new ones below.
do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'databases', 'database_rows', 'pages')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- ── profiles ──────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- 본인 프로필은 항상 조회 가능, owner는 전체 계정 목록(/admin) 조회를 위해
-- 모든 프로필을 조회 가능.
create policy "Profiles are viewable by self or owner"
  on public.profiles for select
  using (auth.uid() = id or public.is_owner());

-- INSERT 정책은 의도적으로 만들지 않는다 — auth.users insert 트리거
-- (handle_new_user, security definer)를 통한 자동 생성만 허용되고,
-- anon/authenticated 키로 직접 INSERT할 수 있는 경로는 없다.

-- 본인 프로필은 수정 가능(단, role 변경은 아래 트리거가 막음),
-- owner는 아무 프로필이나(role 포함) 수정 가능.
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Owners can update any profile"
  on public.profiles for update
  using (public.is_owner())
  with check (public.is_owner());

-- role 컬럼은 owner(또는 이미 owner 여부를 확인한 서버의 service_role 호출)만
-- 바꿀 수 있도록 트리거로 방어한다. RLS의 with check만으로는 "이전 값과
-- 다른지"를 안전하게 표현하기 어려워 트리거를 사용한다.
create or replace function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.role() <> 'service_role'
     and not public.is_owner() then
    raise exception 'Only an owner can change a profile role.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role_change on public.profiles;
create trigger profiles_guard_role_change
  before update on public.profiles
  for each row execute function public.prevent_unauthorized_role_change();

-- ── pages ─────────────────────────────────────────────────────────────────
alter table public.pages enable row level security;

create policy "Pages are viewable by everyone"
  on public.pages for select
  using (true);

create policy "Owners can insert pages"
  on public.pages for insert
  with check (public.is_owner());

create policy "Owners can update pages"
  on public.pages for update
  using (public.is_owner())
  with check (public.is_owner());

create policy "Owners can delete pages"
  on public.pages for delete
  using (public.is_owner());

-- ── databases ─────────────────────────────────────────────────────────────
alter table public.databases enable row level security;

create policy "Databases are viewable by everyone"
  on public.databases for select
  using (true);

create policy "Owners can insert databases"
  on public.databases for insert
  with check (public.is_owner());

create policy "Owners can update databases"
  on public.databases for update
  using (public.is_owner())
  with check (public.is_owner());

create policy "Owners can delete databases"
  on public.databases for delete
  using (public.is_owner());

-- ── database_rows ─────────────────────────────────────────────────────────
alter table public.database_rows enable row level security;

create policy "Database rows are viewable by everyone"
  on public.database_rows for select
  using (true);

create policy "Owners can insert database rows"
  on public.database_rows for insert
  with check (public.is_owner());

create policy "Owners can update database rows"
  on public.database_rows for update
  using (public.is_owner())
  with check (public.is_owner());

create policy "Owners can delete database rows"
  on public.database_rows for delete
  using (public.is_owner());
