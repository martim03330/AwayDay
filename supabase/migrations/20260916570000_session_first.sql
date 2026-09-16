-- A sessão passa a ser a coisa principal: abre-se uma vez, tem nome, tem gente, e é lá que estão as contas.
--
-- O grupo e a boleia passam a ser **maneiras de começar**: abrir as contas a partir da boleia traz a malta do carro
-- (e a despesa da boleia); a partir de um grupo traz a malta do grupo; e também se pode abrir sem nada e ir
-- acrescentando gente. Depois de abertas, as contas são das pessoas que lá estão — não do grupo nem do carro.
--
-- A lista só é preenchida **quando as contas nascem**. Reabrir não volta a meter lá quem foi tirado de propósito.

-- A despesa da boleia divide-se por quem vai no carro **e** está nas contas: um amigo que foi noutro carro entra nas
-- contas do jantar, mas não paga a gasolina desta.
create or replace function public.sync_ride_trip_expense(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  boleia public.ride;
  condutor text;
  despesa uuid;
  quantos integer;
begin
  select r.* into boleia
  from public.trip_session as s
  join public.ride as r on r.id = s.ride_id
  where s.id = p_session_id;

  if boleia.id is null or boleia.total_cents < 1 then
    return;
  end if;

  select count(*) into quantos
  from public.trip_session_member as m
  where m.session_id = p_session_id and public.in_ride(boleia.id, m.profile_id);
  if quantos = 0 then
    delete from public.trip_expense where session_id = p_session_id and source = 'boleia';
    return;
  end if;

  select p.display_name into condutor from public.profile as p where p.id = boleia.driver_id;

  insert into public.trip_expense (
    session_id, payer_id, description, category, cents, created_by, source
  )
  values (
    p_session_id,
    boleia.driver_id,
    left('Boleia de ' || coalesce(condutor, 'um adepto'), 80),
    'boleia',
    boleia.total_cents,
    boleia.driver_id,
    'boleia'
  )
  on conflict (session_id) where source = 'boleia'
  do update set
    cents = excluded.cents,
    payer_id = excluded.payer_id,
    description = excluded.description
  returning id into despesa;

  delete from public.trip_expense_share as sh
  where sh.expense_id = despesa
    and sh.profile_id not in (
      select m.profile_id
      from public.trip_session_member as m
      where m.session_id = p_session_id and public.in_ride(boleia.id, m.profile_id)
    );

  insert into public.trip_expense_share (expense_id, profile_id)
  select despesa, m.profile_id
  from public.trip_session_member as m
  where m.session_id = p_session_id and public.in_ride(boleia.id, m.profile_id)
  on conflict (expense_id, profile_id) do nothing;
end;
$$;

-- Abrir as contas a partir de um grupo: traz a malta do grupo, uma vez.
create or replace function public.open_trip_session(p_group_id uuid, p_fixture_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  sessao uuid;
  nome text;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.is_group_member(p_group_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if not exists (select 1 from public.fixture where id = p_fixture_id) then
    raise exception 'fixture_not_found' using errcode = 'P0002';
  end if;

  select g.name into nome from public.fan_group as g where g.id = p_group_id;

  insert into public.trip_session (group_id, fixture_id, opened_by, name)
  values (p_group_id, p_fixture_id, caller, left(coalesce(nome, 'Contas da viagem'), 60))
  on conflict (group_id, fixture_id) do update set updated_at = now()
  returning id into sessao;

  if not exists (select 1 from public.trip_session_member where session_id = sessao) then
    insert into public.trip_session_member (session_id, profile_id, added_by)
    select sessao, m.profile_id, caller
    from public.fan_group_member as m
    where m.group_id = p_group_id
    on conflict (session_id, profile_id) do nothing;
  end if;

  return sessao;
end;
$$;

-- Abrir as contas a partir de uma boleia: traz a malta do carro e a despesa da boleia.
create or replace function public.open_ride_trip_session(p_ride_id uuid)
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
  if not public.in_ride(p_ride_id, caller) then
    raise exception 'not_in_ride' using errcode = '42501';
  end if;

  insert into public.trip_session (ride_id, fixture_id, opened_by, name)
  values (p_ride_id, boleia.fixture_id, caller, 'Contas da viagem')
  on conflict (ride_id) where ride_id is not null do update set updated_at = now()
  returning id into sessao;

  if not exists (select 1 from public.trip_session_member where session_id = sessao) then
    insert into public.trip_session_member (session_id, profile_id, added_by)
    values (sessao, boleia.driver_id, caller)
    on conflict (session_id, profile_id) do nothing;
    insert into public.trip_session_member (session_id, profile_id, added_by)
    select sessao, rp.profile_id, caller
    from public.ride_passenger as rp
    where rp.ride_id = p_ride_id and rp.status = 'accepted'
    on conflict (session_id, profile_id) do nothing;
  end if;

  perform public.sync_ride_trip_expense(sessao);
  return sessao;
end;
$$;

-- Abrir as contas sem grupo nem boleia: começa só contigo, e acrescentas quem foi.
create function public.start_trip_session(p_fixture_id text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  sessao uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.fixture where id = p_fixture_id) then
    raise exception 'fixture_not_found' using errcode = 'P0002';
  end if;
  if not public.take_rate_limit(caller, 'trip-session', 10, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.trip_session (fixture_id, opened_by, name)
  values (
    p_fixture_id,
    caller,
    left(coalesce(nullif(btrim(coalesce(p_name, '')), ''), 'Contas da viagem'), 60)
  )
  returning id into sessao;

  insert into public.trip_session_member (session_id, profile_id, added_by)
  values (sessao, caller, caller);

  return sessao;
end;
$$;

create function public.rename_trip_session(p_session_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_trip_member(p_session_id, auth.uid()) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 60 then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  update public.trip_session set name = btrim(p_name) where id = p_session_id;
end;
$$;

-- Quem entra no carro entra nas contas, se elas já estiverem abertas.
create or replace function public.answer_ride_request(p_ride_id uuid, p_profile_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.ride;
  taken integer;
  sessao uuid;
begin
  select * into target from public.ride where id = p_ride_id for update;
  if target.id is null or target.driver_id is distinct from auth.uid() then
    raise exception 'not_driver' using errcode = '42501';
  end if;
  if target.status <> 'open' or now() >= public.ride_requests_close_at(target.departure_at) then
    raise exception 'ride_closed' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.ride_passenger
    where ride_id = p_ride_id and profile_id = p_profile_id and status = 'requested'
  ) then
    raise exception 'no_request' using errcode = 'P0002';
  end if;
  if p_accept then
    select count(*) into taken from public.ride_passenger where ride_id = p_ride_id and status = 'accepted';
    if taken >= target.seats_offered then
      raise exception 'ride_full' using errcode = '22023';
    end if;
  end if;
  update public.ride_passenger
  set status = case when p_accept then 'accepted' else 'declined' end
  where ride_id = p_ride_id and profile_id = p_profile_id;

  sessao := public.ride_session_id(p_ride_id);
  if sessao is not null then
    if p_accept then
      insert into public.trip_session_member (session_id, profile_id, added_by)
      values (sessao, p_profile_id, auth.uid())
      on conflict (session_id, profile_id) do nothing;
    end if;
    perform public.sync_ride_trip_expense(sessao);
  end if;
end;
$$;

create or replace function public.accept_ride_invite(p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  boleia public.ride;
  ocupados integer;
  sessao uuid;
begin
  select * into boleia from public.ride where id = p_ride_id for update;
  if not exists (
    select 1 from public.ride_invite where ride_id = p_ride_id and profile_id = caller
  ) then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  if boleia.status <> 'open' then
    raise exception 'ride_closed' using errcode = '22023';
  end if;

  select count(*) into ocupados
  from public.ride_passenger as rp
  where rp.ride_id = p_ride_id and rp.status = 'accepted';
  if ocupados >= boleia.seats_offered then
    raise exception 'ride_full' using errcode = '22023';
  end if;

  insert into public.ride_passenger (ride_id, profile_id, status)
  values (p_ride_id, caller, 'accepted')
  on conflict (ride_id, profile_id) do update set status = 'accepted';

  delete from public.ride_invite where ride_id = p_ride_id and profile_id = caller;

  sessao := public.ride_session_id(p_ride_id);
  if sessao is not null then
    insert into public.trip_session_member (session_id, profile_id, added_by)
    values (sessao, caller, caller)
    on conflict (session_id, profile_id) do nothing;
    perform public.sync_ride_trip_expense(sessao);
  end if;
end;
$$;

-- As contas deste jogo em que entro: já não são «do grupo» nem «da boleia», são as contas onde estou.
drop function public.my_trip_accounts(text);

create function public.my_trip_accounts(p_fixture_id text)
returns table (
  session_id uuid,
  name text,
  origin text,
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
    s.id,
    coalesce(s.name, 'Contas da viagem'),
    case when s.ride_id is not null then 'boleia'
         when s.group_id is not null then 'grupo'
         else 'avulso' end,
    (select count(*)::integer from public.trip_session_member as m where m.session_id = s.id),
    array(
      select p.display_name
      from public.trip_session_member as m
      join public.profile as p on p.id = m.profile_id
      where m.session_id = s.id
      order by p.display_name
    ),
    coalesce((select count(*)::integer from public.trip_expense as e where e.session_id = s.id), 0),
    coalesce((select sum(e.cents)::integer from public.trip_expense as e where e.session_id = s.id), 0),
    coalesce(
      (select b.balance_cents from public.trip_balances(s.id) as b where b.profile_id = auth.uid()),
      0
    )
  from public.trip_session as s
  where s.fixture_id = p_fixture_id and public.is_trip_member(s.id, auth.uid())
  order by s.created_at;
$$;

/** Por onde se pode começar as contas deste jogo: pela boleia, por um grupo, ou do zero. */
create function public.trip_start_options(p_fixture_id text)
returns table (kind text, id uuid, title text, people integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    'boleia',
    r.id,
    case when r.driver_id = auth.uid() then 'A tua boleia'
         else 'Boleia de ' || condutor.display_name end,
    1 + (select count(*)::integer from public.ride_passenger as rp
         where rp.ride_id = r.id and rp.status = 'accepted')
  from public.ride as r
  join public.profile as condutor on condutor.id = r.driver_id
  where r.fixture_id = p_fixture_id
    and r.status = 'open'
    and public.in_ride(r.id, auth.uid())
    and not exists (select 1 from public.trip_session as s where s.ride_id = r.id)
  union all
  select
    'grupo',
    g.id,
    g.name,
    (select count(*)::integer from public.fan_group_member as fm where fm.group_id = g.id)
  from public.fan_group_member as m
  join public.fan_group as g on g.id = m.group_id
  where m.profile_id = auth.uid()
    and not exists (
      select 1 from public.trip_session as s
      where s.group_id = g.id and s.fixture_id = p_fixture_id
    );
$$;

revoke execute on function public.start_trip_session(text, text) from public, anon;
revoke execute on function public.rename_trip_session(uuid, text) from public, anon;
revoke execute on function public.my_trip_accounts(text) from public, anon;
revoke execute on function public.trip_start_options(text) from public, anon;
grant execute on function public.start_trip_session(text, text) to authenticated;
grant execute on function public.rename_trip_session(uuid, text) to authenticated;
grant execute on function public.my_trip_accounts(text) to authenticated;
grant execute on function public.trip_start_options(text) to authenticated;
