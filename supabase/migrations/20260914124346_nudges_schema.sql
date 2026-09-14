-- Match-day suggestions (nudges). Every fact is computed here, in SQL; the Edge Function only turns the
-- facts into a sentence (from templates, or from the model when an API key and budget are set).

create table public.nudge (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profile (id) on delete cascade,
  kind text not null check (
    kind in ('tasco_primeira_visita', 'marco_passaporte', 'estadio_novo_em_casa', 'clube_perto_de_ti')
  ),
  fixture_id text references public.fixture (id) on delete set null,
  -- Calendar day in Lisbon: at most one nudge per user per day, guaranteed by the unique constraint.
  local_date date not null,
  facts jsonb not null,
  body text not null check (char_length(body) between 1 and 140),
  source text not null check (source in ('template', 'model')),
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  push_status text not null default 'pending' check (push_status in ('pending', 'sent', 'no_device', 'failed')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint nudge_one_per_day unique (profile_id, local_date)
);

-- Never the same suggestion twice for the same fixture.
create unique index nudge_once_per_fixture on public.nudge (profile_id, kind, fixture_id)
  where fixture_id is not null;
create index nudge_profile_created_idx on public.nudge (profile_id, created_at desc);
create index nudge_fixture_id_idx on public.nudge (fixture_id);

-- One row per job run: counts and tokens only, no personal data. Server only.
create table public.ai_run (
  id bigint generated always as identity primary key,
  job text not null check (job in ('nudges', 'season_recap')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  candidates integer not null default 0,
  created integer not null default 0,
  from_model integer not null default 0,
  from_template integer not null default 0,
  pushed integer not null default 0,
  errors integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0
);

alter table public.nudge enable row level security;
alter table public.ai_run enable row level security;

create policy "users read their own nudges"
  on public.nudge for select to authenticated
  using ((select auth.uid()) = profile_id);
create policy "users mark their own nudges as read"
  on public.nudge for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);
-- No insert or delete policies: only the Edge Function (service role) writes nudges.
-- ai_run has no policies at all: clients cannot touch it.

revoke all on public.nudge, public.ai_run from anon, authenticated;
grant select on public.nudge to authenticated;
grant update (read_at) on public.nudge to authenticated;

-- Today's best suggestion for each user who wants them: at most one row per user, most useful first.
-- Only the service role can run it (it reads every user's activity to pick candidates).
create function public.nudge_candidates(p_now timestamptz default now())
returns table (profile_id uuid, kind text, fixture_id text, facts jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select p_now as now_at, (p_now at time zone 'Europe/Lisbon')::date as today
  ),
  eligible as (
    select p.id as profile_id
    from public.profile as p
    cross join params
    where p.nudges_enabled
      and not exists (
        select 1 from public.nudge as n where n.profile_id = p.id and n.local_date = params.today
      )
  ),
  attended_venues as (
    select fa.profile_id, f.venue_id, min(f.kickoff_at) as first_kickoff
    from public.fixture_attendance as fa
    join public.fixture as f on f.id = fa.fixture_id
    where fa.status = 'attended'
    group by fa.profile_id, f.venue_id
  ),
  -- Where the user comes from: the stadium of their hometown club (private to them).
  home_base as (
    select pc.profile_id, v.location
    from public.profile_club as pc
    join public.club as c on c.id = pc.club_id
    join public.venue as v on v.id = c.home_venue_id
    where pc.relation = 'hometown' and v.location is not null
  ),
  venue_facts as (
    select
      v.id,
      v.location,
      jsonb_build_object(
        'name', v.name, 'article', v.name_article,
        'short_name', v.short_name, 'short_article', v.short_name_article
      ) as facts
    from public.venue as v
  ),
  club_facts as (
    select c.id, jsonb_build_object('name', c.short_name, 'article', c.name_article) as facts
    from public.club as c
  ),
  -- 1. Going to a stadium for the first time in the next 3 days: the nearest place on foot.
  first_visit_place as (
    select distinct on (fa.profile_id)
      fa.profile_id, 1 as priority, 'tasco_primeira_visita'::text as kind, f.id as fixture_id,
      jsonb_build_object(
        'venue', vf.facts,
        'kickoff_at', f.kickoff_at,
        'place', jsonb_build_object('name', pl.name, 'article', pl.name_article, 'walking_minutes', pl.walking_minutes)
      ) as facts
    from public.fixture_attendance as fa
    join eligible as e on e.profile_id = fa.profile_id
    join public.fixture as f on f.id = fa.fixture_id
    join venue_facts as vf on vf.id = f.venue_id
    join lateral (
      select p2.name, p2.name_article, p2.walking_minutes
      from public.place as p2
      where p2.venue_id = f.venue_id and p2.walking_minutes <= 10
      order by p2.walking_minutes, p2.id
      limit 1
    ) as pl on true
    cross join params
    where fa.status = 'going'
      and f.kickoff_at > params.now_at
      and f.kickoff_at <= params.now_at + interval '3 days'
      and not exists (
        select 1 from attended_venues as av where av.profile_id = fa.profile_id and av.venue_id = f.venue_id
      )
      and not exists (
        select 1 from public.nudge as n
        where n.profile_id = fa.profile_id and n.kind = 'tasco_primeira_visita' and n.fixture_id = f.id
      )
    order by fa.profile_id, f.kickoff_at
  ),
  -- 2. A new stadium, marked in the last 24 hours, that made a round number of different stadiums.
  milestone as (
    select distinct on (fa.profile_id)
      fa.profile_id, 2 as priority, 'marco_passaporte'::text as kind, f.id as fixture_id,
      jsonb_build_object('venue', vf.facts, 'count', totals.venues) as facts
    from public.fixture_attendance as fa
    join eligible as e on e.profile_id = fa.profile_id
    join public.fixture as f on f.id = fa.fixture_id
    join venue_facts as vf on vf.id = f.venue_id
    join attended_venues as av
      on av.profile_id = fa.profile_id and av.venue_id = f.venue_id and av.first_kickoff = f.kickoff_at
    cross join lateral (
      select count(*)::integer as venues
      from attended_venues as av2
      where av2.profile_id = fa.profile_id and av2.first_kickoff <= f.kickoff_at
    ) as totals
    cross join params
    where fa.status = 'attended'
      and fa.updated_at >= params.now_at - interval '24 hours'
      and totals.venues in (3, 5, 10, 15, 20, 25, 30)
      and not exists (
        select 1 from public.nudge as n
        where n.profile_id = fa.profile_id and n.kind = 'marco_passaporte' and n.fixture_id = f.id
      )
    order by fa.profile_id, f.kickoff_at desc
  ),
  -- 3. The user's club (hometown first) plays at home in 1 to 6 days, in a stadium they have not been to.
  home_new_venue as (
    select distinct on (pc.profile_id)
      pc.profile_id, 3 as priority, 'estadio_novo_em_casa'::text as kind, f.id as fixture_id,
      jsonb_build_object('club', cf.facts, 'venue', vf.facts, 'kickoff_at', f.kickoff_at) as facts
    from public.profile_club as pc
    join eligible as e on e.profile_id = pc.profile_id
    join public.club as c on c.id = pc.club_id
    join public.fixture as f on f.home_club_id = pc.club_id and f.venue_id = c.home_venue_id
    join club_facts as cf on cf.id = pc.club_id
    join venue_facts as vf on vf.id = f.venue_id
    cross join params
    where f.kickoff_at > params.now_at + interval '1 day'
      and f.kickoff_at <= params.now_at + interval '6 days'
      and not exists (
        select 1 from attended_venues as av where av.profile_id = pc.profile_id and av.venue_id = f.venue_id
      )
      and not exists (
        select 1 from public.nudge as n
        where n.profile_id = pc.profile_id and n.kind = 'estadio_novo_em_casa' and n.fixture_id = f.id
      )
    order by pc.profile_id, (pc.relation = 'hometown') desc, f.kickoff_at
  ),
  -- 4. The supported club plays away between 5 and 60 km from the user's base, in 1 to 6 days.
  supporter_away_nearby as (
    select distinct on (pc.profile_id)
      pc.profile_id, 4 as priority, 'clube_perto_de_ti'::text as kind, f.id as fixture_id,
      jsonb_build_object(
        'club', cf.facts,
        'venue', vf.facts,
        'kickoff_at', f.kickoff_at,
        'km', round(extensions.st_distance(hb.location, vf.location) / 1000)::integer
      ) as facts
    from public.profile_club as pc
    join eligible as e on e.profile_id = pc.profile_id
    join home_base as hb on hb.profile_id = pc.profile_id
    join public.fixture as f on f.away_club_id = pc.club_id
    join club_facts as cf on cf.id = pc.club_id
    join venue_facts as vf on vf.id = f.venue_id
    cross join params
    where pc.relation = 'supporter'
      and vf.location is not null
      and f.kickoff_at > params.now_at + interval '1 day'
      and f.kickoff_at <= params.now_at + interval '6 days'
      and extensions.st_distance(hb.location, vf.location) between 5000 and 60000
      and not exists (
        select 1 from public.nudge as n
        where n.profile_id = pc.profile_id and n.kind = 'clube_perto_de_ti' and n.fixture_id = f.id
      )
    order by pc.profile_id, f.kickoff_at
  ),
  all_candidates as (
    select * from first_visit_place
    union all select * from milestone
    union all select * from home_new_venue
    union all select * from supporter_away_nearby
  )
  select distinct on (c.profile_id) c.profile_id, c.kind, c.fixture_id, c.facts
  from all_candidates as c
  order by c.profile_id, c.priority;
$$;

revoke execute on function public.nudge_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.nudge_candidates(timestamptz) to service_role;
