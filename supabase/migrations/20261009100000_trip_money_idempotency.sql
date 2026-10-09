-- Idempotency for the two money writes of the trip accounts: adding an expense and recording a payment.
--
-- A retry after a timeout (the first call went through, the answer got lost) used to write the same expense or the
-- same payment twice. Now the app sends a client_id (a random uuid made once per form) and the server writes at most
-- one row per (session, client_id). Calling again with the same client_id gives back the id of the row already there,
-- without checking or charging anything else, so a retry never fails on rules that the first call already changed
-- (for example "more_than_owed" right after the payment went in).
--
-- A client_id belongs to whoever used it first: someone else in the session sending the same value is refused with
-- 'duplicate_request' and never learns the row's id. client_id stays optional, so old app versions keep working
-- (without the protection).
--
-- The signatures change, so the old functions are dropped and the new ones granted to signed-in people only.

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Columns and indexes.

alter table public.trip_expense add column client_id uuid;
alter table public.trip_settlement add column client_id uuid;

create unique index trip_expense_client_id_key
  on public.trip_expense (session_id, client_id) where client_id is not null;
create unique index trip_settlement_client_id_key
  on public.trip_settlement (session_id, client_id) where client_id is not null;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. add_trip_expense: every check of 20261008 ('not_involved' included), plus p_client_id.

drop function public.add_trip_expense(uuid, text, text, integer, uuid, uuid[]);

create function public.add_trip_expense(
  p_session_id uuid,
  p_description text,
  p_category text,
  p_cents integer,
  p_payer_id uuid default null,
  p_participants uuid[] default null,
  p_client_id uuid default null
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
  autor uuid;
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

  -- A retry of a call that already went through gets the same expense back.
  if p_client_id is not null then
    select e.id, e.created_by into nova, autor
    from public.trip_expense as e
    where e.session_id = p_session_id and e.client_id = p_client_id;
    if nova is not null then
      if autor is distinct from caller then
        raise exception 'duplicate_request' using errcode = '22023';
      end if;
      return nova;
    end if;
  end if;

  quem := coalesce(p_payer_id, caller);
  if not public.is_trip_member(p_session_id, quem) then
    raise exception 'payer_not_member' using errcode = '22023';
  end if;

  -- Without a list, everyone in the trip is in: the usual round of drinks.
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
  -- Who records an expense paid it or is in it: nobody charges the others for something they were not part of.
  if quem <> caller and not (caller = any (gente)) then
    raise exception 'not_involved' using errcode = '42501';
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

  insert into public.trip_expense (session_id, payer_id, description, category, cents, created_by, client_id)
  values (p_session_id, quem, btrim(p_description), p_category, p_cents, caller, p_client_id)
  on conflict (session_id, client_id) where client_id is not null do nothing
  returning id into nova;

  -- Two identical calls at the same moment: the other one wrote it; answer as a retry would.
  if nova is null then
    select e.id, e.created_by into nova, autor
    from public.trip_expense as e
    where e.session_id = p_session_id and e.client_id = p_client_id;
    if autor is distinct from caller then
      raise exception 'duplicate_request' using errcode = '22023';
    end if;
    return nova;
  end if;

  insert into public.trip_expense_share (expense_id, profile_id)
  select distinct nova, pessoa.id from unnest(gente) as pessoa(id);

  return nova;
end;
$$;

revoke all on function public.add_trip_expense(uuid, text, text, integer, uuid, uuid[], uuid) from public, anon;
grant execute on function public.add_trip_expense(uuid, text, text, integer, uuid, uuid[], uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. add_trip_settlement: the same checks as before, plus p_client_id. The retry answer comes before the "how much
-- is owed" checks on purpose: right after the first call those would refuse the very payment that went in.

drop function public.add_trip_settlement(uuid, uuid, integer, uuid);

create function public.add_trip_settlement(
  p_session_id uuid,
  p_to_profile_id uuid,
  p_cents integer,
  p_from_profile_id uuid default null,
  p_client_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  de uuid;
  deve integer;
  recebe integer;
  novo uuid;
  autor uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.is_trip_member(p_session_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;

  if p_client_id is not null then
    select s.id, s.created_by into novo, autor
    from public.trip_settlement as s
    where s.session_id = p_session_id and s.client_id = p_client_id;
    if novo is not null then
      if autor is distinct from caller then
        raise exception 'duplicate_request' using errcode = '22023';
      end if;
      return novo;
    end if;
  end if;

  de := coalesce(p_from_profile_id, caller);
  if de <> caller and p_to_profile_id <> caller then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  if de = p_to_profile_id then
    raise exception 'bad_settlement' using errcode = '22023';
  end if;
  -- Who left the group stays in the accounts, so who counts is who is there and who shows up in the expenses.
  if not exists (select 1 from public.trip_balances(p_session_id) as b where b.profile_id = de)
     or not exists (
       select 1 from public.trip_balances(p_session_id) as b where b.profile_id = p_to_profile_id
     ) then
    raise exception 'not_in_trip' using errcode = '22023';
  end if;
  if p_cents is null or p_cents < 1 or p_cents > 1000000 then
    raise exception 'bad_settlement' using errcode = '22023';
  end if;
  -- What the payer records counts before the other confirms, so it can never be more than they owe: otherwise
  -- "paguei 10 000 €" would turn a debt around.
  if caller = de and caller <> p_to_profile_id then
    select -b.balance_cents into deve from public.trip_balances(p_session_id) as b where b.profile_id = de;
    select b.balance_cents into recebe from public.trip_balances(p_session_id) as b where b.profile_id = p_to_profile_id;
    if coalesce(deve, 0) <= 0 or coalesce(recebe, 0) <= 0 then
      raise exception 'nothing_owed' using errcode = '22023';
    end if;
    if p_cents > least(deve, recebe) then
      raise exception 'more_than_owed' using errcode = '22023';
    end if;
  end if;
  if not public.take_rate_limit(caller, 'trip-settlement', 40, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.trip_settlement (
    session_id, from_profile_id, to_profile_id, cents, created_by, confirmed_at, confirmed_by, client_id
  )
  values (
    p_session_id, de, p_to_profile_id, p_cents, caller,
    case when caller = p_to_profile_id then now() end,
    case when caller = p_to_profile_id then caller end,
    p_client_id
  )
  on conflict (session_id, client_id) where client_id is not null do nothing
  returning id into novo;

  if novo is null then
    select s.id, s.created_by into novo, autor
    from public.trip_settlement as s
    where s.session_id = p_session_id and s.client_id = p_client_id;
    if autor is distinct from caller then
      raise exception 'duplicate_request' using errcode = '22023';
    end if;
  end if;

  return novo;
end;
$$;

revoke all on function public.add_trip_settlement(uuid, uuid, integer, uuid, uuid) from public, anon;
grant execute on function public.add_trip_settlement(uuid, uuid, integer, uuid, uuid) to authenticated, service_role;
