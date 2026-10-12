-- The points table no longer recalculates everyone's points on every call (review of 2026-10-13: as the app grows,
-- one person opening the ranking again and again weighed on everyone). Totals and divisions are kept in
-- `ranking_cache`, refreshed every 5 minutes; the caller's own line is always live, so a stamp shows at once in their
-- points. Others' changes take up to 5 minutes. Same function as in 20261012220000 otherwise.

create table public.ranking_cache (
  profile_id uuid primary key references public.profile (id) on delete cascade,
  season_id text,
  total_xp integer not null,
  season_xp integer not null,
  division smallint,
  refreshed_at timestamptz not null default now()
);

alter table public.ranking_cache enable row level security;
-- No policies: only the security definer functions below read or write it.
revoke all on public.ranking_cache from anon, authenticated;

create function public.refresh_ranking_cache()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  season text := public.current_season_id();
begin
  -- One refresh at a time.
  perform pg_advisory_xact_lock(hashtextextended('ranking-cache', 0));
  delete from public.ranking_cache;
  insert into public.ranking_cache (profile_id, season_id, total_xp, season_xp, division)
  select p.id, season, coalesce(t.total_xp, 0), coalesce(t.season_xp, 0), public.ranking_division(p.id, season)
  from public.profile as p
  left join public.ranking_totals(null, season) as t on t.profile_id = p.id;
end;
$$;

revoke execute on function public.refresh_ranking_cache() from public, anon, authenticated;

select public.refresh_ranking_cache();

select cron.schedule('refresh-ranking-cache', '*/5 * * * *', 'select public.refresh_ranking_cache()');

create or replace function public.ranking_leaderboard(
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
  -- Everyone else from the cache (refreshed every 5 minutes); the caller live, so their own points show at once.
  with totals as (
    select rc.profile_id, rc.total_xp, rc.season_xp, rc.division
    from public.ranking_cache as rc
    where rc.profile_id <> caller and rc.season_id = season
    union all
    select t.profile_id, t.total_xp, t.season_xp, my_division
    from public.ranking_totals(caller, season) as t
  ),
  eligible as (
    select
      p.id,
      p.display_name,
      pc.club_id,
      coalesce(t.total_xp, 0) as total_xp,
      case when period = 'sempre' then coalesce(t.total_xp, 0) else coalesce(t.season_xp, 0) end as score,
      coalesce(t.division, public.ranking_division(p.id, season)) as division,
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
        or (p_scope = 'divisao' and coalesce(t.division, public.ranking_division(p.id, season)) = my_division)
      )
  ),
  ranked as (
    select e.*, row_number() over (order by e.score desc, e.is_me desc, e.display_name, e.id)::integer as ordinal
    from eligible as e
  )
  select r.ordinal, r.is_me, r.display_name, r.club_id, public.ranking_level(r.total_xp), r.score, r.division
  from ranked as r
  where r.ordinal <= least(greatest(coalesce(p_limit, 50), 1), 100) or r.is_me
  order by r.ordinal;
end;
$$;
