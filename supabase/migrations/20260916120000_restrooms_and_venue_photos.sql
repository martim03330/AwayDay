-- 1. Real restrooms near stadiums, from OpenStreetMap (amenity=toilets), imported with scripts/importar-wc-osm.mjs.
--    Only what OSM says: free or paid, wheelchair access, who may use it, opening hours. Unknown stays unknown.
--    Private toilets are left out. Public reference data, read-only.
-- 2. Stadium photos from Wikimedia Commons, with author, licence and link (required by CC licences), copied to the
--    public `venue-photos` bucket with scripts/fotos-estadios.mjs so the app does not hotlink Wikimedia.

create table public.restroom (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  venue_id text not null references public.venue (id) on delete cascade,
  osm_id text not null unique check (osm_id ~ '^(node|way)/[0-9]+$'),
  name text check (char_length(name) <= 120),
  location extensions.geography(point, 4326) not null,
  latitude double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  longitude double precision generated always as (extensions.st_x(location::extensions.geometry)) stored,
  distance_m integer not null check (distance_m >= 0),
  walking_minutes smallint not null check (walking_minutes between 0 and 120),
  fee text not null default 'unknown' check (fee in ('yes', 'no', 'unknown')),
  wheelchair text not null default 'unknown' check (wheelchair in ('yes', 'limited', 'no', 'unknown')),
  -- 'customers': only for customers of the place it belongs to.
  access text not null default 'unknown' check (access in ('public', 'customers', 'unknown')),
  opening_hours text check (char_length(opening_hours) <= 200),
  attribution text not null default '© contribuidores do OpenStreetMap',
  imported_at timestamptz not null default now()
);

create index restroom_venue_id_idx on public.restroom (venue_id);
create index restroom_location_idx on public.restroom using gist (location);

alter table public.restroom enable row level security;

create policy "restrooms are readable by everyone"
  on public.restroom for select to anon, authenticated using (true);

revoke all on public.restroom from anon, authenticated;
grant select on public.restroom to anon, authenticated;

alter table public.venue
  add column photo_url text check (photo_url ~ '^https://'),
  add column photo_author text check (char_length(photo_author) <= 200),
  add column photo_license text check (char_length(photo_license) <= 60),
  add column photo_source_url text check (photo_source_url ~ '^https://'),
  add constraint venue_photo_credited check (
    (photo_url is null) = (photo_license is null)
    and (photo_url is null) = (photo_source_url is null)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('venue-photos', 'venue-photos', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;
