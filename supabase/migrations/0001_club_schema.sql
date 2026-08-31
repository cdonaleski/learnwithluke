-- Learn With Luke — accounts, and the club behind them.
--
-- The club used to be protected by an encrypted file and a shared password.
-- That hid the content, but it could never REFUSE anybody: the ciphertext was
-- public and the only defence was how hard the password was to guess. Here the
-- database itself declines to hand the rows over unless the request carries a
-- session it recognises. That is a different kind of protection, and a real one.
--
-- Everything below assumes row-level security is doing the work. Every table
-- has it enabled, no table has a policy for anonymous readers, and writing is
-- limited to one administrator. If a policy here is wrong, the site is wrong,
-- so each is written to be read rather than to be clever.

-- ---------------------------------------------------------------- profiles --
-- One row per account, created automatically when somebody is added.

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role        text not null default 'member' check (role in ('member', 'admin')),
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'One row per signed-in person. role decides what they may change, never what the browser claims.';

-- A new account gets a profile without anybody remembering to make one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Asking "is this person an administrator?" from inside a policy ON profiles
-- would read profiles again and recurse for ever. security definer runs the
-- lookup with the owner's rights, outside row-level security, which breaks the
-- circle. It is deliberately the only function that does so.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'True when the CURRENT session belongs to an administrator. Never trusts anything the client sends.';

-- ------------------------------------------------------------ club content --

create table if not exists public.club_pages (
  key        text primary key,          -- 'welcome', 'rules', 'contact'
  title      text not null,
  body       text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.club_members (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  name       text not null,
  role       text,                      -- 'Parent sponsor', and so on
  wca_id     text,
  note       text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on column public.club_members.profile_id is
  'Null for a member with no account yet. A member is not the same thing as a login.';

create table if not exists public.club_results (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.club_members (id) on delete cascade,
  competition text not null,
  event       text not null default '3x3x3 Cube',
  round       text,
  place       integer,
  single      text,
  average     text,
  solves      jsonb not null default '[]'::jsonb,
  held_on     date
);

create table if not exists public.club_events (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  slug     text,                        -- the WCA competition id
  held_on  date not null,
  venue    text,
  city     text,
  fee      text,
  capacity integer,
  note     text
);

create index if not exists club_results_member on public.club_results (member_id);
create index if not exists club_events_when on public.club_events (held_on);

-- --------------------------------------------------------------------- RLS --
-- Nothing below is readable by an anonymous visitor. There is no policy for
-- the anon role anywhere in this file, and that omission is the point.

alter table public.profiles      enable row level security;
alter table public.club_pages    enable row level security;
alter table public.club_members  enable row level security;
alter table public.club_results  enable row level security;
alter table public.club_events   enable row level security;

-- Profiles: you may see yourself; an administrator may see and change everyone.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "admin writes profiles" on public.profiles;
create policy "admin writes profiles" on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Club content: any signed-in member may read it; only an administrator may
-- change it. Written out per table rather than looped, so each can be read on
-- its own and none can be changed by accident.
drop policy if exists "members read pages" on public.club_pages;
create policy "members read pages" on public.club_pages
  for select to authenticated using (true);
drop policy if exists "admin writes pages" on public.club_pages;
create policy "admin writes pages" on public.club_pages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members read members" on public.club_members;
create policy "members read members" on public.club_members
  for select to authenticated using (true);
drop policy if exists "admin writes members" on public.club_members;
create policy "admin writes members" on public.club_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members read results" on public.club_results;
create policy "members read results" on public.club_results
  for select to authenticated using (true);
drop policy if exists "admin writes results" on public.club_results;
create policy "admin writes results" on public.club_results
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members read events" on public.club_events;
create policy "members read events" on public.club_events
  for select to authenticated using (true);
drop policy if exists "admin writes events" on public.club_events;
create policy "admin writes events" on public.club_events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- The anon role is granted nothing at all on these tables.
revoke all on public.profiles, public.club_pages, public.club_members,
                public.club_results, public.club_events from anon;
