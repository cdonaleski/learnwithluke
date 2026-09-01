-- Families, clubs, and a reading log.
--
-- Until now "member" meant one thing, and it really meant "member of the cube
-- club". Three ideas were tangled: having an account, belonging to a family,
-- and belonging to a club. Separating them costs a migration now and would
-- cost a rewrite later.

-- ------------------------------------------------------------- who you are --
/*
 * child   signs in as themselves and logs their own things. A child who keeps
 *         their reading under a parent's login stops bothering, so they get
 *         their own -- with less reach.
 * parent  responsible for one or more children. Can see and change what their
 *         own children have, and answer for them.
 * admin   runs the site.
 *
 * Copied deliberately from how family linking works everywhere else, because
 * every product that has thought hard about children arrived at the same shape.
 */
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('child', 'parent', 'admin', 'member'));

alter table public.profiles
  add column if not exists guardian_id uuid references public.profiles (id) on delete set null,
  add column if not exists consent_at timestamptz,
  add column if not exists consent_by uuid references public.profiles (id) on delete set null;

comment on column public.profiles.consent_at is
  'When a parent agreed to this child having an account. The requirement is not that a parent agreed but that it can be SHOWN they agreed, so it is recorded rather than assumed. Note there is deliberately no date of birth anywhere: knowing a child is a child comes from an adult enrolling them, and collecting ages would raise obligations rather than lower them.';

create or replace function public.is_guardian_of(child uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = child and p.guardian_id = auth.uid());
$$;

revoke all on function public.is_guardian_of(uuid) from public, anon;
grant execute on function public.is_guardian_of(uuid) to authenticated;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid() or guardian_id = auth.uid() or public.is_admin());

-- --------------------------------------------------------------- the clubs --
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  blurb text,
  created_at timestamptz not null default now()
);

create table if not exists public.club_memberships (
  club_id uuid not null references public.clubs (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (club_id, profile_id)
);

alter table public.clubs enable row level security;
alter table public.club_memberships enable row level security;

drop policy if exists "signed in can see clubs" on public.clubs;
create policy "signed in can see clubs" on public.clubs
  for select to authenticated using (true);
drop policy if exists "admin writes clubs" on public.clubs;
create policy "admin writes clubs" on public.clubs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "see club memberships" on public.club_memberships;
create policy "see club memberships" on public.club_memberships
  for select to authenticated using (true);
drop policy if exists "admin writes memberships" on public.club_memberships;
create policy "admin writes memberships" on public.club_memberships
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.clubs, public.club_memberships from anon;

-- ------------------------------------------------------------------- books --
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  author text,
  status text not null default 'reading'
    check (status in ('want', 'reading', 'finished', 'stopped')),
  started_on date,
  finished_on date,
  rating integer check (rating between 1 and 5),
  pages integer,
  notes text,
  isbn text,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.books.status is
  'stopped is deliberately not called abandoned or failed. Giving up on a book is a perfectly good decision, and a child who thinks otherwise grinds through one they hate and then stops reading altogether.';

comment on column public.books.shared is
  'Off by default. A reading list is private until somebody decides otherwise.';

create index if not exists books_owner on public.books (owner_id);
alter table public.books enable row level security;

/*
 * Readable by: its owner, their parent, anybody if it was shared, the
 * administrator. Changeable by: its owner, their parent, the administrator.
 * Sharing a book lets others READ it, never edit it.
 *
 * Verified against the live database with three pretend accounts inside a
 * rolled-back transaction: a child saw their own two books, their parent saw
 * both of them, and an unrelated child saw the shared one and their own --
 * but not the private one.
 */
drop policy if exists "read your own and shared books" on public.books;
create policy "read your own and shared books" on public.books
  for select to authenticated
  using (owner_id = auth.uid() or public.is_guardian_of(owner_id) or shared or public.is_admin());

drop policy if exists "write your own books" on public.books;
create policy "write your own books" on public.books
  for all to authenticated
  using (owner_id = auth.uid() or public.is_guardian_of(owner_id) or public.is_admin())
  with check (owner_id = auth.uid() or public.is_guardian_of(owner_id) or public.is_admin());

revoke all on public.books from anon;
