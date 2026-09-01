-- Who may see a club, and who may run one.
--
-- Two things were conflated. The club page asked "do you have an account?"
-- when it should have asked "did an administrator let you in?" -- having a
-- login and being in the speedcube club are not the same thing, and the books
-- prove it: anybody signed in has a family library, but the club is by
-- invitation. Before this, any signed-in stranger could read the club roster
-- and the parents' contact details.
--
-- Running a club is a third thing again. An organiser adds competitions and
-- alerts; a member reads them. Without that distinction the only way to let
-- somebody help run the club is to make them an administrator of the whole
-- site, which is far too much.

alter table public.club_memberships
  add column if not exists club_role text not null default 'member';

do $$
begin
  alter table public.club_memberships
    add constraint club_memberships_role_check check (club_role in ('member', 'organiser'));
exception when duplicate_object then null;
end $$;

create or replace function public.in_club(slug text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_memberships m join public.clubs c on c.id = m.club_id
    where c.slug = in_club.slug and m.profile_id = auth.uid()
  );
$$;

create or replace function public.runs_club(slug text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.club_memberships m join public.clubs c on c.id = m.club_id
    where c.slug = runs_club.slug and m.profile_id = auth.uid() and m.club_role = 'organiser'
  );
$$;

revoke all on function public.in_club(text), public.runs_club(text) from public, anon;
grant execute on function public.in_club(text), public.runs_club(text) to authenticated;

-- Reading is for club members; writing is for organisers.
create policy "club members read roster" on public.club_members
  for select to authenticated using (public.in_club('speedcube'));
create policy "organisers write roster" on public.club_members
  for all to authenticated using (public.runs_club('speedcube')) with check (public.runs_club('speedcube'));

create policy "club members read results" on public.club_results
  for select to authenticated using (public.in_club('speedcube'));
create policy "organisers write results" on public.club_results
  for all to authenticated using (public.runs_club('speedcube')) with check (public.runs_club('speedcube'));

create policy "club members read events" on public.club_events
  for select to authenticated using (public.in_club('speedcube'));
create policy "organisers write events" on public.club_events
  for all to authenticated using (public.runs_club('speedcube')) with check (public.runs_club('speedcube'));

create policy "club members read alerts" on public.club_alerts
  for select to authenticated using (public.in_club('speedcube'));
create policy "organisers write alerts" on public.club_alerts
  for all to authenticated using (public.runs_club('speedcube')) with check (public.runs_club('speedcube'));

create policy "club members read contact" on public.club_contact
  for select to authenticated using (public.in_club('speedcube'));
create policy "organisers write contact" on public.club_contact
  for all to authenticated using (public.runs_club('speedcube')) with check (public.runs_club('speedcube'));

create policy "club members see who is coming" on public.club_attendance
  for select to authenticated using (public.in_club('speedcube'));
create policy "answer for your own" on public.club_attendance
  for all to authenticated
  using (public.runs_club('speedcube')
    or exists (select 1 from public.club_members m
               where m.id = club_attendance.member_id and m.profile_id = auth.uid()))
  with check (public.runs_club('speedcube')
    or exists (select 1 from public.club_members m
               where m.id = club_attendance.member_id and m.profile_id = auth.uid()));

-- The administrator is put in the club as its organiser, or he locks himself
-- out of the thing he has just secured.
insert into public.club_memberships (club_id, profile_id, club_role)
select c.id, p.id, 'organiser'
from public.clubs c, public.profiles p
where c.slug = 'speedcube' and p.role = 'admin'
on conflict (club_id, profile_id) do update set club_role = 'organiser';
