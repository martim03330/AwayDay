-- As ruas onde costumam estar os adeptos da casa.
--
-- Until now the app only knew where home fans were *during* one game: fans flagged a cell, three of them agreed, and
-- the flags were deleted 48 h later. Nothing ever became "costuma ser aqui".
--
-- This keeps a count per stadium, across games, and turns it into streets:
-- - `venue_street`: the named streets around each stadium, from OpenStreetMap, with their real shape;
-- - `home_fan_cell`: how many games and how many different people flagged each ~150 m cell of a stadium. Only
--   counts: who flagged what is never kept, and the raw reports are still deleted as before;
-- - `home_fan_usual_streets()`: the cells snapped to the nearest street, published only from 5 different people and
--   2 different games up — the same rule as every other aggregate in the app.

create table public.venue_street (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references public.venue (id) on delete cascade,
  osm_id text not null check (osm_id ~ '^way/[0-9]+$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  path extensions.geography(linestring, 4326) not null,
  created_at timestamptz not null default now(),
  unique (venue_id, osm_id)
);

create index venue_street_venue_idx on public.venue_street (venue_id);
create index venue_street_path_idx on public.venue_street using gist (path);

create table public.home_fan_cell (
  venue_id text not null references public.venue (id) on delete cascade,
  -- The same ~150 m grid the reports use (0.0015°): a cell, never a person.
  cell_latitude numeric(8, 4) not null,
  cell_longitude numeric(8, 4) not null,
  fixtures integer not null default 0 check (fixtures >= 0),
  reporters integer not null default 0 check (reporters >= 0),
  last_seen_at timestamptz not null default now(),
  primary key (venue_id, cell_latitude, cell_longitude)
);

-- Which games have already been counted, so a game is never counted twice.
create table public.home_fan_rollup (
  fixture_id text primary key references public.fixture (id) on delete cascade,
  done_at timestamptz not null default now()
);

alter table public.venue_street enable row level security;
alter table public.home_fan_cell enable row level security;
alter table public.home_fan_rollup enable row level security;

create policy "streets are readable by everyone"
  on public.venue_street for select to anon, authenticated using (true);

revoke all on public.venue_street from anon, authenticated;
revoke all on public.home_fan_cell from anon, authenticated;
revoke all on public.home_fan_rollup from anon, authenticated;
grant select on public.venue_street to anon, authenticated;

-- 1. Counting a finished game into the stadium's tally. Runs a few hours after kick-off, before the reports are
-- deleted; a cell only counts for a game when at least 3 different people flagged it, as on the day.
create function public.roll_up_home_fan_reports()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  counted integer := 0;
  game record;
begin
  for game in
    select f.id, f.venue_id
    from public.fixture as f
    where f.kickoff_at < now() - interval '6 hours'
      and f.kickoff_at > now() - interval '30 days'
      and not exists (select 1 from public.home_fan_rollup as r where r.fixture_id = f.id)
      and exists (select 1 from public.home_fan_report as hr where hr.fixture_id = f.id)
  loop
    insert into public.home_fan_cell as c (venue_id, cell_latitude, cell_longitude, fixtures, reporters, last_seen_at)
    select game.venue_id, hr.cell_latitude, hr.cell_longitude, 1, count(distinct hr.reporter_id)::integer, now()
    from public.home_fan_report as hr
    where hr.fixture_id = game.id
    group by hr.cell_latitude, hr.cell_longitude
    having count(distinct hr.reporter_id) >= 3
    on conflict (venue_id, cell_latitude, cell_longitude) do update
      set fixtures = c.fixtures + 1,
          reporters = c.reporters + excluded.reporters,
          last_seen_at = now();

    insert into public.home_fan_rollup (fixture_id) values (game.id);
    counted := counted + 1;
  end loop;
  return counted;
end;
$$;

-- Hourly, and always before the reports themselves are deleted (that job runs at :41).
select cron.schedule('roll-up-home-fan-reports', '11 * * * *', $$ select public.roll_up_home_fan_reports(); $$);

-- 2. The streets where home fans usually are: the tallied cells snapped to the nearest street within 120 m.
-- Published only from 5 different people and 2 different games up, like every aggregate in the app.
create function public.home_fan_usual_streets(p_venue_id text)
returns table (name text, fixtures integer, path json)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.name,
    max(c.fixtures)::integer,
    extensions.st_asgeojson(s.path::extensions.geometry)::json
  from public.home_fan_cell as c
  cross join lateral (
    select st.name, st.path
    from public.venue_street as st
    where st.venue_id = c.venue_id
      and extensions.st_dwithin(
        st.path,
        extensions.st_setsrid(
          extensions.st_makepoint(c.cell_longitude::double precision, c.cell_latitude::double precision), 4326
        )::extensions.geography,
        120
      )
    order by extensions.st_distance(
      st.path,
      extensions.st_setsrid(
        extensions.st_makepoint(c.cell_longitude::double precision, c.cell_latitude::double precision), 4326
      )::extensions.geography
    )
    limit 1
  ) as s
  where c.venue_id = p_venue_id
  group by s.name, s.path
  having sum(c.reporters) >= 5 and sum(c.fixtures) >= 2
  order by max(c.fixtures) desc, s.name;
$$;

revoke execute on function public.home_fan_usual_streets(text) from public;
revoke execute on function public.roll_up_home_fan_reports() from public, anon, authenticated;
grant execute on function public.home_fan_usual_streets(text) to anon, authenticated;
