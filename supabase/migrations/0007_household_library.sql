-- A family library, rather than a pile of private shelves.
--
-- The first version gave every book an owner and made sharing the exception.
-- That is how most apps work and it is wrong for a household: the books belong
-- to the family. Whose book it is, and who is reading it, are things you tag ON
-- a book -- and two children reading the same copy each need their own
-- progress, which an owner column cannot express at all.
--
-- Nothing was lost by changing it: no books had been added yet.

drop table if exists public.books cascade;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

/*
 * Explicit rather than derived from guardian links. Two parents in one house
 * are not each other's guardian, and no amount of following guardian_id would
 * ever put them on the same shelf.
 */
create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, profile_id)
);

create or replace function public.in_household(which uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members hm
                 where hm.household_id = which and hm.profile_id = auth.uid());
$$;

revoke all on function public.in_household(uuid) from public, anon;
grant execute on function public.in_household(uuid) to authenticated;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null,
  author text,
  isbn text,
  pages integer,
  belongs_to uuid references public.profiles (id) on delete set null,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.books.belongs_to is
  'Whose book it is. Null means the household''s -- which is most books in most houses, so it is the default.';

/*
 * One row per person per book. This is what makes "we are reading it together"
 * expressible, and it means two children reading the same copy each keep their
 * own progress and their own opinion of it.
 */
create table if not exists public.book_readers (
  book_id uuid not null references public.books (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'reading'
    check (status in ('want', 'reading', 'finished', 'stopped')),
  started_on date,
  finished_on date,
  rating integer check (rating between 1 and 5),
  notes text,
  updated_at timestamptz not null default now(),
  primary key (book_id, profile_id)
);

create index if not exists books_household on public.books (household_id);
create index if not exists book_readers_person on public.book_readers (profile_id);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.books enable row level security;
alter table public.book_readers enable row level security;

drop policy if exists "see your household" on public.households;
create policy "see your household" on public.households
  for select to authenticated using (public.in_household(id) or public.is_admin());
drop policy if exists "admin writes households" on public.households;
create policy "admin writes households" on public.households
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "see who is in your household" on public.household_members;
create policy "see who is in your household" on public.household_members
  for select to authenticated using (public.in_household(household_id) or public.is_admin());
drop policy if exists "admin writes household members" on public.household_members;
create policy "admin writes household members" on public.household_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Everyone in the house sees the whole library. That is the point of it.
drop policy if exists "the household reads its library" on public.books;
create policy "the household reads its library" on public.books
  for select to authenticated
  using (public.in_household(household_id) or shared or public.is_admin());

drop policy if exists "the household keeps its library" on public.books;
create policy "the household keeps its library" on public.books
  for all to authenticated
  using (public.in_household(household_id) or public.is_admin())
  with check (public.in_household(household_id) or public.is_admin());

drop policy if exists "see reading in your household" on public.book_readers;
create policy "see reading in your household" on public.book_readers
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.books b where b.id = book_readers.book_id
               and (public.in_household(b.household_id) or b.shared))
  );

/*
 * You may record YOUR OWN reading, or your child's. Not a sibling's: inside a
 * family everybody can SEE everything, but marking somebody else's book
 * finished on their behalf is the sort of small indignity that starts an
 * argument.
 *
 * Verified on the live database inside a rolled-back transaction, with a
 * second child added to the house and one outsider: the child saw the family
 * library, the outsider saw none of it, and the child's attempt to mark a
 * sibling's book finished was refused.
 */
drop policy if exists "record your own reading" on public.book_readers;
create policy "record your own reading" on public.book_readers
  for all to authenticated
  using (profile_id = auth.uid() or public.is_guardian_of(profile_id) or public.is_admin())
  with check (profile_id = auth.uid() or public.is_guardian_of(profile_id) or public.is_admin());

revoke all on public.households, public.household_members,
                public.books, public.book_readers from anon;
