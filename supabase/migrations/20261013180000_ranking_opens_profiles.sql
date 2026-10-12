-- Tapping someone in the ranking opens their profile (owner's request, 2026-10-13).
--
-- Who can see a profile card: as before, whoever has crossed paths with the person (friends, a group, a plan or a
-- ride: `knows_profile`), and now also anyone, when the person shows in the rankings (they chose to be public
-- there). Blocks still hide it. The home town is only for those who crossed paths; strangers from the ranking see
-- the rest (photo, name, club, since when, rides and stadiums). The tables now return each person's id so the app
-- can open the profile.

-- The old rule, under its own name.
create function public.knows_profile(p_viewer uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_viewer is not null and p_profile_id is not null and (
    p_viewer = p_profile_id
    or (p_viewer = auth.uid() and public.is_admin())
    or (
      not public.has_blocked(p_profile_id, p_viewer)
      and (
        public.can_see_profile(p_viewer, p_profile_id)
        or exists (
          select 1
          from public.fixture_plan as fp
          where fp.status <> 'cancelado'
            and (
              fp.created_by = p_profile_id
              or exists (
                select 1 from public.fixture_plan_answer as a
                where a.plan_id = fp.id and a.profile_id = p_profile_id
              )
            )
            and public.can_see_fixture_plan(fp.id, p_viewer)
        )
      )
    )
  );
$$;

revoke execute on function public.knows_profile(uuid, uuid) from public, anon;
grant execute on function public.knows_profile(uuid, uuid) to authenticated;

create or replace function public.can_see_profile_card(p_viewer uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.knows_profile(p_viewer, p_profile_id)
    or (
      p_viewer is not null
      and p_profile_id is not null
      and not public.has_blocked(p_profile_id, p_viewer)
      and exists (select 1 from public.profile as p where p.id = p_profile_id and p.show_in_rankings)
    );
$$;

create or replace function public.public_profile(p_profile_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  avatar_path text,
  home_city text,
  member_since date,
  rides_completed integer,
  rides_faults integer,
  supporter_club_id text,
  stadiums_stamped integer,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    p.avatar_path,
    -- The home town only for whoever crossed paths with the person, not for strangers from the ranking.
    case when public.knows_profile(auth.uid(), p.id) then p.home_city end,
    p.created_at::date,
    rep.completed,
    rep.faults,
    (select pc.club_id from public.profile_club as pc where pc.profile_id = p.id and pc.relation = 'supporter'),
    (select count(distinct v.venue_id)::integer from public.stadium_visit as v where v.profile_id = p.id),
    p.id = auth.uid()
  from public.profile as p
  cross join lateral public.ride_reputation(array[p.id]) as rep
  where p.id = p_profile_id
    and auth.uid() is not null
    and public.can_see_profile_card(auth.uid(), p.id);
$$;

-- The tables return each person's id (a new column, so the functions are made again).
drop function public.ranking_leaderboard(text, text, integer);
create function public.ranking_leaderboard(
  p_scope text default 'geral',
  p_period text default 'epoca',
  p_limit integer default 50
)
returns table (
  rank_position integer,
  profile_id uuid,
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
  select r.ordinal, r.id, r.is_me, r.display_name, r.club_id, public.ranking_level(r.total_xp), r.score, r.division
  from ranked as r
  where r.ordinal <= least(greatest(coalesce(p_limit, 50), 1), 100) or r.is_me
  order by r.ordinal;
end;
$$;

revoke execute on function public.ranking_leaderboard(text, text, integer) from public, anon;
grant execute on function public.ranking_leaderboard(text, text, integer) to authenticated;

drop function public.verified_places_ranking(integer);
create function public.verified_places_ranking(p_limit integer default 10)
returns table (
  rank_position integer,
  profile_id uuid,
  is_me boolean,
  display_name text,
  club_id text,
  verified_places integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with scores as (
    select v.profile_id, count(distinct v.place_id)::integer as verified_places
    from public.place_visit as v
    where v.source = 'check-in'
    group by v.profile_id
  ),
  eligible as (
    select
      p.id as profile_id,
      p.display_name,
      coalesce(s.verified_places, 0) as verified_places,
      p.id = auth.uid() as is_me
    from public.profile as p
    left join scores as s on s.profile_id = p.id
    where (p.show_in_rankings and s.verified_places > 0) or p.id = auth.uid()
  ),
  ranked as (
    select
      e.*,
      row_number() over (order by e.verified_places desc, e.is_me desc, e.display_name, e.profile_id)::integer
        as ordinal
    from eligible as e
  )
  select r.ordinal, r.profile_id, r.is_me, r.display_name, pc.club_id, r.verified_places
  from ranked as r
  left join public.profile_club as pc on pc.profile_id = r.profile_id and pc.relation = 'supporter'
  where r.ordinal <= least(greatest(coalesce(p_limit, 10), 1), 50) or r.is_me
  order by r.ordinal;
$$;

revoke execute on function public.verified_places_ranking(integer) from public, anon;
grant execute on function public.verified_places_ranking(integer) to authenticated;

-- The cards in lists (people in a car, in a plan…) follow the same rule: no home town for strangers.
create or replace function public.profile_cards(p_profile_ids uuid[])
returns table (
  profile_id uuid,
  display_name text,
  avatar_path text,
  home_city text,
  member_since date,
  rides_completed integer,
  rides_faults integer,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    p.avatar_path,
    case when public.knows_profile(auth.uid(), p.id) then p.home_city end,
    p.created_at::date,
    rep.completed,
    rep.faults,
    p.id = auth.uid()
  from unnest(p_profile_ids[1:200]) as pedido(id)
  join public.profile as p on p.id = pedido.id
  cross join lateral public.ride_reputation(array[p.id]) as rep
  where auth.uid() is not null and public.can_see_profile_card(auth.uid(), p.id);
$$;
