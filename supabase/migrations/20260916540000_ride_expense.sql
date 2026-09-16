-- A boleia entra nas contas como despesa.
--
-- A boleia já tinha a conta dela (combustível + portagens, dividido por quem vai no carro) e as contas da viagem
-- tinham a delas. Resultado: quem abria as contas via o jantar e as cervejas, mas não via a viagem — e se alguém
-- lançasse «portagens» à mão, ficava a pagar duas vezes.
--
-- Agora, ao abrir as contas de uma boleia, entra logo uma despesa com o custo que ficou definido quando a boleia foi
-- publicada: **quem pagou é o condutor** e **entra quem vai no carro**. É a mesma divisão que a boleia já fazia, mas
-- agora está à vista ao lado de tudo o resto, e conta para o «quem paga a quem».
--
-- Esta despesa não se escreve à mão nem se apaga: **segue o carro**. Sempre que entra ou sai gente, é refeita — o
-- valor é o da boleia e as pessoas são as que lá vão nesse momento.

alter table public.trip_expense
  add column source text not null default 'manual' check (source in ('manual', 'boleia'));

-- Uma despesa da boleia por sessão, e só uma.
create unique index trip_expense_ride_idx
  on public.trip_expense (session_id) where source = 'boleia';

/** Põe (ou refaz) a despesa da boleia nestas contas. Não faz nada nas contas de um grupo. */
create function public.sync_ride_trip_expense(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  boleia public.ride;
  condutor text;
  despesa uuid;
begin
  select r.* into boleia
  from public.trip_session as s
  join public.ride as r on r.id = s.ride_id
  where s.id = p_session_id;

  if boleia.id is null or boleia.total_cents < 1 then
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

  -- Quem vai no carro agora: nem quem saiu fica a pagar, nem quem entrou fica de fora.
  delete from public.trip_expense_share as sh
  where sh.expense_id = despesa
    and sh.profile_id not in (
      select pessoa.profile_id from public.trip_session_people(p_session_id) as pessoa
    );

  insert into public.trip_expense_share (expense_id, profile_id)
  select despesa, pessoa.profile_id
  from public.trip_session_people(p_session_id) as pessoa
  on conflict (expense_id, profile_id) do nothing;
end;
$$;

-- Abrir as contas de uma boleia passa a trazer a boleia lá dentro.
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
  if boleia.driver_id <> caller and not exists (
    select 1 from public.ride_passenger as rp
    where rp.ride_id = p_ride_id and rp.profile_id = caller and rp.status = 'accepted'
  ) then
    raise exception 'not_in_ride' using errcode = '42501';
  end if;

  insert into public.trip_session (ride_id, fixture_id, opened_by)
  values (p_ride_id, boleia.fixture_id, caller)
  on conflict (ride_id) where ride_id is not null do update set updated_at = now()
  returning id into sessao;

  perform public.sync_ride_trip_expense(sessao);
  return sessao;
end;
$$;

/** As contas de uma boleia, se existirem. Sem uma linha `select`, o Postgres não deixa chamar isto num `perform`. */
create function public.ride_session_id(p_ride_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.trip_session as s where s.ride_id = p_ride_id;
$$;

-- Quando o condutor responde a um pedido, o carro muda — e a despesa da boleia com ele.
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
    perform public.sync_ride_trip_expense(sessao);
  end if;
end;
$$;

-- Sair do carro também muda as contas: quem sai deixa de pagar a boleia.
create or replace function public.leave_ride(p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sessao uuid;
begin
  update public.ride_passenger as rp
  set
    status = case
      when rp.status = 'accepted' and now() >= public.ride_requests_close_at(r.departure_at) then 'left_late'
      else 'left'
    end,
    left_at = now()
  from public.ride as r
  where r.id = rp.ride_id
    and rp.ride_id = p_ride_id
    and rp.profile_id = auth.uid()
    and rp.status in ('requested', 'accepted');

  sessao := public.ride_session_id(p_ride_id);
  if sessao is not null then
    perform public.sync_ride_trip_expense(sessao);
  end if;
end;
$$;

-- Entrar por convite de um amigo idem.
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
    perform public.sync_ride_trip_expense(sessao);
  end if;
end;
$$;

-- A despesa da boleia não se apaga à mão: ela segue o carro.
create or replace function public.remove_trip_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.trip_expense where id = p_expense_id and source = 'boleia') then
    raise exception 'ride_expense' using errcode = '22023';
  end if;
  delete from public.trip_expense
  where id = p_expense_id and (created_by = auth.uid() or payer_id = auth.uid());
  if not found then
    raise exception 'not_yours' using errcode = '42501';
  end if;
end;
$$;

-- A lista de despesas passa a dizer quais vêm da boleia.
drop function public.trip_expenses(uuid);

create function public.trip_expenses(p_session_id uuid)
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
  source text,
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
    e.source = 'manual' and (e.created_by = auth.uid() or e.payer_id = auth.uid()),
    e.source,
    e.created_at::date
  from public.trip_expense as e
  join public.profile as quem on quem.id = e.payer_id
  where e.session_id = p_session_id and public.is_trip_member(p_session_id, auth.uid())
  order by e.created_at desc;
$$;

revoke execute on function public.sync_ride_trip_expense(uuid) from public, anon, authenticated;
revoke execute on function public.ride_session_id(uuid) from public, anon, authenticated;
revoke execute on function public.trip_expenses(uuid) from public, anon;
grant execute on function public.trip_expenses(uuid) to authenticated;
