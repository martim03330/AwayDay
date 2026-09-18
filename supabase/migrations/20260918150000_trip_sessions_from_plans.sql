-- A sessão da viagem nasce do plano fechado, e abre-se na véspera do jogo.
--
-- Até aqui as contas de uma viagem abriam-se à mão, a partir da boleia, do grupo ou do nada, e viviam na página do
-- jogo. Passam a ter um só caminho: **quando um plano fecha, nasce a sessão da viagem** (ou é reaproveitada a que a
-- boleia do plano já tinha). Entram quem convidou, quem disse «vou», o condutor e quem tem lugar no carro.
--
-- **A sessão aparece na página dos Jogos a partir da véspera do jogo** (00:00 em Lisboa), ou dois dias antes nos jogos
-- fora do país — a viagem começa mais cedo. Fica lá até três dias depois do jogo; as contas não se apagam, continuam
-- a abrir-se pelo histórico.
--
-- É **só na sessão** que estão as despesas. As sessões que já existiam continuam a funcionar e aparecem da mesma
-- maneira.

alter table public.fixture_plan
  add column session_id uuid references public.trip_session (id) on delete set null;

/** A partir de quando a sessão de um jogo aparece: 00:00 da véspera em Lisboa; dois dias antes fora do país. */
create function public.trip_session_opens_at(p_fixture_id text)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select (
    ((f.kickoff_at at time zone 'Europe/Lisbon')::date
      - case when v.country is distinct from 'Portugal' then 2 else 1 end)::timestamp
  ) at time zone 'Europe/Lisbon'
  from public.fixture as f
  join public.venue as v on v.id = f.venue_id
  where f.id = p_fixture_id;
$$;

/**
 * A sessão do plano: encontra-a (a do plano, a da boleia do plano, ou a do grupo para o jogo) ou cria-a, e põe lá
 * dentro quem vai. Pode correr várias vezes: só acrescenta quem falta, nunca tira ninguém.
 */
create function public.ensure_plan_session(p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  plano public.fixture_plan;
  sessao uuid;
  nome text;
begin
  select * into plano from public.fixture_plan where id = p_plan_id;
  if plano.id is null or plano.status = 'cancelado' then
    return null;
  end if;

  sessao := plano.session_id;
  if sessao is null and plano.ride_id is not null then
    select s.id into sessao from public.trip_session as s where s.ride_id = plano.ride_id;
  end if;
  if sessao is null then
    select s.id into sessao
    from public.trip_session as s
    where s.group_id = plano.group_id and s.fixture_id = plano.fixture_id;
  end if;

  if sessao is null then
    select g.name into nome from public.fan_group as g where g.id = plano.group_id;
    -- Com boleia, a sessão é da boleia (é assim que a despesa do carro entra sozinha); sem boleia, é do grupo.
    insert into public.trip_session (ride_id, group_id, fixture_id, opened_by, name)
    values (
      plano.ride_id,
      case when plano.ride_id is null then plano.group_id end,
      plano.fixture_id,
      plano.created_by,
      left(coalesce(nome, 'A viagem'), 60)
    )
    returning id into sessao;
  end if;

  insert into public.trip_session_member (session_id, profile_id, added_by)
  select sessao, gente.profile_id, plano.created_by
  from (
    select plano.created_by as profile_id
    union
    select a.profile_id from public.fixture_plan_answer as a
    where a.plan_id = plano.id and a.answer = 'vou'
    union
    select r.driver_id from public.ride as r where r.id = plano.ride_id and r.status = 'open'
    union
    select rp.profile_id from public.ride_passenger as rp
    where rp.ride_id = plano.ride_id and rp.status = 'accepted'
  ) as gente
  where gente.profile_id is not null
  on conflict (session_id, profile_id) do nothing;

  update public.fixture_plan set session_id = sessao
  where id = plano.id and session_id is distinct from sessao;

  perform public.sync_ride_trip_expense(sessao);
  return sessao;
end;
$$;

create function public.open_session_when_plan_closes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'fechado' and old.status is distinct from 'fechado' then
    perform public.ensure_plan_session(new.id);
  end if;
  return null;
end;
$$;

create trigger fixture_plan_opens_session
  after update of status on public.fixture_plan
  for each row execute function public.open_session_when_plan_closes();

-- Os planos que já estavam fechados ficam com a sessão deles.
select public.ensure_plan_session(fp.id) from public.fixture_plan as fp where fp.status = 'fechado';

/** As sessões que estão abertas agora para mim: da véspera (ou dois dias antes) até três dias depois do jogo. */
create function public.my_open_trip_sessions()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.trip_session as s
  join public.fixture as f on f.id = s.fixture_id
  where auth.uid() is not null
    and public.is_trip_member(s.id, auth.uid())
    and now() >= public.trip_session_opens_at(s.fixture_id)
    and now() < f.kickoff_at + interval '3 days'
  order by f.kickoff_at;
$$;

/**
 * O cartão de cada sessão: o jogo, quem vai, quem dá a boleia e a que horas sai, e o dinheiro (total, e o meu saldo).
 * Só as sessões de que a pessoa faz parte.
 */
create function public.trip_session_cards(p_session_ids uuid[])
returns table (
  session_id uuid,
  name text,
  fixture_id text,
  kickoff_at timestamptz,
  opens_at timestamptz,
  plan_id uuid,
  group_id uuid,
  people integer,
  people_names text[],
  ride_id uuid,
  driver_id uuid,
  driver_name text,
  departure_at timestamptz,
  origin_name text,
  i_drive boolean,
  ride_cents integer,
  ride_people integer,
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
    s.id,
    s.name,
    s.fixture_id,
    f.kickoff_at,
    public.trip_session_opens_at(s.fixture_id),
    plano.id,
    coalesce(s.group_id, plano.group_id),
    (select count(*)::integer from public.trip_session_people(s.id)),
    array(
      select perfil.display_name
      from public.trip_session_people(s.id) as pessoa
      join public.profile as perfil on perfil.id = pessoa.profile_id
      order by perfil.display_name
    ),
    r.id,
    r.driver_id,
    condutor.display_name,
    r.departure_at,
    r.origin_name,
    r.driver_id = auth.uid(),
    boleia.cents,
    boleia.pessoas,
    (select count(*)::integer from public.trip_expense as e where e.session_id = s.id),
    coalesce((select sum(e.cents)::integer from public.trip_expense as e where e.session_id = s.id), 0),
    coalesce(
      (select b.balance_cents from public.trip_balances(s.id) as b where b.profile_id = auth.uid()),
      0
    )
  from public.trip_session as s
  join public.fixture as f on f.id = s.fixture_id
  left join lateral (
    select fp.id, fp.group_id, fp.ride_id
    from public.fixture_plan as fp
    where fp.session_id = s.id and fp.status <> 'cancelado'
    order by fp.created_at
    limit 1
  ) as plano on true
  left join public.ride as r on r.id = coalesce(s.ride_id, plano.ride_id) and r.status = 'open'
  left join public.profile as condutor on condutor.id = r.driver_id
  left join lateral (
    select e.cents, (select count(*)::integer from public.trip_expense_share as sh where sh.expense_id = e.id) as pessoas
    from public.trip_expense as e
    where e.session_id = s.id and e.source = 'boleia'
    limit 1
  ) as boleia on true
  where s.id = any (p_session_ids)
    and auth.uid() is not null
    and public.is_trip_member(s.id, auth.uid());
$$;

revoke execute on function public.trip_session_opens_at(text) from public, anon;
revoke execute on function public.ensure_plan_session(uuid) from public, anon, authenticated;
revoke execute on function public.open_session_when_plan_closes() from public, anon, authenticated;
revoke execute on function public.my_open_trip_sessions() from public, anon;
revoke execute on function public.trip_session_cards(uuid[]) from public, anon;
grant execute on function public.trip_session_opens_at(text) to authenticated;
grant execute on function public.my_open_trip_sessions() to authenticated;
grant execute on function public.trip_session_cards(uuid[]) to authenticated;
