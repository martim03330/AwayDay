-- Latitude and longitude of each place as plain columns, generated from `location`, like on `venue`: the app reads
-- them with the same public RLS for the map and walking distances.
alter table public.place
  add column latitude double precision
    generated always as (extensions.st_y(location::extensions.geometry)) stored,
  add column longitude double precision
    generated always as (extensions.st_x(location::extensions.geometry)) stored;
