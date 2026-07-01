-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Creates the profiles table and a trigger that auto-provisions a row for every
-- new auth.users record, regardless of signup method (email/password or Google OAuth).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('owner', 'member'))
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by the owning user" on public.profiles;
create policy "Profiles are viewable by the owning user"
  on public.profiles for select
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when new.email = 'zxasqw24720106@gmail.com' then 'owner' else 'member' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: creates profiles for any users who already signed up before this
-- trigger existed. Safe to re-run.
insert into public.profiles (id, email, role)
select id, email, case when email = 'zxasqw24720106@gmail.com' then 'owner' else 'member' end
from auth.users
on conflict (id) do nothing;
