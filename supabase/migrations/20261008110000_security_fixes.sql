-- Fixes from the security review of 2026-10-08 (docs/DECISOES.md has the reasons).
--
-- 1. Plans: a plan creator could attach a stranger's ride or house, join it without the driver's or owner's consent
--    and land in that ride's trip accounts. Now the driver / owner must be in the plan (see it), at attach and at join
--    time, and the plan session only takes over a ride's session when that holds.
-- 2. ride_board: the exact start point only for the driver and accepted passengers; everyone else gets it rounded to
--    about 1 km.
-- 3. profile_cards and avatars: only people you have a reason to see (crossed paths, a driver with an open ride, a
--    plan you can see), never someone who blocked you. The avatars bucket can no longer be listed.
-- 4. Money: a settlement the payer records cannot exceed what they owe; a confirmed one can only be undone by the
--    payer. An expense needs the caller as payer or participant. Only the opener (or the driver) removes others or
--    the session.
-- 5. Group photos: only the uploader or the group owner replaces or deletes a file.
-- 6. Place pulse: only accounts at least 3 days old count, totals round down to multiples of 5, and the aggregate is
--    refreshed by the 5-minute job only (not on every check-in), so fake accounts cannot single someone out.
-- 7. House links: only Airbnb and Booking addresses.
-- 8. AI spend: an append-only ledger with no link to profile, so deleting an account no longer erases its spend.

-- 1. Plans ----------------------------------------------------------------------------------------------------------

create or replace function public.set_fixture_plan_ride(p_plan_id uuid, p_ride_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
  boleia public.ride;
begin
  select * into plano from public.fixture_plan where id = p_plan_id for update;
  if plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.status = 'cancelado' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;

  if p_ride_id is null then
    if plano.created_by is distinct from caller and not exists (
      select 1 from public.ride as r where r.id = plano.ride_id and r.driver_id = caller
    ) then
      raise exception 'not_owner' using errcode = '42501';
    end if;
    update public.fixture_plan set ride_id = null, updated_at = now() where id = p_plan_id;
    return;
  end if;

  select * into boleia from public.ride where id = p_ride_id;
  if boleia.id is null or boleia.status <> 'open' or boleia.fixture_id <> plano.fixture_id then
    raise exception 'ride_not_found' using errcode = 'P0002';
  end if;
  if plano.created_by is distinct from caller and boleia.driver_id is distinct from caller then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  -- The car must be of someone in the plan: nobody fills a stranger's seats through a plan.
  if not public.can_see_fixture_plan(p_plan_id, boleia.driver_id) then
    raise exception 'driver_not_in_plan' using errcode = '42501';
  end if;
  update public.fixture_plan set ride_id = p_ride_id, updated_at = now() where id = p_plan_id;
  perform public.close_plans_with_full_ride(p_ride_id);
end;
$$;

create or replace function public.join_plan_ride(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
  boleia public.ride;
begin
  select * into plano from public.fixture_plan where id = p_plan_id;
  if caller is null or plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.status = 'cancelado' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;
  if public.ride_ban_until(caller) is not null then
    raise exception 'suspended' using errcode = '22023';
  end if;
  if public.closed_plan_elsewhere(p_plan_id, caller) is not null then
    raise exception 'already_going' using errcode = '22023';
  end if;

  select * into boleia from public.ride where id = plano.ride_id for update;
  if boleia.id is null or boleia.status <> 'open' then
    raise exception 'ride_not_found' using errcode = 'P0002';
  end if;
  if boleia.driver_id = caller then
    raise exception 'own_ride' using errcode = '22023';
  end if;
  -- Joining without asking is only for the car of someone in the plan (they may have left the group since).
  if not public.can_see_fixture_plan(p_plan_id, boleia.driver_id) then
    raise exception 'driver_not_in_plan' using errcode = '42501';
  end if;
  if now() >= public.ride_requests_close_at(boleia.departure_at) then
    raise exception 'ride_closed' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.ride_passenger
    where ride_id = boleia.id and profile_id = caller and status = 'accepted'
  ) then
    return;
  end if;
  if public.ride_seats_full(boleia.id) then
    raise exception 'ride_full' using errcode = '22023';
  end if;

  insert into public.ride_passenger (ride_id, profile_id, status, rules_accepted_at)
  values (boleia.id, caller, 'accepted', now())
  on conflict (ride_id, profile_id) do update set status = 'accepted', left_at = null, updated_at = now();

  insert into public.fixture_plan_answer (plan_id, profile_id, answer)
  values (p_plan_id, caller, 'vou')
  on conflict (plan_id, profile_id) do update set answer = 'vou', updated_at = now();

  -- Se a sessão já existe, entra nas contas e na despesa do carro.
  if plano.session_id is not null then
    insert into public.trip_session_member (session_id, profile_id, added_by)
    values (plano.session_id, caller, caller)
    on conflict (session_id, profile_id) do nothing;
    perform public.sync_ride_trip_expense(plano.session_id);
  end if;
end;
$$;

create or replace function public.ensure_plan_session(p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  plano public.fixture_plan;
  -- The plan's car counts only when its driver is in the plan; otherwise it is as if there were none.
  boleia_id uuid;
  sessao uuid;
  nome text;
begin
  select * into plano from public.fixture_plan where id = p_plan_id;
  if plano.id is null or plano.status = 'cancelado' then
    return null;
  end if;

  select r.id into boleia_id
  from public.ride as r
  where r.id = plano.ride_id and public.can_see_fixture_plan(plano.id, r.driver_id);

  sessao := plano.session_id;
  if sessao is null and boleia_id is not null then
    select s.id into sessao from public.trip_session as s where s.ride_id = boleia_id;
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
      boleia_id,
      case when boleia_id is null then plano.group_id end,
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
    select r.driver_id from public.ride as r where r.id = boleia_id and r.status = 'open'
    union
    select rp.profile_id from public.ride_passenger as rp
    where rp.ride_id = boleia_id and rp.status = 'accepted'
  ) as gente
  where gente.profile_id is not null
  on conflict (session_id, profile_id) do nothing;

  update public.fixture_plan set session_id = sessao
  where id = plano.id and session_id is distinct from sessao;

  perform public.sync_ride_trip_expense(sessao);
  return sessao;
end;
$$;

create or replace function public.set_fixture_plan_stay(p_plan_id uuid, p_stay_plan_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
  casa public.stay_plan;
begin
  select * into plano from public.fixture_plan where id = p_plan_id for update;
  if plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.status = 'cancelado' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;

  if p_stay_plan_id is null then
    if plano.created_by is distinct from caller and not exists (
      select 1 from public.stay_plan as s where s.id = plano.stay_plan_id and s.profile_id = caller
    ) then
      raise exception 'not_owner' using errcode = '42501';
    end if;
    update public.fixture_plan set stay_plan_id = null, updated_at = now() where id = p_plan_id;
    return;
  end if;

  select * into casa from public.stay_plan where id = p_stay_plan_id;
  if casa.id is null or casa.fixture_id <> plano.fixture_id then
    raise exception 'stay_not_found' using errcode = 'P0002';
  end if;
  if plano.created_by is distinct from caller and casa.profile_id is distinct from caller then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  -- The house must be of someone in the plan.
  if not public.can_see_fixture_plan(p_plan_id, casa.profile_id) then
    raise exception 'owner_not_in_plan' using errcode = '42501';
  end if;
  update public.fixture_plan set stay_plan_id = p_stay_plan_id, updated_at = now() where id = p_plan_id;
end;
$$;

create or replace function public.set_plan_stay_locked(p_plan_id uuid, p_locked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
begin
  select * into plano from public.fixture_plan where id = p_plan_id for update;
  if caller is null or plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.created_by is distinct from caller then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if p_locked and plano.stay_plan_id is null then
    raise exception 'stay_not_found' using errcode = 'P0002';
  end if;
  if p_locked and not exists (
    select 1 from public.stay_plan as s
    where s.id = plano.stay_plan_id and public.can_see_fixture_plan(p_plan_id, s.profile_id)
  ) then
    raise exception 'owner_not_in_plan' using errcode = '42501';
  end if;
  update public.fixture_plan
  set stay_locked_at = case when p_locked then now() end, updated_at = now()
  where id = p_plan_id;
end;
$$;

create or replace function public.join_plan_stay(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
  casa public.stay_plan;
  ocupados integer;
begin
  select * into plano from public.fixture_plan where id = p_plan_id;
  if caller is null or plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.status = 'cancelado' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;
  if plano.stay_locked_at is null then
    raise exception 'stay_not_locked' using errcode = '22023';
  end if;
  if not public.can_share_house(caller) then
    raise exception 'needs_history' using errcode = '22023';
  end if;

  select * into casa from public.stay_plan where id = plano.stay_plan_id for update;
  if casa.id is null then
    raise exception 'stay_not_found' using errcode = 'P0002';
  end if;
  if casa.profile_id = caller then
    raise exception 'own_house' using errcode = '22023';
  end if;
  -- A bed without asking is only in the house of someone in the plan.
  if not public.can_see_fixture_plan(p_plan_id, casa.profile_id) then
    raise exception 'owner_not_in_plan' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.stay_place where plan_id = casa.id and profile_id = caller and status = 'aceite'
  ) then
    return;
  end if;
  select count(*) into ocupados from public.stay_place where plan_id = casa.id and status = 'aceite';
  if ocupados >= casa.spare_places then
    raise exception 'house_full' using errcode = '22023';
  end if;

  insert into public.stay_place (plan_id, profile_id, status)
  values (casa.id, caller, 'aceite')
  on conflict (plan_id, profile_id) do update set status = 'aceite', updated_at = now();

  insert into public.fixture_plan_answer (plan_id, profile_id, answer)
  values (p_plan_id, caller, 'vou')
  on conflict (plan_id, profile_id) do update set answer = 'vou', updated_at = now();
end;
$$;

-- Plans already pointing at a stranger's car or house lose it (none expected; the guard is for what was possible).
update public.fixture_plan as fp
set ride_id = null, updated_at = now()
from public.ride as r
where r.id = fp.ride_id and not public.can_see_fixture_plan(fp.id, r.driver_id);

update public.fixture_plan as fp
set stay_plan_id = null, stay_locked_at = null, updated_at = now()
from public.stay_plan as s
where s.id = fp.stay_plan_id and not public.can_see_fixture_plan(fp.id, s.profile_id);

-- 2. Ride board -----------------------------------------------------------------------------------------------------

create or replace function public.ride_board(p_fixture_id text)
returns table (
  id uuid, is_mine boolean, driver_id uuid, driver_name text, driver_completed integer, driver_faults integer,
  origin_name text, origin_city text, origin_latitude double precision, origin_longitude double precision,
  departure_at timestamptz, requests_close_at timestamptz, seats_offered smallint, seats_taken integer,
  route_option text, round_trip boolean, accepts_return_requests boolean, distance_m integer, duration_s integer,
  toll_m integer, fuel_cents integer, toll_cents integer, total_cents integer, share_now_cents integer,
  share_full_cents integer, note text, status text, my_status text, parking_name text,
  parking_latitude double precision, parking_longitude double precision, parking_distance_m integer,
  group_id uuid, group_name text, visibility text, driver_is_friend boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.driver_id = auth.uid(),
    r.driver_id,
    p.display_name,
    rep.completed,
    rep.faults,
    r.origin_name,
    r.origin_city,
    -- The exact start point is for the driver and whoever is going in the car; the rest see the area (~1 km).
    case when exacto.sim
      then extensions.st_y(r.origin::extensions.geometry)
      else round(extensions.st_y(r.origin::extensions.geometry)::numeric, 2)::double precision
    end,
    case when exacto.sim
      then extensions.st_x(r.origin::extensions.geometry)
      else round(extensions.st_x(r.origin::extensions.geometry)::numeric, 2)::double precision
    end,
    r.departure_at,
    public.ride_requests_close_at(r.departure_at),
    r.seats_offered,
    taken.n,
    r.route_option,
    r.round_trip,
    r.accepts_return_requests,
    r.distance_m,
    r.duration_s,
    r.toll_m,
    r.fuel_cents,
    r.toll_cents,
    r.total_cents,
    public.ride_share_cents(r.total_cents, 1 + taken.n),
    public.ride_share_cents(r.total_cents, 1 + r.seats_offered),
    r.note,
    r.status,
    mine.status,
    ps.name,
    ps.latitude,
    ps.longitude,
    ps.distance_m,
    case when sou_do_grupo.sim then r.group_id end,
    case when sou_do_grupo.sim then g.name end,
    r.visibility,
    public.are_friends(r.driver_id, auth.uid())
  from public.ride as r
  join public.profile as p on p.id = r.driver_id
  cross join lateral public.ride_reputation(array[r.driver_id]) as rep
  cross join lateral (
    select count(*)::integer as n
    from public.ride_passenger as rp
    where rp.ride_id = r.id and rp.status = 'accepted'
  ) as taken
  cross join lateral (
    select public.can_see_private_ride(r.id, r.group_id, auth.uid()) as sim
  ) as sou_do_grupo
  left join public.ride_passenger as mine on mine.ride_id = r.id and mine.profile_id = auth.uid()
  cross join lateral (
    select r.driver_id = auth.uid() or mine.status = 'accepted' as sim
  ) as exacto
  left join public.parking_spot as ps on ps.id = r.parking_spot_id
  left join public.fan_group as g on g.id = r.group_id
  where auth.uid() is not null
    and r.fixture_id = p_fixture_id
    and (r.status = 'open' or r.driver_id = auth.uid() or mine.profile_id is not null)
    and (
      r.visibility = 'publica'
      or r.driver_id = auth.uid()
      or mine.profile_id is not null
      or sou_do_grupo.sim
    )
  -- As boleias de amigos primeiro: é com quem se vai de boa vontade.
  order by public.are_friends(r.driver_id, auth.uid()) desc, r.departure_at, r.created_at;
$$;

-- 3. Profile cards and avatars --------------------------------------------------------------------------------------

-- Whether a viewer may see someone's card and photo: themselves, an admin, the people can_see_profile allows
-- (crossed paths, a driver with an open ride, a passenger of theirs), or someone in a plan the viewer can see.
-- Never someone who blocked the viewer.
create or replace function public.can_see_profile_card(p_viewer uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_viewer is not null and p_profile_id is not null and (
    p_viewer = p_profile_id
    or exists (select 1 from public.profile as a where a.id = p_viewer and a.is_admin)
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

revoke execute on function public.can_see_profile_card(uuid, uuid) from public, anon, authenticated;

create or replace function public.profile_cards(p_profile_ids uuid[])
returns table (
  profile_id uuid, display_name text, avatar_path text, home_city text, member_since date,
  rides_completed integer, rides_faults integer, is_me boolean
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
    p.home_city,
    p.created_at::date,
    rep.completed,
    rep.faults,
    p.id = auth.uid()
  from unnest(p_profile_ids[1:200]) as pedido(id)
  join public.profile as p on p.id = pedido.id
  cross join lateral public.ride_reputation(array[p.id]) as rep
  where auth.uid() is not null and public.can_see_profile_card(auth.uid(), p.id);
$$;

-- For the storage policy: whether the caller may open this avatar file (their own, or the current photo of someone
-- whose card they may see).
create or replace function public.can_open_avatar(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    split_part(p_name, '/', 1) = auth.uid()::text
    or exists (select 1 from public.profile as a where a.id = auth.uid() and a.is_admin)
    or exists (
      select 1 from public.profile as p
      where p.avatar_path = p_name and public.can_see_profile_card(auth.uid(), p.id)
    )
  );
$$;

revoke execute on function public.can_open_avatar(text) from public, anon;
grant execute on function public.can_open_avatar(text) to authenticated;

drop policy "signed in people see avatars" on storage.objects;
create policy "people see the avatars they may see"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.can_open_avatar(name));

-- 4. Money ----------------------------------------------------------------------------------------------------------

create or replace function public.add_trip_settlement(
  p_session_id uuid, p_to_profile_id uuid, p_cents integer, p_from_profile_id uuid default null
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
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.is_trip_member(p_session_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;

  de := coalesce(p_from_profile_id, caller);
  if de <> caller and p_to_profile_id <> caller then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  if de = p_to_profile_id then
    raise exception 'bad_settlement' using errcode = '22023';
  end if;
  -- Quem saiu do grupo continua nas contas, por isso vale quem lá está e quem aparece nas despesas.
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
    session_id, from_profile_id, to_profile_id, cents, created_by, confirmed_at, confirmed_by
  )
  values (
    p_session_id, de, p_to_profile_id, p_cents, caller,
    case when caller = p_to_profile_id then now() end,
    case when caller = p_to_profile_id then caller end
  )
  returning id into novo;

  return novo;
end;
$$;

create or replace function public.remove_trip_settlement(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pagamento public.trip_settlement;
begin
  select * into pagamento from public.trip_settlement where id = p_settlement_id;
  if pagamento.id is null
     or auth.uid() is distinct from pagamento.from_profile_id
        and auth.uid() is distinct from pagamento.to_profile_id
        and auth.uid() is distinct from pagamento.created_by then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  -- Once the receiver confirmed it, only the payer can take it back: the receiver cannot bring a paid debt back.
  if pagamento.confirmed_at is not null and auth.uid() is distinct from pagamento.from_profile_id then
    raise exception 'confirmed_settlement' using errcode = '42501';
  end if;
  delete from public.trip_settlement where id = p_settlement_id;
end;
$$;

create or replace function public.add_trip_expense(
  p_session_id uuid, p_description text, p_category text, p_cents integer,
  p_payer_id uuid default null, p_participants uuid[] default null
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

  insert into public.trip_expense (session_id, payer_id, description, category, cents, created_by)
  values (p_session_id, quem, btrim(p_description), p_category, p_cents, caller)
  returning id into nova;

  insert into public.trip_expense_share (expense_id, profile_id)
  select distinct nova, pessoa.id from unnest(gente) as pessoa(id);

  return nova;
end;
$$;

-- Who runs a trip: whoever opened it, and the driver when it is a ride's.
create or replace function public.runs_trip_session(p_session_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_session as s
    left join public.ride as r on r.id = s.ride_id
    where s.id = p_session_id and (s.opened_by = p_profile_id or r.driver_id = p_profile_id)
  );
$$;

revoke execute on function public.runs_trip_session(uuid, uuid) from public, anon, authenticated;

create or replace function public.remove_trip_person(p_session_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_trip_member(p_session_id, auth.uid()) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  -- Each one can leave; only who runs the trip takes someone else out.
  if p_profile_id is distinct from auth.uid() and not public.runs_trip_session(p_session_id, auth.uid()) then
    raise exception 'not_session_owner' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.trip_expense as e
    where e.session_id = p_session_id and e.source = 'manual' and e.payer_id = p_profile_id
    union all
    select 1
    from public.trip_expense as e
    join public.trip_expense_share as sh on sh.expense_id = e.id
    where e.session_id = p_session_id and e.source = 'manual' and sh.profile_id = p_profile_id
    union all
    select 1 from public.trip_settlement as t
    where t.session_id = p_session_id
      and (t.from_profile_id = p_profile_id or t.to_profile_id = p_profile_id)
  ) then
    raise exception 'has_money' using errcode = '22023';
  end if;
  if (select count(*) from public.trip_session_member where session_id = p_session_id) <= 1 then
    raise exception 'last_person' using errcode = '22023';
  end if;

  delete from public.trip_session_member
  where session_id = p_session_id and profile_id = p_profile_id;
  if not found then
    raise exception 'not_in_trip' using errcode = '22023';
  end if;

  -- A despesa da boleia é refeita: quem saiu das contas também sai dela.
  perform public.sync_ride_trip_expense(p_session_id);
end;
$$;

create or replace function public.remove_trip_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_trip_member(p_session_id, auth.uid()) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if not public.runs_trip_session(p_session_id, auth.uid()) then
    raise exception 'not_session_owner' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.trip_expense as e
    where e.session_id = p_session_id and e.source = 'manual'
    union all
    select 1 from public.trip_settlement as t where t.session_id = p_session_id
  ) then
    raise exception 'has_money' using errcode = '22023';
  end if;

  delete from public.trip_session where id = p_session_id;
end;
$$;

-- 5. Group photos ---------------------------------------------------------------------------------------------------

create or replace function public.caller_owns_group_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then exists (
      select 1 from public.fan_group_member as m
      where m.group_id = p_folder::uuid and m.profile_id = auth.uid() and m.role = 'owner'
    )
    else false
  end;
$$;

revoke execute on function public.caller_owns_group_folder(text) from public, anon;
grant execute on function public.caller_owns_group_folder(text) to authenticated;

drop policy "group members replace group photos" on storage.objects;
drop policy "group members delete group photos" on storage.objects;

create policy "uploaders and owners replace group photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'group-photos'
    and public.caller_in_group_folder((storage.foldername(name))[1])
    and (owner_id = (select auth.uid())::text or public.caller_owns_group_folder((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'group-photos'
    and public.caller_in_group_folder((storage.foldername(name))[1])
  );

create policy "uploaders and owners delete group photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'group-photos'
    and public.caller_in_group_folder((storage.foldername(name))[1])
    and (owner_id = (select auth.uid())::text or public.caller_owns_group_folder((storage.foldername(name))[1]))
  );

-- 6. Place pulse ----------------------------------------------------------------------------------------------------

create or replace function public.refresh_place_pulse()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  published integer;
begin
  perform pg_advisory_xact_lock(hashtext('place_pulse'));

  -- Kick-off at the tasco's stadium after the check-in: presence ends at kick-off.
  update public.checkin as c
  set ended_at = f.kickoff_at
  from public.place as pl, public.fixture as f
  where c.ended_at is null
    and c.expires_at > now()
    and pl.id = c.place_id
    and f.venue_id = pl.venue_id
    and f.kickoff_at > c.created_at
    and f.kickoff_at <= now();

  -- Only accounts at least 3 days old count: a handful of fresh fake accounts cannot make up the 5.
  with active as (
    select c.place_id, c.club_id
    from public.checkin as c
    join public.profile as pr on pr.id = c.profile_id
    where c.ended_at is null and c.expires_at > now() and pr.created_at <= now() - interval '3 days'
  ),
  totals as (
    select a.place_id, count(*)::integer as people
    from active as a
    group by a.place_id
    having count(*) >= 5
  ),
  by_club as (
    select a.place_id, a.club_id, count(*)::integer as people
    from active as a
    join totals as t on t.place_id = a.place_id
    where a.club_id is not null
    group by a.place_id, a.club_id
    having count(*) >= 5
  ),
  -- Published rounded down to multiples of 5: one more person does not show.
  pulse_rows as (
    select
      t.place_id,
      pl.venue_id,
      (t.people / 5) * 5 as people,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object('club_id', b.club_id, 'people', (b.people / 5) * 5)
            order by b.people desc, b.club_id
          )
          from by_club as b
          where b.place_id = t.place_id
        ),
        '[]'::jsonb
      ) as clubs,
      greatest(
        0,
        (t.people / 5) * 5
          - coalesce((select sum((b.people / 5) * 5) from by_club as b where b.place_id = t.place_id), 0)::integer
      ) as others
    from totals as t
    join public.place as pl on pl.id = t.place_id
  ),
  removed as (
    delete from public.place_pulse as pp
    where not exists (select 1 from pulse_rows as r where r.place_id = pp.place_id)
  )
  insert into public.place_pulse (place_id, venue_id, people, clubs, others, updated_at)
  select r.place_id, r.venue_id, r.people, r.clubs, r.others, now()
  from pulse_rows as r
  on conflict (place_id) do update
    set venue_id = excluded.venue_id,
        people = excluded.people,
        clubs = excluded.clubs,
        others = excluded.others,
        updated_at = excluded.updated_at;

  get diagnostics published = row_count;
  return published;
end;
$$;

-- Same as before, minus the refresh on every check-in (the 5-minute job publishes).
create or replace function public.start_checkin(p_profile_id uuid, p_place_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.checkin;
  created public.checkin;
  visit public.place_visit;
  supporter text;
begin
  perform pg_advisory_xact_lock(hashtext('checkin:' || p_profile_id::text));

  select * into existing
  from public.checkin as c
  where c.profile_id = p_profile_id and c.place_id = p_place_id and c.ended_at is null and c.expires_at > now()
  order by c.created_at desc
  limit 1;

  if found then
    select * into visit from public.place_visit as v where v.id = existing.place_visit_id;
    return jsonb_build_object(
      'visit_id', existing.place_visit_id,
      'visited_at', coalesce(visit.visited_at, existing.created_at),
      'expires_at', existing.expires_at
    );
  end if;

  update public.checkin set ended_at = now() where profile_id = p_profile_id and ended_at is null;

  select pc.club_id into supporter
  from public.profile_club as pc
  where pc.profile_id = p_profile_id and pc.relation = 'supporter';

  insert into public.place_visit (profile_id, place_id, source)
  values (p_profile_id, p_place_id, 'check-in')
  returning * into visit;

  insert into public.checkin (profile_id, place_id, club_id, place_visit_id)
  values (p_profile_id, p_place_id, supporter, visit.id)
  returning * into created;

  return jsonb_build_object('visit_id', visit.id, 'visited_at', visit.visited_at, 'expires_at', created.expires_at);
end;
$$;

select public.refresh_place_pulse();

-- 7. House links ----------------------------------------------------------------------------------------------------

alter table public.stay_plan drop constraint stay_plan_listing_url_check;
alter table public.stay_plan add constraint stay_plan_listing_url_check check (
  char_length(listing_url) <= 500
  and listing_url ~ '^https://(www\.)?(airbnb\.(pt|com|es|fr|de|it|ie|nl|be|ch|co\.uk|com\.br)|abnb\.me|booking\.com)(/|$)'
);

-- 8. AI spend ledger ------------------------------------------------------------------------------------------------

create table public.ai_usage_ledger (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('nudge', 'recap')),
  -- No foreign key on purpose: deleting an account must not erase what was spent.
  profile_id uuid,
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  created_at timestamptz not null default now()
);

create index ai_usage_ledger_created_at_idx on public.ai_usage_ledger (created_at);
create index ai_usage_ledger_profile_idx on public.ai_usage_ledger (profile_id, created_at);

alter table public.ai_usage_ledger enable row level security;
-- No policies: only the Edge Functions (service role) read it, through ai_usage_since().
revoke all on public.ai_usage_ledger from anon, authenticated;

create or replace function public.record_ai_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.input_tokens > 0 or new.output_tokens > 0 then
    insert into public.ai_usage_ledger (kind, profile_id, input_tokens, output_tokens, created_at)
    values (tg_argv[0], new.profile_id, new.input_tokens, new.output_tokens, new.created_at);
  end if;
  return new;
end;
$$;

revoke execute on function public.record_ai_usage() from public, anon, authenticated;

create trigger nudge_records_ai_usage
  after insert on public.nudge
  for each row execute function public.record_ai_usage('nudge');

create trigger season_recap_records_ai_usage
  after insert on public.season_recap
  for each row execute function public.record_ai_usage('recap');

insert into public.ai_usage_ledger (kind, profile_id, input_tokens, output_tokens, created_at)
select 'nudge', n.profile_id, n.input_tokens, n.output_tokens, n.created_at
from public.nudge as n
where n.input_tokens > 0 or n.output_tokens > 0
union all
select 'recap', r.profile_id, r.input_tokens, r.output_tokens, r.created_at
from public.season_recap as r
where r.input_tokens > 0 or r.output_tokens > 0;

create or replace function public.ai_usage_since(p_since timestamptz, p_profile_id uuid)
returns table (
  nudge_input_tokens bigint,
  nudge_output_tokens bigint,
  recap_input_tokens bigint,
  recap_output_tokens bigint,
  profile_model_messages bigint
)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(sum(l.input_tokens) filter (where l.kind = 'nudge'), 0)::bigint,
    coalesce(sum(l.output_tokens) filter (where l.kind = 'nudge'), 0)::bigint,
    coalesce(sum(l.input_tokens) filter (where l.kind = 'recap'), 0)::bigint,
    coalesce(sum(l.output_tokens) filter (where l.kind = 'recap'), 0)::bigint,
    count(*) filter (where l.kind = 'nudge' and l.input_tokens > 0 and l.profile_id = p_profile_id)::bigint
  from public.ai_usage_ledger as l
  where l.created_at >= p_since;
$$;

revoke execute on function public.ai_usage_since(timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.ai_usage_since(timestamptz, uuid) to service_role;
