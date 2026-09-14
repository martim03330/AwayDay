-- Seasons, so fixtures can be grouped by season (e.g. '2025-26'). Public reference data, read-only.

create table public.season (
  id text primary key check (id ~ '^[0-9]{4}-[0-9]{2}$'),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  constraint season_dates_in_order check (starts_on < ends_on)
);

alter table public.fixture add column season_id text references public.season (id);

create index fixture_season_id_idx on public.fixture (season_id);

alter table public.season enable row level security;

create policy "season is readable by everyone"
  on public.season for select to anon, authenticated using (true);

revoke insert, update, delete, truncate, references, trigger on public.season from anon, authenticated;
grant select on public.season to anon, authenticated;
