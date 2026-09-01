-- Meet-ups, alerts, and dropping a table that confused everybody.
--
-- club_pages let an administrator edit the club's Welcome and Rules text as raw
-- HTML. In practice it was a box of markup with no explanation of what belonged
-- in it, and it held nothing. Words that change once a year belong in the page,
-- not in a database, so it goes.
drop table if exists public.club_pages;

-- A meet-up and a competition are the same shape -- a thing with a date -- so
-- they share a table and differ by one column. All the work already done on
-- ordering, "in 5 days" and what is next applies to both for free.
alter table public.club_events
  add column if not exists kind text not null default 'competition';

do $$
begin
  alter table public.club_events
    add constraint club_events_kind_check check (kind in ('competition', 'meetup'));
exception when duplicate_object then null;
end $$;

comment on column public.club_events.kind is
  'competition = a World Cube Association event; meetup = the club getting together.';

-- Something to say at the top of the club page: a practice cancelled, a lift
-- offered, a deadline coming up.
create table if not exists public.club_alerts (
  id         uuid primary key default gen_random_uuid(),
  message    text not null,
  level      text not null default 'info' check (level in ('info', 'warning')),
  starts_on  date,                       -- null means "already showing"
  ends_on    date,                       -- null means "until it is deleted"
  created_at timestamptz not null default now()
);

comment on table public.club_alerts is
  'Short notices for the top of the club page. Dated so they retire themselves.';

alter table public.club_alerts enable row level security;

drop policy if exists "members read alerts" on public.club_alerts;
create policy "members read alerts" on public.club_alerts
  for select to authenticated using (true);

drop policy if exists "admin writes alerts" on public.club_alerts;
create policy "admin writes alerts" on public.club_alerts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.club_alerts from anon;
