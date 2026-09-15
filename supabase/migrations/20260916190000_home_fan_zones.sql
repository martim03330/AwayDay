-- Home fans, for visiting fans' safety at every stadium (not only derbies).
--
-- 1. Researched notes (police, clubs, press, ground guides; always sourced) gain two kinds:
--    - zona_adeptos_casa: stands, gates or areas home supporters hold, or where visiting colours are refused, with a
--      map area only when one is known precisely;
--    - percurso_visitantes: the official route or entrance for visiting fans.
-- 2. Fans on the spot can flag "many home fans here" on the map. To protect people rather than expose them:
--    - only home fans can be flagged (flagging where visiting fans are would help find and attack them);
--    - the flag is a ~150 m cell (coordinates rounded), never a person's position, and reporters are never shown;
--    - a cell only appears with at least 3 different people, and only from 6 h before kick-off to 6 h after;
--    - flags are deleted 48 h after kick-off.

alter table public.venue_safety_note
  drop constraint venue_safety_note_kind_check,
  add constraint venue_safety_note_kind_check
    check (kind in ('indicacao_oficial', 'zona_a_evitar', 'zona_adeptos_casa', 'percurso_visitantes'));

create table public.home_fan_report (
  fixture_id text not null references public.fixture (id) on delete cascade,
  reporter_id uuid not null references public.profile (id) on delete cascade,
  -- Rounded to a ~150 m grid (0.0015°): the cell, not where the reporter stood.
  cell_latitude numeric(8, 4) not null,
  cell_longitude numeric(8, 4) not null,
  created_at timestamptz not null default now(),
  primary key (fixture_id, reporter_id, cell_latitude, cell_longitude)
);

create index home_fan_report_fixture_idx on public.home_fan_report (fixture_id, cell_latitude, cell_longitude);

alter table public.home_fan_report enable row level security;
revoke all on public.home_fan_report from anon, authenticated;

create function public.report_home_fans(p_fixture_id text, p_latitude double precision, p_longitude double precision)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  game public.fixture;
  venue_point extensions.geography;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select * into game from public.fixture where id = p_fixture_id;
  if game.id is null then
    raise exception 'fixture_not_found' using errcode = 'P0002';
  end if;
  if now() < game.kickoff_at - interval '6 hours' or now() > game.kickoff_at + interval '3 hours' then
    raise exception 'outside_window' using errcode = '22023';
  end if;
  select v.location into venue_point from public.venue as v where v.id = game.venue_id;
  -- Only around this game's stadium (3 km).
  if venue_point is null or extensions.st_distance(
    venue_point,
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography
  ) > 3000 then
    raise exception 'too_far' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'home-fan-report', 10, interval '1 hour') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  insert into public.home_fan_report (fixture_id, reporter_id, cell_latitude, cell_longitude)
  values (
    p_fixture_id,
    caller,
    round((p_latitude / 0.0015)::numeric) * 0.0015,
    round((p_longitude / 0.0015)::numeric) * 0.0015
  )
  on conflict do nothing;
end;
$$;

-- Cells flagged by at least 3 different people, around kick-off. No reporter is ever returned.
create function public.home_fan_zones(p_fixture_id text)
returns table (latitude double precision, longitude double precision, reporters integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.cell_latitude::double precision, r.cell_longitude::double precision, count(distinct r.reporter_id)::integer
  from public.home_fan_report as r
  join public.fixture as f on f.id = r.fixture_id
  where r.fixture_id = p_fixture_id
    and now() between f.kickoff_at - interval '6 hours' and f.kickoff_at + interval '6 hours'
  group by r.cell_latitude, r.cell_longitude
  having count(distinct r.reporter_id) >= 3;
$$;

create function public.delete_old_home_fan_reports()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.home_fan_report as r
    using public.fixture as f
    where f.id = r.fixture_id and f.kickoff_at < now() - interval '48 hours'
    returning 1
  )
  select count(*)::integer from gone;
$$;

select cron.schedule('delete-old-home-fan-reports', '41 * * * *', $$ select public.delete_old_home_fan_reports(); $$);

revoke execute on function public.report_home_fans(text, double precision, double precision) from public, anon;
revoke execute on function public.home_fan_zones(text) from public;
revoke execute on function public.delete_old_home_fan_reports() from public, anon, authenticated;
grant execute on function public.report_home_fans(text, double precision, double precision) to authenticated;
grant execute on function public.home_fan_zones(text) to anon, authenticated;
