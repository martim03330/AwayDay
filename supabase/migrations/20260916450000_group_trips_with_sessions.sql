-- Uma viagem do grupo também é um jogo onde há contas.
--
-- As viagens do grupo eram só os jogos com boleia ou casa do grupo. Mas um jogo onde a malta dividiu o jantar é uma
-- viagem tal e qual — e era o único sítio onde as contas ficavam a salvo depois do jogo acabar, porque os jogos
-- terminados saem da lista de jogos. Passam a contar também as sessões de contas, e cada viagem diz quanto já lá
-- está lançado.

drop function public.group_trips(uuid);

create function public.group_trips(p_group_id uuid)
returns table (
  fixture_id text,
  kickoff_at timestamptz,
  rides integer,
  houses integer,
  seats_taken integer,
  expenses integer,
  total_cents integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with viagens as (
    select r.fixture_id, r.id as ride_id, null::uuid as stay_id
    from public.ride as r
    where r.group_id = p_group_id and r.status = 'open'
    union all
    select s.fixture_id, null::uuid, s.id
    from public.stay_plan as s
    where s.group_id = p_group_id
    union all
    select t.fixture_id, null::uuid, null::uuid
    from public.trip_session as t
    where t.group_id = p_group_id
  )
  select
    v.fixture_id,
    f.kickoff_at,
    count(distinct v.ride_id)::integer,
    count(distinct v.stay_id)::integer,
    coalesce((
      select count(*)::integer from public.ride_passenger as rp
      join public.ride as r on r.id = rp.ride_id
      where r.group_id = p_group_id and r.fixture_id = v.fixture_id and rp.status = 'accepted'
    ), 0),
    coalesce((
      select count(*)::integer
      from public.trip_session as t
      join public.trip_expense as e on e.session_id = t.id
      where t.group_id = p_group_id and t.fixture_id = v.fixture_id
    ), 0),
    coalesce((
      select sum(e.cents)::integer
      from public.trip_session as t
      join public.trip_expense as e on e.session_id = t.id
      where t.group_id = p_group_id and t.fixture_id = v.fixture_id
    ), 0)
  from viagens as v
  join public.fixture as f on f.id = v.fixture_id
  where public.is_group_member(p_group_id, auth.uid())
  group by v.fixture_id, f.kickoff_at
  order by f.kickoff_at desc;
$$;

revoke execute on function public.group_trips(uuid) from public, anon;
grant execute on function public.group_trips(uuid) to authenticated;
