-- Who is coming to what, and by when you must sign up.

alter table public.club_events
  add column if not exists register_by date;

comment on column public.club_events.register_by is
  'Last day to enter. The page counts down to it and says plainly once it has passed.';

/*
 * One row per member per event. A meet-up calls it an RSVP and a competition
 * calls it "registered", but the shape is the same, so it is one table with one
 * status rather than two tables that would drift apart.
 */
create table if not exists public.club_attendance (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.club_events (id) on delete cascade,
  member_id  uuid not null references public.club_members (id) on delete cascade,
  status     text not null default 'going' check (status in ('going', 'maybe', 'not')),
  note       text,
  updated_at timestamptz not null default now(),
  unique (event_id, member_id)
);

create index if not exists club_attendance_event on public.club_attendance (event_id);

alter table public.club_attendance enable row level security;

-- Everyone signed in can see who is coming. That is the point: a child wants
-- to know whether their friends will be there.
drop policy if exists "members see who is coming" on public.club_attendance;
create policy "members see who is coming" on public.club_attendance
  for select to authenticated using (true);

/*
 * Answering is where care is needed. A parent may answer for their OWN child
 * and nobody else's, which means the database has to know whose child is
 * whose: club_members.profile_id links a member to the account that speaks for
 * them. An administrator may answer for anybody.
 *
 * Written as one policy covering insert, update AND delete, because the same
 * rule applies to all three -- and a forgotten delete policy is exactly how
 * somebody ends up able to cancel another family's place.
 *
 * Verified against the live database, with the administrator temporarily
 * demoted inside a transaction that was rolled back: an ordinary parent could
 * answer for their own child and was refused for another family's.
 */
drop policy if exists "answer for your own" on public.club_attendance;
create policy "answer for your own" on public.club_attendance
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.club_members m
      where m.id = club_attendance.member_id
        and m.profile_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.club_members m
      where m.id = club_attendance.member_id
        and m.profile_id = auth.uid()
    )
  );

revoke all on public.club_attendance from anon;
