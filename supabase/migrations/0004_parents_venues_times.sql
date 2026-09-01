-- Parents alongside the children, and fuller details for competitions.

alter table public.club_members
  add column if not exists parent_name text,
  add column if not exists share_parent_contact boolean not null default false;

comment on column public.club_members.share_parent_contact is
  'When true, other signed-in members may see this parent''s email and phone. Default false: sharing is a decision somebody makes, not one they forget to prevent.';

/*
 * Row-level security decides which ROWS you may see, never which columns. So
 * "other members may see the parent's phone only if it was shared" cannot be
 * written as a policy on club_members -- the child's name and the parent's
 * phone would stand or fall together, and the children must always be visible
 * to each other. Splitting the contact details into their own table makes the
 * rule sayable, and the database enforces it rather than the page choosing
 * what to draw.
 */
create table if not exists public.club_member_contacts (
  member_id uuid primary key references public.club_members (id) on delete cascade,
  email     text,
  phone     text,
  note      text
);

alter table public.club_member_contacts enable row level security;

drop policy if exists "members read shared parent contacts" on public.club_member_contacts;
create policy "members read shared parent contacts" on public.club_member_contacts
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.club_members m
      where m.id = club_member_contacts.member_id
        and m.share_parent_contact
    )
  );

drop policy if exists "admin writes parent contacts" on public.club_member_contacts;
create policy "admin writes parent contacts" on public.club_member_contacts
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.club_member_contacts from anon;

-- A competition needs enough to actually turn up to: the full address, what
-- time it starts, and its own web page.
alter table public.club_events
  add column if not exists url text,
  add column if not exists address text,
  add column if not exists starts_at time,
  add column if not exists ends_at time;

comment on column public.club_events.address is
  'The whole address, not just the town -- this is what goes into a calendar entry and a map.';
