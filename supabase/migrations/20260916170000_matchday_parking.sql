-- Where to leave the car on match day, per stadium. Researched on the web (clubs, councils, police, operators,
-- newspapers) and always shown with the pages that say so; nothing without a source. No free source publishes how
-- full car parks are (checked 2026-09-16), so this is what is known, not live occupancy.
--
-- - parking_spot: car parks and areas fans use, with whether they open on match days, price notes and a location when
--   one could be found precisely (a building or the car park itself, never just a street).
-- - venue_parking: a short summary per stadium and match-day warnings (closures, towing, advice to take the metro).

create table public.parking_spot (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references public.venue (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  kind text not null check (kind in ('parque_oficial', 'parque_publico', 'parque_gratuito', 'rua', 'park_and_ride')),
  address text check (char_length(address) <= 200),
  operator text check (char_length(operator) <= 80),
  location extensions.geography(point, 4326),
  latitude double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  longitude double precision generated always as (extensions.st_x(location::extensions.geometry)) stored,
  distance_m integer check (distance_m >= 0),
  -- true / false when a source says so; null when unknown.
  open_on_matchdays boolean,
  price_note text check (char_length(price_note) <= 240),
  note text check (char_length(note) <= 280),
  sources jsonb not null check (jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) > 0),
  confidence text not null check (confidence in ('high', 'medium')),
  checked_on date not null,
  created_at timestamptz not null default now(),
  unique (venue_id, name)
);

create index parking_spot_venue_id_idx on public.parking_spot (venue_id);

create table public.venue_parking (
  venue_id text primary key references public.venue (id) on delete cascade,
  summary text check (char_length(summary) <= 400),
  summary_sources jsonb not null default '[]'::jsonb check (jsonb_typeof(summary_sources) = 'array'),
  -- [{ text, sources: [{ url, title, published }] }]
  warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'),
  checked_on date not null,
  constraint venue_parking_summary_has_sources
    check (summary is null or jsonb_array_length(summary_sources) > 0)
);

alter table public.parking_spot enable row level security;
alter table public.venue_parking enable row level security;

create policy "parking spots are readable by everyone"
  on public.parking_spot for select to anon, authenticated using (true);
create policy "stadium parking notes are readable by everyone"
  on public.venue_parking for select to anon, authenticated using (true);

revoke all on public.parking_spot from anon, authenticated;
revoke all on public.venue_parking from anon, authenticated;
grant select on public.parking_spot to anon, authenticated;
grant select on public.venue_parking to anon, authenticated;
