-- Season recap: one summary per user per season, written in June. Every number is computed here, in SQL;
-- the Edge Function only turns the numbers into sentences.

create table public.season_recap (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profile (id) on delete cascade,
  season_id text not null references public.season (id) on delete cascade,
  stats jsonb not null,
  headline text not null check (char_length(headline) between 1 and 80),
  body text not null check (char_length(body) between 1 and 600),
  source text not null check (source in ('template', 'model')),
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  push_status text not null default 'pending' check (push_status in ('pending', 'sent', 'no_device', 'failed')),
  created_at timestamptz not null default now(),
  shared_at timestamptz,
  constraint season_recap_once_per_season unique (profile_id, season_id)
);

create index season_recap_season_id_idx on public.season_recap (season_id);

alter table public.season_recap enable row level security;

create policy "users read their own season recaps"
  on public.season_recap for select to authenticated
  using ((select auth.uid()) = profile_id);
create policy "users mark their own season recaps as shared"
  on public.season_recap for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

revoke all on public.season_recap from anon, authenticated;
grant select on public.season_recap to authenticated;
grant update (shared_at) on public.season_recap to authenticated;

-- The season's numbers for one user. `null` if the season does not exist. Service role only.
create function public.season_recap_stats(p_profile_id uuid, p_season_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with season as (
    select
      s.id,
      (s.starts_on::timestamp at time zone 'Europe/Lisbon') as starts_at,
      ((s.ends_on + 1)::timestamp at time zone 'Europe/Lisbon') as ends_at
    from public.season as s
    where s.id = p_season_id
  ),
  attended as (
    select f.id, f.kickoff_at, f.venue_id
    from public.fixture_attendance as fa
    join public.fixture as f on f.id = fa.fixture_id
    cross join season
    where fa.profile_id = p_profile_id
      and fa.status = 'attended'
      and f.kickoff_at >= season.starts_at
      and f.kickoff_at < season.ends_at
  ),
  -- A stadium is new this season if the user's first ever match there was in this season.
  new_venues as (
    select v.id, coalesce(v.short_name, v.name) as name,
      case when v.short_name is null then v.name_article else v.short_name_article end as article,
      first_visit.kickoff_at
    from (
      select f.venue_id, min(f.kickoff_at) as kickoff_at
      from public.fixture_attendance as fa
      join public.fixture as f on f.id = fa.fixture_id
      where fa.profile_id = p_profile_id and fa.status = 'attended'
      group by f.venue_id
    ) as first_visit
    join public.venue as v on v.id = first_visit.venue_id
    cross join season
    where first_visit.kickoff_at >= season.starts_at and first_visit.kickoff_at < season.ends_at
  ),
  home_base as (
    select v.location
    from public.profile_club as pc
    join public.club as c on c.id = pc.club_id
    join public.venue as v on v.id = c.home_venue_id
    where pc.profile_id = p_profile_id and pc.relation = 'hometown' and v.location is not null
  ),
  visits as (
    select pv.place_id, pv.visited_at
    from public.place_visit as pv
    cross join season
    where pv.profile_id = p_profile_id
      and pv.visited_at >= season.starts_at
      and pv.visited_at < season.ends_at
  ),
  -- "Where you went back the most" only makes sense with at least two visits.
  top_place as (
    select p.name, p.name_article, count(*)::integer as visits
    from visits as vi
    join public.place as p on p.id = vi.place_id
    group by p.id, p.name, p.name_article
    having count(*) >= 2
    order by count(*) desc, max(vi.visited_at) desc
    limit 1
  ),
  scores as (
    select
      round(avg((r.stadium_score + r.atmosphere_score + r.access_score) / 3.0), 1) as average,
      count(*)::integer as reviews
    from public.venue_review as r
    join attended as a on a.id = r.fixture_id
    where r.profile_id = p_profile_id
  ),
  top_district as (
    select v.district, count(*)::integer as games
    from attended as a
    join public.venue as v on v.id = a.venue_id
    where v.district is not null
    group by v.district
    order by count(*) desc, max(a.kickoff_at) desc
    limit 1
  )
  select case when not exists (select 1 from season) then null else jsonb_build_object(
    'season_id', p_season_id,
    'games', (select count(*)::integer from attended),
    'stadiums', (select count(distinct venue_id)::integer from attended),
    'new_venues', (select count(*)::integer from new_venues),
    'new_venue_names', coalesce(
      (select jsonb_agg(jsonb_build_object('name', name, 'article', article) order by kickoff_at) from new_venues),
      '[]'::jsonb
    ),
    -- Round trips in a straight line from the hometown club's stadium; null without a hometown club.
    'km', (
      select round(sum(2 * extensions.st_distance(hb.location, v.location)) / 1000)::integer
      from attended as a
      join public.venue as v on v.id = a.venue_id
      cross join home_base as hb
      where v.location is not null
    ),
    'places', (select count(distinct place_id)::integer from visits),
    'place_visits', (select count(*)::integer from visits),
    'top_place', (select jsonb_build_object('name', name, 'article', name_article, 'visits', visits) from top_place),
    'average_score', (select average from scores),
    'reviews', (select reviews from scores),
    'top_district', (select jsonb_build_object('name', district, 'games', games) from top_district)
  ) end;
$$;

-- Who gets a recap for a season: wants it, does not have it yet, and did something that season.
create function public.season_recap_candidates(p_season_id text)
returns table (profile_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with season as (
    select
      (s.starts_on::timestamp at time zone 'Europe/Lisbon') as starts_at,
      ((s.ends_on + 1)::timestamp at time zone 'Europe/Lisbon') as ends_at
    from public.season as s
    where s.id = p_season_id
  )
  select p.id
  from public.profile as p
  cross join season
  where p.recap_enabled
    and not exists (
      select 1 from public.season_recap as r where r.profile_id = p.id and r.season_id = p_season_id
    )
    and (
      exists (
        select 1
        from public.fixture_attendance as fa
        join public.fixture as f on f.id = fa.fixture_id
        where fa.profile_id = p.id
          and fa.status = 'attended'
          and f.kickoff_at >= season.starts_at
          and f.kickoff_at < season.ends_at
      )
      or exists (
        select 1 from public.place_visit as pv
        where pv.profile_id = p.id and pv.visited_at >= season.starts_at and pv.visited_at < season.ends_at
      )
    );
$$;

revoke execute on function public.season_recap_stats(uuid, text) from public, anon, authenticated;
revoke execute on function public.season_recap_candidates(text) from public, anon, authenticated;
grant execute on function public.season_recap_stats(uuid, text) to service_role;
grant execute on function public.season_recap_candidates(text) to service_role;
