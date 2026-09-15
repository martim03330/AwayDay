-- 1. Meeting points get the coordinates of the gathering spot, so the app can show it on a map and walk the fan there.
-- 2. Safety notes for visiting fans in the big derbies (Benfica, FC Porto and Sporting against each other):
--    - 'indicacao_oficial': how the police usually organised visiting fans (where they gather, escort, entrance);
--    - 'zona_a_evitar': areas near the stadium with repeated or serious incidents, from reputable press.
--    Only areas (streets, squares, stations), never named businesses or people. Always with sources and dates.
--    Public reference data, read-only, entered by hand.

alter table public.fixture_meeting_point
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add constraint fixture_meeting_point_coordinates_together check ((latitude is null) = (longitude is null));

create table public.venue_safety_note (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  venue_id text not null references public.venue (id) on delete cascade,
  -- The visiting club the note is about; null when it applies to any visitor in a derby.
  visiting_club_id text references public.club (id) on delete cascade,
  kind text not null check (kind in ('indicacao_oficial', 'zona_a_evitar')),
  title text not null check (char_length(title) between 2 and 120),
  description text not null check (char_length(description) between 2 and 600),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  radius_m integer check (radius_m between 50 and 2000),
  -- When it happened (zones) or when the arrangement was used (official notes).
  reference_date date not null,
  -- [{"title": "Público", "url": "https://...", "date": "2025-06-10"}]
  sources jsonb not null check (jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_safety_note_coordinates_together check ((latitude is null) = (longitude is null)),
  constraint venue_safety_note_zone_has_area check (
    kind <> 'zona_a_evitar' or (latitude is not null and radius_m is not null)
  )
);

create index venue_safety_note_venue_id_idx on public.venue_safety_note (venue_id);
create index venue_safety_note_visiting_club_id_idx on public.venue_safety_note (visiting_club_id);

create trigger venue_safety_note_set_updated_at
  before update on public.venue_safety_note
  for each row execute function public.set_updated_at();

alter table public.venue_safety_note enable row level security;

create policy "venue safety notes are readable by everyone"
  on public.venue_safety_note for select to anon, authenticated using (true);

revoke all on public.venue_safety_note from anon, authenticated;
grant select on public.venue_safety_note to anon, authenticated;
