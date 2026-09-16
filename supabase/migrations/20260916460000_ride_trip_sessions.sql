-- As contas também nascem de uma boleia, sem criar grupo nenhum.
--
-- Um grupo é malta que anda junta de jogo para jogo; uma boleia é um dia. Se cada viagem criasse um grupo, ao fim de
-- uma época havia trinta grupos mortos. Por isso a sessão de contas passa a poder viver agarrada a **uma boleia**:
-- as pessoas das contas são as do carro (o condutor e quem foi aceite), e acabou.
--
-- Uma sessão tem sempre um dono e só um: ou um grupo (e um jogo), ou uma boleia.
--
-- Quem entra nas contas deixa de ser «quem é do grupo» e passa a ser `trip_session_people`, que responde às duas
-- situações. Todas as funções das contas passam a perguntar por aí.

alter table public.trip_session alter column group_id drop not null;

alter table public.trip_session
  add column ride_id uuid references public.ride (id) on delete cascade;

alter table public.trip_session
  add constraint trip_session_owner check (num_nonnulls(group_id, ride_id) = 1);

-- Uma boleia tem uma conta só (e a boleia já é de um jogo).
create unique index trip_session_ride_idx on public.trip_session (ride_id) where ride_id is not null;

/** Quem entra nestas contas: os do grupo, ou os do carro. */
create function public.trip_session_people(p_session_id uuid)
returns table (profile_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select m.profile_id
  from public.trip_session as s
  join public.fan_group_member as m on m.group_id = s.group_id
  where s.id = p_session_id
  union
  select r.driver_id
  from public.trip_session as s
  join public.ride as r on r.id = s.ride_id
  where s.id = p_session_id
  union
  select rp.profile_id
  from public.trip_session as s
  join public.ride_passenger as rp on rp.ride_id = s.ride_id and rp.status = 'accepted'
  where s.id = p_session_id;
$$;

create function public.is_trip_member(p_session_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile_id is not null and exists (
    select 1 from public.trip_session_people(p_session_id) as pessoa
    where pessoa.profile_id = p_profile_id
  );
$$;

-- Abrir as contas de uma boleia. Qualquer pessoa do carro; não cria grupo nenhum.
create function public.open_ride_trip_session(p_ride_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  boleia public.ride;
  sessao uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select * into boleia from public.ride where id = p_ride_id;
  if boleia.id is null then
    raise exception 'ride_not_found' using errcode = 'P0002';
  end if;
  if boleia.driver_id <> caller and not exists (
    select 1 from public.ride_passenger as rp
    where rp.ride_id = p_ride_id and rp.profile_id = caller and rp.status = 'accepted'
  ) then
    raise exception 'not_in_ride' using errcode = '42501';
  end if;

  insert into public.trip_session (ride_id, fixture_id, opened_by)
  values (p_ride_id, boleia.fixture_id, caller)
  on conflict (ride_id) do update set updated_at = now()
  returning id into sessao;

  return sessao;
end;
$$;

-- As pessoas destas contas, com nome. Serve o ecrã: quem pagou, e quem entra em cada despesa.
create function public.trip_people(p_session_id uuid)
returns table (profile_id uuid, display_name text, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select pessoa.profile_id, p.display_name, pessoa.profile_id = auth.uid()
  from public.trip_session_people(p_session_id) as pessoa
  join public.profile as p on p.id = pessoa.profile_id
  where public.is_trip_member(p_session_id, auth.uid())
  order by p.display_name;
$$;

-- As contas de uma boleia, se já existirem.
create function public.ride_trip_session(p_ride_id uuid)
returns table (id uuid, fixture_id text, expenses integer, total_cents integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.fixture_id,
    (select count(*)::integer from public.trip_expense as e where e.session_id = s.id),
    coalesce((select sum(e.cents)::integer from public.trip_expense as e where e.session_id = s.id), 0)
  from public.trip_session as s
  where s.ride_id = p_ride_id and public.is_trip_member(s.id, auth.uid());
$$;

-- Quem manda nas contas passa a ser quem está nelas, não quem está no grupo.
create or replace function public.add_trip_expense(
  p_session_id uuid,
  p_description text,
  p_category text,
  p_cents integer,
  p_payer_id uuid default null,
  p_participants uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  quem uuid;
  gente uuid[];
  nova uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.trip_session where id = p_session_id) then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;
  if not public.is_trip_member(p_session_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;

  quem := coalesce(p_payer_id, caller);
  if not public.is_trip_member(p_session_id, quem) then
    raise exception 'payer_not_member' using errcode = '22023';
  end if;

  -- Sem lista, entra toda a gente da viagem: é o caso normal de uma rodada.
  gente := coalesce(
    p_participants,
    array(select pessoa.profile_id from public.trip_session_people(p_session_id) as pessoa)
  );
  if array_length(gente, 1) is null then
    raise exception 'no_participants' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(gente) as pessoa(id)
    where not public.is_trip_member(p_session_id, pessoa.id)
  ) then
    raise exception 'participant_not_member' using errcode = '22023';
  end if;

  if p_cents is null or p_cents < 1 or p_cents > 1000000
    or char_length(btrim(coalesce(p_description, ''))) < 2
    or char_length(btrim(p_description)) > 80
    or p_category not in ('cerveja', 'petiscos', 'refeicao', 'bilhetes', 'casa', 'boleia', 'portagens', 'outro') then
    raise exception 'bad_expense' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'trip-expense', 60, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.trip_expense (session_id, payer_id, description, category, cents, created_by)
  values (p_session_id, quem, btrim(p_description), p_category, p_cents, caller)
  returning id into nova;

  insert into public.trip_expense_share (expense_id, profile_id)
  select distinct nova, pessoa.id from unnest(gente) as pessoa(id);

  return nova;
end;
$$;

create or replace function public.trip_expenses(p_session_id uuid)
returns table (
  id uuid,
  description text,
  category text,
  cents integer,
  payer_id uuid,
  payer_name text,
  participants integer,
  participant_names text[],
  i_am_in boolean,
  mine boolean,
  created_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    e.description,
    e.category,
    e.cents,
    e.payer_id,
    quem.display_name,
    (select count(*)::integer from public.trip_expense_share as sh where sh.expense_id = e.id),
    array(
      select p.display_name
      from public.trip_expense_share as sh
      join public.profile as p on p.id = sh.profile_id
      where sh.expense_id = e.id
      order by p.display_name
    ),
    exists (
      select 1 from public.trip_expense_share as sh
      where sh.expense_id = e.id and sh.profile_id = auth.uid()
    ),
    e.created_by = auth.uid() or e.payer_id = auth.uid(),
    e.created_at::date
  from public.trip_expense as e
  join public.profile as quem on quem.id = e.payer_id
  where e.session_id = p_session_id and public.is_trip_member(p_session_id, auth.uid())
  order by e.created_at desc;
$$;

create or replace function public.trip_balances(p_session_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  paid_cents integer,
  owed_cents integer,
  balance_cents integer,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with permissao as (
    select s.id
    from public.trip_session as s
    where s.id = p_session_id and public.is_trip_member(s.id, auth.uid())
  ),
  envolvidos as (
    select pessoa.profile_id
    from permissao
    cross join lateral public.trip_session_people(permissao.id) as pessoa
    union
    select e.payer_id
    from public.trip_expense as e
    join permissao as p on p.id = e.session_id
    union
    select sh.profile_id
    from public.trip_expense_share as sh
    join public.trip_expense as e on e.id = sh.expense_id
    join permissao as p on p.id = e.session_id
  ),
  partes as (
    select
      sh.profile_id,
      e.cents / contagem.n
        + case when row_number() over (partition by e.id order by sh.profile_id) <= e.cents % contagem.n
            then 1 else 0 end as parte
    from public.trip_expense as e
    join permissao as p on p.id = e.session_id
    join public.trip_expense_share as sh on sh.expense_id = e.id
    cross join lateral (
      select count(*)::integer as n from public.trip_expense_share as x where x.expense_id = e.id
    ) as contagem
  ),
  pagou as (
    select e.payer_id as profile_id, sum(e.cents)::integer as total
    from public.trip_expense as e
    join permissao as p on p.id = e.session_id
    group by e.payer_id
  ),
  deve as (
    select p.profile_id, sum(p.parte)::integer as total
    from partes as p
    group by p.profile_id
  )
  select
    quem.profile_id,
    pr.display_name,
    coalesce(pagou.total, 0),
    coalesce(deve.total, 0),
    coalesce(pagou.total, 0) - coalesce(deve.total, 0),
    quem.profile_id = auth.uid()
  from envolvidos as quem
  join public.profile as pr on pr.id = quem.profile_id
  left join pagou on pagou.profile_id = quem.profile_id
  left join deve on deve.profile_id = quem.profile_id
  order by (coalesce(pagou.total, 0) - coalesce(deve.total, 0)) desc, pr.display_name;
$$;

/**
 * A viagem que está a acontecer agora: a boleia em que vou (ou que conduzo), desde uma hora antes de sair até ao dia
 * seguinte ao jogo. É o que a app mostra logo na primeira página, para a malta ir lançando o que vai pagando em vez
 * de tentar lembrar-se de tudo no fim.
 */
create function public.my_live_trips()
returns table (
  ride_id uuid,
  fixture_id text,
  kickoff_at timestamptz,
  departure_at timestamptz,
  driver_name text,
  people integer,
  people_names text[],
  i_drive boolean,
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
    r.id,
    r.fixture_id,
    f.kickoff_at,
    r.departure_at,
    condutor.display_name,
    1 + (select count(*)::integer from public.ride_passenger as rp
         where rp.ride_id = r.id and rp.status = 'accepted'),
    array[condutor.display_name] || array(
      select p.display_name
      from public.ride_passenger as rp
      join public.profile as p on p.id = rp.profile_id
      where rp.ride_id = r.id and rp.status = 'accepted'
      order by p.display_name
    ),
    r.driver_id = auth.uid(),
    s.id,
    coalesce((select count(*)::integer from public.trip_expense as e where e.session_id = s.id), 0),
    coalesce((select sum(e.cents)::integer from public.trip_expense as e where e.session_id = s.id), 0),
    coalesce(
      (select b.balance_cents from public.trip_balances(s.id) as b where b.profile_id = auth.uid()),
      0
    )
  from public.ride as r
  join public.fixture as f on f.id = r.fixture_id
  join public.profile as condutor on condutor.id = r.driver_id
  left join public.trip_session as s on s.ride_id = r.id
  where auth.uid() is not null
    and r.status = 'open'
    and (
      r.driver_id = auth.uid()
      or exists (
        select 1 from public.ride_passenger as rp
        where rp.ride_id = r.id and rp.profile_id = auth.uid() and rp.status = 'accepted'
      )
    )
    and now() between r.departure_at - interval '1 hour' and f.kickoff_at + interval '24 hours'
  order by r.departure_at;
$$;

/**
 * As contas deste jogo que me dizem respeito: as dos meus grupos e as das boleias em que vou. Substitui
 * `my_trip_sessions`, que só sabia de grupos.
 */
drop function if exists public.my_trip_sessions(text);

create function public.my_trip_accounts(p_fixture_id text)
returns table (
  kind text,
  owner_id uuid,
  title text,
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
    'grupo',
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
  union all
  select
    'boleia',
    r.id,
    case when r.driver_id = auth.uid() then 'A tua boleia'
         else 'Boleia de ' || condutor.display_name end,
    s.id,
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

revoke execute on function public.trip_session_people(uuid) from public, anon, authenticated;
revoke execute on function public.is_trip_member(uuid, uuid) from public, anon;
revoke execute on function public.open_ride_trip_session(uuid) from public, anon;
revoke execute on function public.trip_people(uuid) from public, anon;
revoke execute on function public.ride_trip_session(uuid) from public, anon;
revoke execute on function public.my_live_trips() from public, anon;
revoke execute on function public.my_trip_accounts(text) from public, anon;
grant execute on function public.is_trip_member(uuid, uuid) to authenticated;
grant execute on function public.open_ride_trip_session(uuid) to authenticated;
grant execute on function public.trip_people(uuid) to authenticated;
grant execute on function public.ride_trip_session(uuid) to authenticated;
grant execute on function public.my_live_trips() to authenticated;
grant execute on function public.my_trip_accounts(text) to authenticated;
