-- «Este jogo tem contas?» — a pergunta que o ecrã do jogo faz.
--
-- Um adepto pode andar em vários grupos, e no dia do jogo o que interessa é saber, de uma vez, em que grupos há
-- contas abertas para este jogo, quanto já lá está e como está o seu saldo. Sem isto o ecrã tinha de perguntar
-- grupo a grupo.
--
-- O saldo vem de `trip_balances`: a regra da divisão continua a existir num sítio só.

create function public.my_trip_sessions(p_fixture_id text)
returns table (
  group_id uuid,
  group_name text,
  session_id uuid,
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
    g.id,
    g.name,
    s.id,
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
  order by (s.id is null), g.name;
$$;

revoke execute on function public.my_trip_sessions(text) from public, anon;
grant execute on function public.my_trip_sessions(text) to authenticated;
