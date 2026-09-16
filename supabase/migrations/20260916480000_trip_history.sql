-- O histórico de uma viagem: com quem foste e o que se gastou.
--
-- «Os meus jogos» só sabia dizer a nota que cada um deu ao jogo. Mas o que se lembra de uma ida ao estádio é com
-- quem se foi e o que se gastou — por isso o histórico passa a ter isso.
--
-- Duas mudanças:
--   1. `my_trip_accounts` passa a dizer também **quem entra** em cada contas (nomes), para o resumo da viagem.
--   2. `my_trip_history` dá, por jogo já passado, com quem foste e quanto se gastou, numa consulta só — a lista do
--      histórico não pode perguntar jogo a jogo.

drop function public.my_trip_accounts(text);

create function public.my_trip_accounts(p_fixture_id text)
returns table (
  kind text,
  owner_id uuid,
  title text,
  session_id uuid,
  people integer,
  people_names text[],
  expenses integer,
  total_cents integer,
  my_balance_cents integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    'grupo',
    g.id,
    g.name,
    s.id,
    (select count(*)::integer from public.fan_group_member as fm where fm.group_id = g.id),
    array(
      select p.display_name
      from public.fan_group_member as fm
      join public.profile as p on p.id = fm.profile_id
      where fm.group_id = g.id
      order by p.display_name
    ),
    coalesce((select count(*)::integer from public.trip_expense as e where e.session_id = s.id), 0),
    coalesce((select sum(e.cents)::integer from public.trip_expense as e where e.session_id = s.id), 0),
    coalesce(
      (select b.balance_cents from public.trip_balances(s.id) as b where b.profile_id = auth.uid()),
      0
    )
  from public.fan_group_member as m
  join public.fan_group as g on g.id = m.group_id
  left join public.trip_session as s on s.group_id = g.id and s.fixture_id = p_fixture_id
  where m.profile_id = auth.uid()
  union all
  select
    'boleia',
    r.id,
    case when r.driver_id = auth.uid() then 'A tua boleia'
         else 'Boleia de ' || condutor.display_name end,
    s.id,
    1 + (select count(*)::integer from public.ride_passenger as rp
         where rp.ride_id = r.id and rp.status = 'accepted'),
    array[condutor.display_name] || array(
      select p.display_name
      from public.ride_passenger as rp
      join public.profile as p on p.id = rp.profile_id
      where rp.ride_id = r.id and rp.status = 'accepted'
      order by p.display_name
    ),
    coalesce((select count(*)::integer from public.trip_expense as e where e.session_id = s.id), 0),
    coalesce((select sum(e.cents)::integer from public.trip_expense as e where e.session_id = s.id), 0),
    coalesce(
      (select b.balance_cents from public.trip_balances(s.id) as b where b.profile_id = auth.uid()),
      0
    )
  from public.ride as r
  join public.profile as condutor on condutor.id = r.driver_id
  left join public.trip_session as s on s.ride_id = r.id
  where r.fixture_id = p_fixture_id
    and r.status = 'open'
    and (
      r.driver_id = auth.uid()
      or exists (
        select 1 from public.ride_passenger as rp
        where rp.ride_id = r.id and rp.profile_id = auth.uid() and rp.status = 'accepted'
      )
    );
$$;

/** Por cada jogo já passado onde foste acompanhado ou dividiste contas: com quem foste e o que se gastou. */
create function public.my_trip_history()
returns table (
  fixture_id text,
  kickoff_at timestamptz,
  companions integer,
  companion_names text[],
  expenses integer,
  total_cents integer,
  my_balance_cents integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with minhas_sessoes as (
    select s.id, s.fixture_id
    from public.trip_session as s
    where auth.uid() is not null and public.is_trip_member(s.id, auth.uid())
  ),
  minhas_boleias as (
    select r.id as ride_id, r.fixture_id, r.driver_id
    from public.ride as r
    where auth.uid() is not null
      and r.status = 'open'
      and (
        r.driver_id = auth.uid()
        or exists (
          select 1 from public.ride_passenger as rp
          where rp.ride_id = r.id and rp.profile_id = auth.uid() and rp.status = 'accepted'
        )
      )
  ),
  jogos as (
    select fixture_id from minhas_sessoes
    union
    select fixture_id from minhas_boleias
  ),
  gente as (
    select b.fixture_id, b.driver_id as profile_id from minhas_boleias as b
    union
    select b.fixture_id, rp.profile_id
    from minhas_boleias as b
    join public.ride_passenger as rp on rp.ride_id = b.ride_id and rp.status = 'accepted'
    union
    select s.fixture_id, pessoa.profile_id
    from minhas_sessoes as s
    cross join lateral public.trip_session_people(s.id) as pessoa
  )
  select
    j.fixture_id,
    f.kickoff_at,
    (select count(*)::integer from gente as g
     where g.fixture_id = j.fixture_id and g.profile_id <> auth.uid()),
    array(
      select p.display_name
      from gente as g
      join public.profile as p on p.id = g.profile_id
      where g.fixture_id = j.fixture_id and g.profile_id <> auth.uid()
      order by p.display_name
    ),
    coalesce((
      select count(*)::integer
      from minhas_sessoes as s
      join public.trip_expense as e on e.session_id = s.id
      where s.fixture_id = j.fixture_id
    ), 0),
    coalesce((
      select sum(e.cents)::integer
      from minhas_sessoes as s
      join public.trip_expense as e on e.session_id = s.id
      where s.fixture_id = j.fixture_id
    ), 0),
    coalesce((
      select sum(b.balance_cents)::integer
      from minhas_sessoes as s
      cross join lateral public.trip_balances(s.id) as b
      where s.fixture_id = j.fixture_id and b.profile_id = auth.uid()
    ), 0)
  from jogos as j
  join public.fixture as f on f.id = j.fixture_id
  where f.kickoff_at < now()
  order by f.kickoff_at desc;
$$;

revoke execute on function public.my_trip_accounts(text) from public, anon;
revoke execute on function public.my_trip_history() from public, anon;
grant execute on function public.my_trip_accounts(text) to authenticated;
grant execute on function public.my_trip_history() to authenticated;
