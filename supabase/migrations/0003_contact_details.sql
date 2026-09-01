-- A named person's email and phone number cannot live in the page markup.
--
-- When the club page moved off the encrypted file, the contact card went into
-- index.html inside a div marked `hidden`. That hides it from the eye and from
-- nobody else: the words are in the file the server sends, so View Source reads
-- them without signing in. The encrypted version genuinely did not ship them,
-- so this was a step backwards on the one piece of data here where a leak would
-- actually matter.
create table if not exists public.club_contact (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text,
  email      text,
  phone      text,
  note       text,
  sort_order integer not null default 0
);

comment on table public.club_contact is
  'Who to ask, and how. Never put these in page markup: hidden is not private.';

alter table public.club_contact enable row level security;

drop policy if exists "members read contact" on public.club_contact;
create policy "members read contact" on public.club_contact
  for select to authenticated using (true);

drop policy if exists "admin writes contact" on public.club_contact;
create policy "admin writes contact" on public.club_contact
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.club_contact from anon;
