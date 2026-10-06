-- Ranking: points (XP), levels, missions, weekly challenges and season divisions.
--
-- - Only what the app confirmed counts: stadiums stamped on site, check-ins at tascos, approved tasco photos, reviews
--   of places the person was at, and proof photos the server verified. Anything only declared stays out.
-- - XP is not stored: it is derived from those tables every time (ranking_activity -> ranking_xp). A check-in that is
--   undone or a photo that is rejected drops out on its own, history needs no backfill, and a rule changed here
--   applies to everyone at once.
-- - Levels are for life (the curve gets steeper); divisions are per season, with promotion and relegation when the
--   season closes.
-- - Rankings only show people who chose to appear (profile.show_in_rankings), plus the caller.
-- - Attendance numbers are aggregates, published only from 5 different people up, like every aggregate in the app.

-- 1. Catalogue of missions: lifetime achievements in tiers, season missions and the weekly challenge pool.
create table public.mission (
  id text primary key check (id ~ '^[a-z0-9-]{1,60}$'),
  kind text not null check (kind in ('achievement', 'season', 'weekly')),
  -- Tiers of the same achievement share a family; the weekly pool uses it to mix kinds of challenge.
  family text not null check (family ~ '^[a-z0-9-]{1,40}$'),
  tier smallint check (tier between 1 and 3),
  metric text not null check (metric in (
    'stadium_visit', 'stadium', 'new_stadium', 'away_game', 'district',
    'tasco_checkin', 'tasco', 'new_tasco', 'tasco_photo', 'review', 'specialty', 'proof_photo'
  )),
  target integer not null check (target between 1 and 1000),
  xp integer not null check (xp between 1 and 5000),
  title text not null check (char_length(title) between 3 and 80),
  description text not null check (char_length(description) between 3 and 300),
  badge text check (char_length(badge) between 2 and 40),
  -- A name from the app's icon set (src/ui/icon.tsx).
  icon text not null check (icon ~ '^[a-zA-Z]{1,40}$'),
  -- For missions proven by a photo: what the photo should show.
  proof_hint text check (char_length(proof_hint) <= 200),
  sort smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. The three challenges of each week (Monday to Sunday, Lisbon). Picked ahead of time so people can plan.
create table public.weekly_challenge (
  week_start date not null check (extract(isodow from week_start) = 1),
  slot smallint not null check (slot between 1 and 3),
  mission_id text not null references public.mission (id),
  created_at timestamptz not null default now(),
  primary key (week_start, slot),
  unique (week_start, mission_id)
);

create index weekly_challenge_mission_id_idx on public.weekly_challenge (mission_id);

-- 3. Divisions: 1 is the top, 5 is where everyone starts. A missing row means division 5.
create table public.season_division (
  profile_id uuid not null references public.profile (id) on delete cascade,
  season_id text not null references public.season (id) on delete cascade,
  division smallint not null check (division between 1 and 5),
  -- Compared with the season before: 1 promoted, -1 relegated.
  movement smallint not null default 0 check (movement between -1 and 1),
  created_at timestamptz not null default now(),
  primary key (profile_id, season_id)
);

create index season_division_season_idx on public.season_division (season_id, division);

-- Seasons whose promotions and relegations were already applied. Internal: no client access.
create table public.season_closing (
  season_id text primary key references public.season (id) on delete cascade,
  closed_at timestamptz not null default now()
);

-- Row level security.
alter table public.mission enable row level security;
alter table public.weekly_challenge enable row level security;
alter table public.season_division enable row level security;
alter table public.season_closing enable row level security;

create policy "missions are readable by signed-in users"
  on public.mission for select to authenticated using (true);

-- This week's challenges and next week's, never further ahead.
create policy "this and next week's challenges are readable by signed-in users"
  on public.weekly_challenge for select to authenticated
  using (week_start <= date_trunc('week', now() at time zone 'Europe/Lisbon')::date + 7);

create policy "users read their own divisions"
  on public.season_division for select to authenticated
  using ((select auth.uid()) = profile_id);

-- season_closing has no policy on purpose: only the server's functions touch it.

revoke all on public.mission, public.weekly_challenge, public.season_division, public.season_closing
  from anon, authenticated;
grant select on public.mission, public.weekly_challenge, public.season_division to authenticated;

-- 4. Helpers.

create function public.current_season_id()
returns text
language sql
stable
set search_path = ''
as $$
  select s.id
  from public.season as s
  where (now() at time zone 'Europe/Lisbon')::date between s.starts_on and s.ends_on
  order by s.starts_on desc
  limit 1;
$$;

-- XP needed to reach a level: going from level L to L+1 costs 100 + 50 × (L − 1).
-- Level 2 at 100, 5 at 700, 10 at 2 700, 20 at 10 450, 40 at 40 950. Capped at 99.
create function public.ranking_level_floor(p_level integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (25 * n * n + 75 * n)::integer
  from (select greatest(least(coalesce(p_level, 1), 99), 1) - 1 as n) as x;
$$;

create function public.ranking_level(p_xp integer)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  n integer;
begin
  if p_xp is null or p_xp <= 0 then
    return 1;
  end if;
  n := floor((-75 + sqrt(5625 + 100::numeric * p_xp)) / 50)::integer;
  -- Guard against rounding at the exact thresholds.
  while 25 * (n + 1) * (n + 1) + 75 * (n + 1) <= p_xp loop
    n := n + 1;
  end loop;
  while n > 0 and 25 * n * n + 75 * n > p_xp loop
    n := n - 1;
  end loop;
  return least(n + 1, 99);
end;
$$;

-- How many go up and down in a division with `p_active` people who scored this season. Small divisions only promote.
create function public.division_spots(p_active integer, out up integer, out down integer)
language sql
immutable
set search_path = ''
as $$
  select
    case when coalesce(p_active, 0) > 0 then ceil(p_active * 0.2)::integer else 0 end,
    case when coalesce(p_active, 0) >= 5 then floor(p_active * 0.2)::integer else 0 end;
$$;

-- Promotion also needs this many points in the season: finishing first among two people is not enough.
create function public.division_promotion_min_xp()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 500;
$$;

-- 5. Everything that counts, as events: who, which metric, a key (to count distinct things), and when.
-- `p_profile_id` null means everyone. Internal: only the security definer functions below call it.
create function public.ranking_activity(p_profile_id uuid default null)
returns table (profile_id uuid, metric text, key text, at timestamptz)
language sql
stable
set search_path = ''
as $$
  with stamps as (
    select sv.profile_id, sv.venue_id, sv.fixture_id, sv.visited_on, sv.created_at as at, v.district, v.region
    from public.stadium_visit as sv
    join public.venue as v on v.id = sv.venue_id
    where p_profile_id is null or sv.profile_id = p_profile_id
  ),
  first_stamps as (
    select distinct on (s.profile_id, s.venue_id) s.profile_id, s.venue_id, s.at
    from stamps as s
    order by s.profile_id, s.venue_id, s.at
  ),
  checkins as (
    select pv.id, pv.profile_id, pv.place_id, pv.visited_at as at
    from public.place_visit as pv
    where pv.source = 'check-in' and (p_profile_id is null or pv.profile_id = p_profile_id)
  ),
  first_checkins as (
    select distinct on (c.profile_id, c.place_id) c.profile_id, c.place_id, c.at
    from checkins as c
    order by c.profile_id, c.place_id, c.at
  )
  select s.profile_id, 'stadium_visit', s.venue_id || '@' || s.visited_on::text, s.at from stamps as s
  union all
  select s.profile_id, 'stadium', s.venue_id, s.at from stamps as s
  union all
  select f.profile_id, 'new_stadium', f.venue_id, f.at from first_stamps as f
  union all
  -- Away: the person's club was the visiting side.
  select s.profile_id, 'away_game', s.fixture_id, s.at
  from stamps as s
  join public.fixture as fx on fx.id = s.fixture_id
  join public.profile_club as pc
    on pc.profile_id = s.profile_id and pc.relation = 'supporter' and pc.club_id = fx.away_club_id
  union all
  select s.profile_id, 'district', s.district, s.at from stamps as s
  where s.region <> 'abroad' and s.district is not null
  union all
  select c.profile_id, 'tasco_checkin', c.id::text, c.at from checkins as c
  union all
  select c.profile_id, 'tasco', c.place_id, c.at from checkins as c
  union all
  select f.profile_id, 'new_tasco', f.place_id, f.at from first_checkins as f
  union all
  select pp.submitted_by, 'tasco_photo', pp.id::text, pp.created_at
  from public.place_photo as pp
  where pp.status = 'approved' and pp.submitted_by is not null
    and (p_profile_id is null or pp.submitted_by = p_profile_id)
  union all
  -- A stadium review counts for a game stamped on site, once per stadium per season.
  select vr.profile_id, 'review', 'estadio:' || fx.venue_id || ':' || coalesce(fx.season_id, ''), vr.created_at
  from public.venue_review as vr
  join public.fixture as fx on fx.id = vr.fixture_id
  where (p_profile_id is null or vr.profile_id = p_profile_id)
    and exists (
      select 1 from public.stadium_visit as sv
      where sv.profile_id = vr.profile_id and sv.fixture_id = vr.fixture_id
    )
  union all
  -- A tasco rating counts when the person checked in there.
  select pr.profile_id, 'review', 'tasco:' || pr.place_id, pr.created_at
  from public.place_rating as pr
  where exists (select 1 from checkins as c where c.profile_id = pr.profile_id and c.place_id = pr.place_id)
  union all
  select dr.profile_id, 'specialty', dr.dish_id::text, dr.created_at
  from public.dish_recommendation as dr
  join public.dish as d on d.id = dr.dish_id
  where d.is_specialty
    and exists (select 1 from checkins as c where c.profile_id = dr.profile_id and c.place_id = d.place_id)
  union all
  select mp.profile_id, 'proof_photo', mp.mission_id, mp.taken_at
  from public.mission_photo as mp
  where mp.verified and (p_profile_id is null or mp.profile_id = p_profile_id);
$$;

-- Progress of every mission, per window: all time for achievements, the season for season missions, the week for
-- weekly challenges (only weeks in which that challenge was on). Each distinct key counts once per window.
-- `completed_at` is when the target was reached.
create function public.ranking_progress(p_profile_id uuid default null)
returns table (profile_id uuid, mission_id text, window_start date, progress integer, completed_at timestamptz, xp integer)
language sql
stable
set search_path = ''
as $$
  with windowed as (
    select
      a.profile_id,
      m.id as mission_id,
      m.target,
      m.xp,
      a.key,
      a.at,
      case m.kind
        when 'achievement' then date '2000-01-01'
        when 'season' then s.starts_on
        else date_trunc('week', a.at at time zone 'Europe/Lisbon')::date
      end as window_start,
      m.kind
    from public.ranking_activity(p_profile_id) as a
    join public.mission as m on m.metric = a.metric and m.active
    left join public.season as s
      on m.kind = 'season' and (a.at at time zone 'Europe/Lisbon')::date between s.starts_on and s.ends_on
    -- A proof photo only counts for its own mission.
    where m.metric <> 'proof_photo' or a.key = m.id
  ),
  firsts as (
    select w.profile_id, w.mission_id, w.window_start, w.key, min(w.at) as at, min(w.target) as target, min(w.xp) as xp
    from windowed as w
    where w.window_start is not null
      and (
        w.kind <> 'weekly'
        or exists (
          select 1 from public.weekly_challenge as wc
          where wc.week_start = w.window_start and wc.mission_id = w.mission_id
        )
      )
    group by w.profile_id, w.mission_id, w.window_start, w.key
  )
  select
    f.profile_id,
    f.mission_id,
    f.window_start,
    count(*)::integer,
    (array_agg(f.at order by f.at, f.key))[min(f.target)],
    min(f.xp)
  from firsts as f
  group by f.profile_id, f.mission_id, f.window_start;
$$;

-- Every point earned, and when.
--   stadium stamped on site 100 · first time at that stadium +150 · away game +50
--   tasco check-in 20 (two per day at most) · approved tasco photo 15 · review 10 · mission: its own XP
create function public.ranking_xp(p_profile_id uuid default null)
returns table (profile_id uuid, at timestamptz, points integer)
language sql
stable
set search_path = ''
as $$
  with firsts as (
    select a.profile_id, a.metric, a.key, min(a.at) as at
    from public.ranking_activity(p_profile_id) as a
    group by a.profile_id, a.metric, a.key
  )
  select f.profile_id, f.at,
    case f.metric
      when 'stadium_visit' then 100
      when 'new_stadium' then 150
      when 'away_game' then 50
      when 'tasco_photo' then 15
      else 10
    end
  from firsts as f
  where f.metric in ('stadium_visit', 'new_stadium', 'away_game', 'tasco_photo', 'review')
  union all
  select t.profile_id, t.at, 20
  from (
    select
      f.profile_id,
      f.at,
      row_number() over (
        partition by f.profile_id, (f.at at time zone 'Europe/Lisbon')::date order by f.at
      ) as nth
    from firsts as f
    where f.metric = 'tasco_checkin'
  ) as t
  where t.nth <= 2
  union all
  select p.profile_id, p.completed_at, p.xp
  from public.ranking_progress(p_profile_id) as p
  where p.completed_at is not null;
$$;

-- Total XP (for life) and XP in one season, per person who earned any.
create function public.ranking_totals(p_profile_id uuid default null, p_season_id text default null)
returns table (profile_id uuid, total_xp integer, season_xp integer)
language sql
stable
set search_path = ''
as $$
  select
    x.profile_id,
    sum(x.points)::integer,
    coalesce(sum(x.points) filter (
      where (x.at at time zone 'Europe/Lisbon')::date between s.starts_on and s.ends_on
    ), 0)::integer
  from public.ranking_xp(p_profile_id) as x
  left join public.season as s on s.id = p_season_id
  group by x.profile_id;
$$;

-- The division someone plays in this season.
create function public.ranking_division(p_profile_id uuid, p_season_id text)
returns smallint
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select sd.division from public.season_division as sd
     where sd.profile_id = p_profile_id and sd.season_id = p_season_id),
    5
  )::smallint;
$$;

-- 6. What the app reads.

-- The caller's own numbers: level, season, division, streak and stadiums.
create function public.my_ranking()
returns table (
  total_xp integer,
  level integer,
  level_xp integer,
  next_level_xp integer,
  season_id text,
  season_xp integer,
  division smallint,
  division_movement smallint,
  division_position integer,
  division_size integer,
  promotion_spots integer,
  relegation_spots integer,
  promotion_min_xp integer,
  streak_weeks integer,
  best_streak_weeks integer,
  stadiums integer,
  stadium_visits integer,
  show_in_rankings boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  season text := public.current_season_id();
  mine record;
  my_division smallint;
  this_week date := date_trunc('week', now() at time zone 'Europe/Lisbon')::date;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  my_division := public.ranking_division(caller, season);

  select coalesce(t.total_xp, 0) as total_xp, coalesce(t.season_xp, 0) as season_xp
  into mine
  from (select 1) as one
  left join public.ranking_totals(caller, season) as t on true;

  return query
  with everyone as (
    select t.profile_id, t.season_xp
    from public.ranking_totals(null, season) as t
    where public.ranking_division(t.profile_id, season) = my_division
  ),
  -- Everyone in the division counts for the table, visible or not: positions must be the real ones.
  table_rows as (
    select e.profile_id, e.season_xp from everyone as e where e.season_xp > 0
    union
    select caller, mine.season_xp
  ),
  placed as (
    select r.profile_id, row_number() over (order by r.season_xp desc, r.profile_id = caller desc, r.profile_id) as pos
    from table_rows as r
  ),
  active as (
    select count(*)::integer as n from table_rows as r where r.season_xp > 0
  ),
  -- Streak: consecutive weeks with football in the catalogue in which the person stamped a stadium. Weeks without
  -- games (international breaks) neither count nor break it, and the current week is still open.
  game_weeks as (
    select w, row_number() over (order by w) as idx
    from (
      select distinct date_trunc('week', f.kickoff_at at time zone 'Europe/Lisbon')::date as w
      from public.fixture as f
    ) as weeks
    where weeks.w <= this_week
  ),
  my_weeks as (
    select gw.w, gw.idx, gw.idx - row_number() over (order by gw.idx) as run
    from game_weeks as gw
    where exists (
      select 1 from public.stadium_visit as sv
      where sv.profile_id = caller and date_trunc('week', sv.visited_on::timestamp)::date = gw.w
    )
  ),
  runs as (
    select max(mw.idx) as last_idx, count(*)::integer as len from my_weeks as mw group by mw.run
  ),
  latest as (
    select max(gw.idx) as idx, max(gw.w) as w from game_weeks as gw
  ),
  stamps as (
    select count(distinct sv.venue_id)::integer as stadiums, count(*)::integer as visits
    from public.stadium_visit as sv
    where sv.profile_id = caller
  )
  select
    mine.total_xp,
    public.ranking_level(mine.total_xp),
    public.ranking_level_floor(public.ranking_level(mine.total_xp)),
    public.ranking_level_floor(public.ranking_level(mine.total_xp) + 1),
    season,
    mine.season_xp,
    my_division,
    coalesce((select sd.movement from public.season_division as sd
              where sd.profile_id = caller and sd.season_id = season), 0)::smallint,
    (select p.pos from placed as p where p.profile_id = caller)::integer,
    (select count(*) from table_rows)::integer,
    case when my_division > 1 then (public.division_spots((select n from active))).up else 0 end,
    case when my_division < 5 then (public.division_spots((select n from active))).down else 0 end,
    public.division_promotion_min_xp(),
    coalesce((
      select r.len from runs as r, latest as l
      where r.last_idx = l.idx or (r.last_idx = l.idx - 1 and l.w = this_week)
      order by r.last_idx desc
      limit 1
    ), 0),
    coalesce((select max(r.len) from runs as r), 0),
    (select st.stadiums from stamps as st),
    (select st.visits from stamps as st),
    (select p.show_in_rankings from public.profile as p where p.id = caller);
end;
$$;

-- A ranking table. Scopes: 'geral' (everyone), 'amigos' (accepted friends), 'clube' (same club as the caller),
-- 'divisao' (the caller's division, always this season). Periods: 'epoca' (this season) or 'sempre'.
-- Others appear only if they opted in and scored; the caller always gets their own line.
create function public.ranking_leaderboard(
  p_scope text default 'geral',
  p_period text default 'epoca',
  p_limit integer default 50
)
returns table (
  rank_position integer,
  is_me boolean,
  display_name text,
  club_id text,
  level integer,
  xp integer,
  division smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  season text := public.current_season_id();
  period text := case when p_scope = 'divisao' then 'epoca' else p_period end;
  my_club text;
  my_division smallint;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_scope is null or p_scope not in ('geral', 'amigos', 'clube', 'divisao') then
    raise exception 'bad_scope' using errcode = '22023';
  end if;
  if p_period is null or p_period not in ('epoca', 'sempre') then
    raise exception 'bad_period' using errcode = '22023';
  end if;

  select pc.club_id into my_club
  from public.profile_club as pc
  where pc.profile_id = caller and pc.relation = 'supporter';
  my_division := public.ranking_division(caller, season);

  return query
  with totals as (
    select * from public.ranking_totals(null, season)
  ),
  eligible as (
    select
      p.id,
      p.display_name,
      pc.club_id,
      coalesce(t.total_xp, 0) as total_xp,
      case when period = 'sempre' then coalesce(t.total_xp, 0) else coalesce(t.season_xp, 0) end as score,
      public.ranking_division(p.id, season) as division,
      p.id = caller as is_me
    from public.profile as p
    left join totals as t on t.profile_id = p.id
    left join public.profile_club as pc on pc.profile_id = p.id and pc.relation = 'supporter'
    where (p.show_in_rankings or p.id = caller)
      and (
        p_scope = 'geral'
        or p.id = caller
        or (p_scope = 'clube' and my_club is not null and pc.club_id = my_club)
        or (p_scope = 'amigos' and exists (
          select 1 from public.friendship as fr
          where fr.status = 'aceite'
            and ((fr.requester_id = caller and fr.addressee_id = p.id)
              or (fr.addressee_id = caller and fr.requester_id = p.id))
        ))
        or (p_scope = 'divisao' and public.ranking_division(p.id, season) = my_division)
      )
  ),
  ranked as (
    select e.*, row_number() over (order by e.score desc, e.is_me desc, e.display_name, e.id)::integer as ordinal
    from eligible as e
    where e.score > 0 or e.is_me
  )
  select r.ordinal, r.is_me, r.display_name, r.club_id, public.ranking_level(r.total_xp), r.score, r.division
  from ranked as r
  where r.ordinal <= least(greatest(coalesce(p_limit, 50), 1), 100) or r.is_me
  order by r.ordinal;
end;
$$;

-- The caller's missions: every achievement, this season's missions, and this week's and next week's challenges.
create function public.my_missions()
returns table (
  mission_id text,
  kind text,
  family text,
  tier smallint,
  metric text,
  target integer,
  xp integer,
  title text,
  description text,
  badge text,
  icon text,
  proof_hint text,
  sort smallint,
  week_start date,
  progress integer,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  season_start date := (select s.starts_on from public.season as s where s.id = public.current_season_id());
  this_week date := date_trunc('week', now() at time zone 'Europe/Lisbon')::date;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  return query
  with prog as (
    select * from public.ranking_progress(caller)
  )
  select
    m.id, m.kind, m.family, m.tier, m.metric, m.target, m.xp, m.title, m.description, m.badge, m.icon,
    m.proof_hint, m.sort, null::date,
    least(coalesce(p.progress, 0), m.target), p.completed_at
  from public.mission as m
  left join prog as p
    on p.mission_id = m.id
    and p.window_start = case when m.kind = 'achievement' then date '2000-01-01' else season_start end
  where m.active and (m.kind = 'achievement' or (m.kind = 'season' and season_start is not null))
  union all
  select
    m.id, m.kind, m.family, m.tier, m.metric, m.target, m.xp, m.title, m.description, m.badge, m.icon,
    m.proof_hint, wc.slot, wc.week_start,
    least(coalesce(p.progress, 0), m.target), p.completed_at
  from public.weekly_challenge as wc
  join public.mission as m on m.id = wc.mission_id
  left join prog as p on p.mission_id = m.id and p.window_start = wc.week_start
  where wc.week_start in (this_week, this_week + 7);
end;
$$;

-- How many people went to each stadium this season (stamped on site). Only stadiums with 5 people or more.
create function public.venue_attendance()
returns table (venue_id text, people integer, visits integer)
language sql
stable
security definer
set search_path = ''
as $$
  select sv.venue_id, count(distinct sv.profile_id)::integer, count(*)::integer
  from public.stadium_visit as sv
  join public.season as s on s.id = public.current_season_id()
  where sv.visited_on between s.starts_on and s.ends_on
  group by sv.venue_id
  having count(distinct sv.profile_id) >= 5
  order by 2 desc, 3 desc, 1;
$$;

-- Which clubs take the most fans away this season. Only clubs with 5 travelling fans or more.
create function public.club_away_support()
returns table (club_id text, people integer, visits integer)
language sql
stable
security definer
set search_path = ''
as $$
  select f.away_club_id, count(distinct sv.profile_id)::integer, count(*)::integer
  from public.stadium_visit as sv
  join public.fixture as f on f.id = sv.fixture_id
  join public.profile_club as pc
    on pc.profile_id = sv.profile_id and pc.relation = 'supporter' and pc.club_id = f.away_club_id
  join public.season as s on s.id = public.current_season_id()
  where sv.visited_on between s.starts_on and s.ends_on
  group by f.away_club_id
  having count(distinct sv.profile_id) >= 5
  order by 2 desc, 3 desc, 1;
$$;

-- The season in numbers across the app. Nothing until 5 different people have stamped a stadium.
create function public.season_attendance()
returns table (people integer, visits integer, venues integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct sv.profile_id)::integer, count(*)::integer, count(distinct sv.venue_id)::integer
  from public.stadium_visit as sv
  join public.season as s on s.id = public.current_season_id()
  where sv.visited_on between s.starts_on and s.ends_on
  having count(distinct sv.profile_id) >= 5;
$$;

-- 7. Jobs.

-- Picks the challenges for this week and the next two, for weeks that have games in the catalogue: one about going
-- to a game, one about tascos, one of the rest, avoiding last week's where possible. Weeks already picked stay.
create function public.plan_weekly_challenges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  this_week date := date_trunc('week', now() at time zone 'Europe/Lisbon')::date;
  week date;
  previous text[];
  chosen text;
  families constant text[] := array['semana-jogo', 'semana-tasco', 'semana-extra'];
  i integer;
  planned integer := 0;
begin
  for week in select generate_series(this_week, this_week + 14, interval '7 days')::date loop
    continue when exists (select 1 from public.weekly_challenge as wc where wc.week_start = week);
    continue when not exists (
      select 1 from public.fixture as f
      where f.kickoff_at >= (week::timestamp at time zone 'Europe/Lisbon')
        and f.kickoff_at < ((week + 7)::timestamp at time zone 'Europe/Lisbon')
    );

    previous := array(select wc.mission_id from public.weekly_challenge as wc where wc.week_start = week - 7);
    for i in 1 .. array_length(families, 1) loop
      select m.id into chosen
      from public.mission as m
      where m.kind = 'weekly' and m.active and m.family = families[i]
      order by m.id = any(previous), random()
      limit 1;
      if chosen is not null then
        insert into public.weekly_challenge (week_start, slot, mission_id) values (week, i, chosen);
      end if;
    end loop;
    planned := planned + 1;
  end loop;
  return planned;
end;
$$;

-- When a season ends: the top of each division goes up, the bottom goes down, and whoever scored nothing drops one.
-- Writes the divisions of the next season (it must already exist in public.season; until then it waits).
create function public.close_finished_seasons()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  finished public.season;
  next_season text;
  closed integer := 0;
begin
  for finished in
    select s.* from public.season as s
    where s.ends_on < (now() at time zone 'Europe/Lisbon')::date
      and not exists (select 1 from public.season_closing as c where c.season_id = s.id)
    order by s.starts_on
  loop
    select s.id into next_season
    from public.season as s
    where s.starts_on > finished.ends_on
    order by s.starts_on
    limit 1;
    continue when next_season is null;

    with totals as (
      select t.profile_id, t.season_xp from public.ranking_totals(null, finished.id) as t
    ),
    people as (
      select p.id, public.ranking_division(p.id, finished.id) as div, coalesce(t.season_xp, 0) as xp
      from public.profile as p
      left join totals as t on t.profile_id = p.id
    ),
    active as (
      select
        pe.id,
        row_number() over (partition by pe.div order by pe.xp desc, pe.id) as pos,
        count(*) over (partition by pe.div) as n
      from people as pe
      where pe.xp > 0
    ),
    moves as (
      select
        pe.id,
        pe.div,
        case
          when pe.xp = 0 then least(pe.div + 1, 5)
          when pe.div > 1
            and a.pos <= (public.division_spots(a.n::integer)).up
            and pe.xp >= public.division_promotion_min_xp() then pe.div - 1
          when pe.div < 5 and a.pos > a.n - (public.division_spots(a.n::integer)).down then pe.div + 1
          else pe.div
        end as new_div
      from people as pe
      left join active as a on a.id = pe.id
    )
    insert into public.season_division (profile_id, season_id, division, movement)
    select mv.id, next_season, mv.new_div,
      (case when mv.new_div < mv.div then 1 when mv.new_div > mv.div then -1 else 0 end)::smallint
    from moves as mv
    where mv.new_div < 5 or mv.div < 5
    on conflict (profile_id, season_id) do nothing;

    insert into public.season_closing (season_id) values (finished.id);
    closed := closed + 1;
  end loop;
  return closed;
end;
$$;

-- Privileges: the building blocks are internal; the app only calls the four readers.
revoke execute on function public.current_season_id() from public, anon, authenticated;
revoke execute on function public.ranking_level_floor(integer) from public, anon, authenticated;
revoke execute on function public.ranking_level(integer) from public, anon, authenticated;
revoke execute on function public.division_spots(integer) from public, anon, authenticated;
revoke execute on function public.division_promotion_min_xp() from public, anon, authenticated;
revoke execute on function public.ranking_activity(uuid) from public, anon, authenticated;
revoke execute on function public.ranking_progress(uuid) from public, anon, authenticated;
revoke execute on function public.ranking_xp(uuid) from public, anon, authenticated;
revoke execute on function public.ranking_totals(uuid, text) from public, anon, authenticated;
revoke execute on function public.ranking_division(uuid, text) from public, anon, authenticated;
revoke execute on function public.plan_weekly_challenges() from public, anon, authenticated;
revoke execute on function public.close_finished_seasons() from public, anon, authenticated;

revoke execute on function public.my_ranking() from public, anon;
revoke execute on function public.ranking_leaderboard(text, text, integer) from public, anon;
revoke execute on function public.my_missions() from public, anon;
revoke execute on function public.venue_attendance() from public, anon;
revoke execute on function public.club_away_support() from public, anon;
revoke execute on function public.season_attendance() from public, anon;
grant execute on function public.my_ranking() to authenticated;
grant execute on function public.ranking_leaderboard(text, text, integer) to authenticated;
grant execute on function public.my_missions() to authenticated;
grant execute on function public.venue_attendance() to authenticated;
grant execute on function public.club_away_support() to authenticated;
grant execute on function public.season_attendance() to authenticated;

-- 8. The missions.
insert into public.mission (id, kind, family, tier, metric, target, xp, title, description, badge, icon, proof_hint, sort)
values
  -- Achievements, for life.
  ('tres-estadios', 'achievement', 'estadios', 1, 'stadium', 3, 150,
   'Visita 3 estádios diferentes', 'Carimbados no local, em dia de jogo.', 'Turista de bancada', 'estadio', null, 10),
  ('dez-estadios', 'achievement', 'estadios', 2, 'stadium', 10, 400,
   'Visita 10 estádios diferentes', 'Carimbados no local, em dia de jogo.', 'Colecionador de relvados', 'estadio', null, 11),
  ('vinte-e-cinco-estadios', 'achievement', 'estadios', 3, 'stadium', 25, 1000,
   'Visita 25 estádios diferentes', 'Carimbados no local, em dia de jogo.', 'Passaporte carimbado', 'estadio', null, 12),

  ('cinco-jogos', 'achievement', 'jogos', 1, 'stadium_visit', 5, 100,
   'Vai a 5 jogos', 'Cada jogo com o estádio carimbado conta uma vez.', 'Presença marcada', 'jogos', null, 20),
  ('vinte-e-cinco-jogos', 'achievement', 'jogos', 2, 'stadium_visit', 25, 300,
   'Vai a 25 jogos', 'Cada jogo com o estádio carimbado conta uma vez.', 'Cativo', 'jogos', null, 21),
  ('cem-jogos', 'achievement', 'jogos', 3, 'stadium_visit', 100, 1000,
   'Vai a 100 jogos', 'Cada jogo com o estádio carimbado conta uma vez.', 'Sempre lá', 'jogos', null, 22),

  ('primeira-deslocacao', 'achievement', 'fora', 1, 'away_game', 1, 100,
   'Acompanha o teu clube fora', 'Um jogo em que o teu clube é o visitante, com o estádio carimbado.',
   'Primeira deslocação', 'rota', null, 30),
  ('cinco-deslocacoes', 'achievement', 'fora', 2, 'away_game', 5, 300,
   'Faz 5 deslocações', 'Jogos em que o teu clube é o visitante, com o estádio carimbado.', 'Estrada fora', 'rota', null, 31),
  ('vinte-deslocacoes', 'achievement', 'fora', 3, 'away_game', 20, 800,
   'Faz 20 deslocações', 'Jogos em que o teu clube é o visitante, com o estádio carimbado.', 'Mala sempre feita', 'rota', null, 32),

  ('tres-distritos', 'achievement', 'distritos', 1, 'district', 3, 150,
   'Vê bola em 3 distritos', 'Estádios carimbados em distritos diferentes.', 'Andarilho', 'cidade', null, 40),
  ('oito-distritos', 'achievement', 'distritos', 2, 'district', 8, 400,
   'Vê bola em 8 distritos', 'Estádios carimbados em distritos diferentes.', 'Volta a Portugal', 'cidade', null, 41),
  ('quinze-distritos', 'achievement', 'distritos', 3, 'district', 15, 1000,
   'Vê bola em 15 distritos', 'Estádios carimbados em distritos diferentes.', 'Mapa completo', 'cidade', null, 42),

  ('cinco-tascos', 'achievement', 'tascos', 1, 'tasco', 5, 100,
   'Faz check-in em 5 tascos', 'Tascos diferentes, com o check-in feito lá.', 'Crítico de tasco', 'tasco', null, 50),
  ('quinze-tascos', 'achievement', 'tascos', 2, 'tasco', 15, 300,
   'Faz check-in em 15 tascos', 'Tascos diferentes, com o check-in feito lá.', 'Roteiro de tascos', 'tasco', null, 51),
  ('quarenta-tascos', 'achievement', 'tascos', 3, 'tasco', 40, 800,
   'Faz check-in em 40 tascos', 'Tascos diferentes, com o check-in feito lá.', 'Enciclopédia de tasco', 'tasco', null, 52),

  ('foto-do-tasco', 'achievement', 'fotos', 1, 'tasco_photo', 1, 50,
   'Fotografa um tasco', 'Envia uma foto na ficha do tasco. Conta quando for aprovada.', 'Repórter de tasco', 'camara', null, 60),
  ('cinco-fotos', 'achievement', 'fotos', 2, 'tasco_photo', 5, 150,
   'Fotografa 5 tascos', 'Fotos enviadas na ficha do tasco. Contam quando forem aprovadas.', 'Fotógrafo de balcão', 'camara', null, 61),
  ('quinze-fotos', 'achievement', 'fotos', 3, 'tasco_photo', 15, 400,
   'Fotografa 15 tascos', 'Fotos enviadas na ficha do tasco. Contam quando forem aprovadas.', 'Arquivo do tasco', 'camara', null, 62),

  ('cinco-avaliacoes', 'achievement', 'avaliacoes', 1, 'review', 5, 50,
   'Faz 5 avaliações', 'De estádios onde carimbaste ou de tascos onde fizeste check-in.', 'Opinião própria', 'estrela', null, 70),
  ('vinte-avaliacoes', 'achievement', 'avaliacoes', 2, 'review', 20, 150,
   'Faz 20 avaliações', 'De estádios onde carimbaste ou de tascos onde fizeste check-in.', 'Voz da bancada', 'estrela', null, 71),
  ('cinquenta-avaliacoes', 'achievement', 'avaliacoes', 3, 'review', 50, 400,
   'Faz 50 avaliações', 'De estádios onde carimbaste ou de tascos onde fizeste check-in.', 'Crítico encartado', 'estrela', null, 72),

  ('especialidade-da-casa', 'achievement', 'especialidade', null, 'specialty', 1, 100,
   'Prova a especialidade da casa', 'Recomenda a especialidade de um tasco onde fizeste check-in.',
   'Paladar da casa', 'especialidade', null, 80),
  ('foto-com-rival', 'achievement', 'foto-com-rival', null, 'proof_photo', 1, 150,
   'Tira uma foto com um adepto rival',
   'Pede primeiro. Cada um com a sua camisola, lado a lado e sem contacto. Conta tirada em dia de jogo, perto do estádio.',
   'Selfie diplomática', 'camara', 'Tu e o adepto rival, cada um com a sua camisola, sem contacto.', 81),

  -- This season.
  ('epoca-dez-jogos', 'season', 'epoca-jogos', null, 'stadium_visit', 10, 300,
   'Vai a 10 jogos esta época', 'Jogos com o estádio carimbado.', null, 'jogos', null, 10),
  ('epoca-cinco-estadios', 'season', 'epoca-estadios', null, 'stadium', 5, 250,
   'Visita 5 estádios diferentes esta época', 'Carimbados no local, em dia de jogo.', null, 'estadio', null, 20),
  ('epoca-dois-estadios-novos', 'season', 'epoca-estreias', null, 'new_stadium', 2, 250,
   'Estreia-te em 2 estádios esta época', 'Estádios onde nunca tinhas carimbado.', null, 'estadio', null, 30),
  ('epoca-tres-fora', 'season', 'epoca-fora', null, 'away_game', 3, 250,
   'Faz 3 deslocações esta época', 'Jogos em que o teu clube é o visitante.', null, 'rota', null, 40),
  ('epoca-dez-tascos', 'season', 'epoca-tascos', null, 'tasco', 10, 200,
   'Faz check-in em 10 tascos esta época', 'Tascos diferentes.', null, 'tasco', null, 50),

  -- Weekly pool.
  ('semana-um-jogo', 'weekly', 'semana-jogo', null, 'stadium_visit', 1, 75,
   'Vai a um jogo', 'Carimba o estádio no local.', null, 'jogos', null, 0),
  ('semana-dois-jogos', 'weekly', 'semana-jogo', null, 'stadium_visit', 2, 150,
   'Vai a 2 jogos', 'Carimba o estádio no local, nos dois.', null, 'jogos', null, 0),
  ('semana-estadio-novo', 'weekly', 'semana-jogo', null, 'new_stadium', 1, 150,
   'Estreia-te num estádio', 'Um estádio onde nunca carimbaste.', null, 'estadio', null, 0),
  ('semana-fora', 'weekly', 'semana-jogo', null, 'away_game', 1, 125,
   'Acompanha o teu clube fora', 'Um jogo em que o teu clube é o visitante.', null, 'rota', null, 0),
  ('semana-um-tasco', 'weekly', 'semana-tasco', null, 'tasco_checkin', 1, 50,
   'Faz check-in num tasco', 'Em dia de jogo, no tasco.', null, 'tasco', null, 0),
  ('semana-dois-tascos', 'weekly', 'semana-tasco', null, 'tasco', 2, 75,
   'Faz check-in em 2 tascos diferentes', 'Em dia de jogo, no tasco.', null, 'tasco', null, 0),
  ('semana-tasco-novo', 'weekly', 'semana-tasco', null, 'new_tasco', 1, 75,
   'Experimenta um tasco novo', 'Um tasco onde nunca fizeste check-in.', null, 'tasco', null, 0),
  ('semana-avaliar', 'weekly', 'semana-extra', null, 'review', 1, 50,
   'Avalia onde estiveste', 'O estádio que carimbaste ou um tasco onde fizeste check-in.', null, 'estrela', null, 0),
  ('semana-foto', 'weekly', 'semana-extra', null, 'tasco_photo', 1, 75,
   'Fotografa um tasco', 'Envia a foto esta semana. Conta quando for aprovada.', null, 'camara', null, 0),
  ('semana-especialidade', 'weekly', 'semana-extra', null, 'specialty', 1, 75,
   'Prova uma especialidade', 'Recomenda a especialidade de um tasco onde fizeste check-in.', null, 'especialidade', null, 0);

select public.plan_weekly_challenges();

select cron.schedule('plan-weekly-challenges', '7 3 * * *', $$ select public.plan_weekly_challenges(); $$);
select cron.schedule('close-finished-seasons', '27 4 * * *', $$ select public.close_finished_seasons(); $$);
