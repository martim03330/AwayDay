-- Everyone who shows in the rankings appears in the points table, even with 0 points (owner's decision, 2026-10-12).
-- Before, only people who had scored appeared, so with no stamps yet the table was empty for the testers. Ties
-- (e.g. everyone on 0) are ordered by name. The division logic (who goes up or down) still only counts people
-- who scored: that lives in my_ranking and close_finished_seasons and is unchanged.
-- Same function as in 20261005170549_ranking.sql, without `where e.score > 0 or e.is_me`.

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
  )
  select r.ordinal, r.is_me, r.display_name, r.club_id, public.ranking_level(r.total_xp), r.score, r.division
  from ranked as r
  where r.ordinal <= least(greatest(coalesce(p_limit, 50), 1), 100) or r.is_me
  order by r.ordinal;
end;
$$;
