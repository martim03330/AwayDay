-- More car parks to choose from, including ones further from the stadium: besides the researched car parks (which
-- carry match-day notes and the pages that say so), public car parks from OpenStreetMap near each stadium.
--
-- These carry no match-day information, so they are always marked as coming from OpenStreetMap and the app only
-- *estimates* how easy parking is there (distance, size, known closures). Nobody publishes live occupancy for free
-- (checked 2026-09-16), and the app never pretends otherwise.

alter table public.parking_spot
  add column source text not null default 'pesquisa' check (source in ('pesquisa', 'osm')),
  add column osm_id text check (osm_id ~ '^(node|way|relation)/[0-9]+$'),
  -- Spaces, when OpenStreetMap says so: a big car park far out is usually easier than a small one at the gate.
  add column capacity integer check (capacity > 0);

alter table public.parking_spot
  drop constraint parking_spot_confidence_check,
  add constraint parking_spot_confidence_check check (confidence in ('high', 'medium', 'osm'));

-- Re-running the import replaces the OpenStreetMap rows for a stadium without touching the researched ones.
create unique index parking_spot_venue_osm_idx on public.parking_spot (venue_id, osm_id) where osm_id is not null;
create index parking_spot_venue_source_idx on public.parking_spot (venue_id, source);
