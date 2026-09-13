-- Fixtures catalogue: competitions, venues, clubs and fixtures.
-- Public reference data: anyone can read it, nobody can write it from a client.
-- Ids are stable text slugs (e.g. 'luz', 'benfica-moreirense') used by the app's routes and by the
-- data that still lives in mocks. external_id is reserved for the fixtures sync.

create extension if not exists postgis with schema extensions;

create table public.competition (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  kind text not null check (kind in ('league', 'cup', 'european')),
  tier smallint check (tier between 1 and 3),
  created_at timestamptz not null default now()
);

create table public.venue (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  city text not null,
  country text not null,
  region text not null check (region in ('mainland', 'madeira', 'azores', 'abroad')),
  capacity integer check (capacity > 0),
  location extensions.geography(point, 4326),
  latitude double precision
    generated always as (extensions.st_y(location::extensions.geometry)) stored,
  longitude double precision
    generated always as (extensions.st_x(location::extensions.geometry)) stored,
  roof_coverage text check (roof_coverage in ('total', 'parcial', 'nenhuma')),
  address text,
  created_at timestamptz not null default now()
);

create table public.club (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  short_name text not null,
  abbreviation text not null check (char_length(abbreviation) between 1 and 3),
  country text not null,
  primary_color text not null check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  tier smallint check (tier between 1 and 3),
  home_venue_id text references public.venue (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.fixture (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  external_id text unique,
  competition_id text not null references public.competition (id),
  stage text not null,
  home_club_id text not null references public.club (id),
  away_club_id text not null references public.club (id),
  venue_id text not null references public.venue (id),
  kickoff_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint fixture_distinct_clubs check (home_club_id <> away_club_id)
);

create index fixture_kickoff_at_idx on public.fixture (kickoff_at);
create index fixture_venue_id_idx on public.fixture (venue_id);
create index fixture_competition_id_idx on public.fixture (competition_id);
create index fixture_home_club_id_idx on public.fixture (home_club_id);
create index fixture_away_club_id_idx on public.fixture (away_club_id);
create index club_home_venue_id_idx on public.club (home_venue_id);
create index venue_location_idx on public.venue using gist (location);

-- Row level security: read-only for everyone. With no insert/update/delete policies, writes are denied.
alter table public.competition enable row level security;
alter table public.venue enable row level security;
alter table public.club enable row level security;
alter table public.fixture enable row level security;

create policy "competition is readable by everyone"
  on public.competition for select to anon, authenticated using (true);
create policy "venue is readable by everyone"
  on public.venue for select to anon, authenticated using (true);
create policy "club is readable by everyone"
  on public.club for select to anon, authenticated using (true);
create policy "fixture is readable by everyone"
  on public.fixture for select to anon, authenticated using (true);

-- Defence in depth: clients only ever need to read these tables.
revoke insert, update, delete, truncate, references, trigger
  on public.competition, public.venue, public.club, public.fixture
  from anon, authenticated;
grant select on public.competition, public.venue, public.club, public.fixture to anon, authenticated;
