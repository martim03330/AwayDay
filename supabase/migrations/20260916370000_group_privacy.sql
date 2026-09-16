-- Primeiro entre a malta, depois para toda a gente.
--
-- Uma boleia (ou uma casa) criada dentro de um grupo começa **privada**: só a vê quem é do grupo. Quando o carro não
-- enche, o grupo carrega em «abrir a toda a gente» e ela passa a aparecer no quadro do jogo como qualquer outra — com
-- os lugares já ocupados à vista, para quem entra saber que vai com malta que já se conhece.
--
-- Para quem é de fora, o **nome do grupo não aparece**: vê-se «Boleia do João · 2 lugares ocupados · 2 livres». O
-- nome de um grupo privado não é da conta de estranhos; quem é do grupo continua a ver a etiqueta.
--
-- Uma boleia privada também não recebe pedidos de boleia de volta de desconhecidos: enquanto estiver fechada, é da
-- malta.

alter table public.ride
  add column visibility text not null default 'publica' check (visibility in ('grupo', 'publica')),
  add constraint ride_private_needs_group check (visibility = 'publica' or group_id is not null);

alter table public.stay_plan
  add column visibility text not null default 'publica' check (visibility in ('grupo', 'publica')),
  add constraint stay_private_needs_group check (visibility = 'publica' or group_id is not null);

-- Abrir ao público, ou voltar a fechar ao grupo. Só quem é dono da boleia ou da casa.
create function public.set_ride_visibility(p_ride_id uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  alvo public.ride;
begin
  select * into alvo from public.ride where id = p_ride_id for update;
  if alvo.id is null or alvo.driver_id is distinct from auth.uid() then
    raise exception 'not_driver' using errcode = '42501';
  end if;
  if not p_public and alvo.group_id is null then
    raise exception 'needs_group' using errcode = '22023';
  end if;
  update public.ride set visibility = case when p_public then 'publica' else 'grupo' end
  where id = p_ride_id;
end;
$$;

create function public.set_stay_visibility(p_plan_id uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  alvo public.stay_plan;
begin
  select * into alvo from public.stay_plan where id = p_plan_id for update;
  if alvo.id is null or alvo.profile_id is distinct from auth.uid() then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if not p_public and alvo.group_id is null then
    raise exception 'needs_group' using errcode = '22023';
  end if;
  update public.stay_plan set visibility = case when p_public then 'publica' else 'grupo' end
  where id = p_plan_id;
end;
$$;

revoke execute on function public.set_ride_visibility(uuid, boolean) from public, anon;
revoke execute on function public.set_stay_visibility(uuid, boolean) from public, anon;
grant execute on function public.set_ride_visibility(uuid, boolean) to authenticated;
grant execute on function public.set_stay_visibility(uuid, boolean) to authenticated;

-- O quadro das boleias: as privadas só aparecem a quem é do grupo, e o nome do grupo só a esses.
drop function public.ride_board(text);

create function public.ride_board(p_fixture_id text)
returns table (
  id uuid,
  is_mine boolean,
  driver_id uuid,
  driver_name text,
  driver_completed integer,
  driver_faults integer,
  origin_name text,
  origin_latitude double precision,
  origin_longitude double precision,
  departure_at timestamptz,
  requests_close_at timestamptz,
  seats_offered smallint,
  seats_taken integer,
  route_option text,
  round_trip boolean,
  distance_m integer,
  duration_s integer,
  toll_m integer,
  fuel_cents integer,
  toll_cents integer,
  total_cents integer,
  share_now_cents integer,
  share_full_cents integer,
  note text,
  status text,
  my_status text,
  parking_name text,
  parking_latitude double precision,
  parking_longitude double precision,
  parking_distance_m integer,
  group_id uuid,
  group_name text,
  visibility text
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
    extensions.st_y(r.origin::extensions.geometry),
    extensions.st_x(r.origin::extensions.geometry),
    r.departure_at,
    public.ride_requests_close_at(r.departure_at),
    r.seats_offered,
    taken.n,
    r.route_option,
    r.round_trip,
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
    r.visibility
  from public.ride as r
  join public.profile as p on p.id = r.driver_id
  cross join lateral public.ride_reputation(array[r.driver_id]) as rep
  cross join lateral (
    select count(*)::integer as n
    from public.ride_passenger as rp
    where rp.ride_id = r.id and rp.status = 'accepted'
  ) as taken
  cross join lateral (
    select r.group_id is not null and public.is_group_member(r.group_id, auth.uid()) as sim
  ) as sou_do_grupo
  left join public.ride_passenger as mine on mine.ride_id = r.id and mine.profile_id = auth.uid()
  left join public.parking_spot as ps on ps.id = r.parking_spot_id
  left join public.fan_group as g on g.id = r.group_id
  where auth.uid() is not null
    and r.fixture_id = p_fixture_id
    and (r.status = 'open' or r.driver_id = auth.uid() or mine.profile_id is not null)
    -- Privada: só a malta do grupo, o condutor e quem já lá vai.
    and (
      r.visibility = 'publica'
      or r.driver_id = auth.uid()
      or mine.profile_id is not null
      or sou_do_grupo.sim
    )
  order by r.departure_at, r.created_at;
$$;

revoke execute on function public.ride_board(text) from public, anon;
grant execute on function public.ride_board(text) to authenticated;

-- Boleia de volta: uma boleia fechada ao grupo não aparece a quem não é de lá.
create or replace function public.ride_return_board(p_fixture_id text)
returns table (
  ride_id uuid,
  driver_name text,
  driver_completed integer,
  driver_faults integer,
  seats_left integer,
  price_cents integer,
  parking_name text,
  parking_latitude double precision,
  parking_longitude double precision,
  origin_name text,
  my_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    p.display_name,
    rep.completed,
    rep.faults,
    (r.seats_offered - taken.n - back.n)::integer,
    public.ride_return_share_cents(r.total_cents, 1 + taken.n + back.n + 1),
    ps.name,
    ps.latitude,
    ps.longitude,
    r.origin_name,
    mine.status
  from public.ride as r
  join public.profile as p on p.id = r.driver_id
  join public.fixture as f on f.id = r.fixture_id
  cross join lateral public.ride_reputation(array[r.driver_id]) as rep
  cross join lateral (
    select count(*)::integer as n from public.ride_passenger as rp
    where rp.ride_id = r.id and rp.status = 'accepted'
  ) as taken
  cross join lateral (
    select count(*)::integer as n from public.ride_return_request as rr
    where rr.ride_id = r.id and rr.status = 'accepted'
  ) as back
  left join public.parking_spot as ps on ps.id = r.parking_spot_id
  left join public.ride_return_request as mine on mine.ride_id = r.id and mine.profile_id = auth.uid()
  where auth.uid() is not null
    and r.fixture_id = p_fixture_id
    and r.status = 'open'
    and r.round_trip
    and r.accepts_return_requests
    and r.driver_id <> auth.uid()
    and (
      r.visibility = 'publica'
      or (r.group_id is not null and public.is_group_member(r.group_id, auth.uid()))
    )
    and now() between public.ride_return_opens_at(f.kickoff_at) and public.ride_return_closes_at(f.kickoff_at)
    and (r.seats_offered - taken.n - back.n) > 0
  order by (r.seats_offered - taken.n - back.n) desc, p.display_name;
$$;

revoke execute on function public.ride_return_board(text) from public, anon;
grant execute on function public.ride_return_board(text) to authenticated;

-- As casas: as privadas só aparecem à malta do grupo, e o nome do grupo só a esses.
drop function public.fixture_stay_plans(text);

create function public.fixture_stay_plans(p_fixture_id text)
returns table (
  id uuid,
  display_name text,
  member_since date,
  rides_completed integer,
  rides_faults integer,
  total_cents integer,
  nights smallint,
  commitment text,
  spare_places smallint,
  taken integer,
  share_now_cents integer,
  share_full_cents integer,
  listing_url text,
  listing_seen_on date,
  status text,
  note text,
  updated_on date,
  is_mine boolean,
  my_status text,
  pending integer,
  group_id uuid,
  group_name text,
  visibility text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    p.display_name,
    p.created_at::date,
    rep.completed,
    rep.faults,
    s.total_cents,
    s.nights,
    s.commitment,
    s.spare_places,
    ocupados.n,
    public.stay_share_cents(s.total_cents, 1 + ocupados.n),
    public.stay_share_cents(s.total_cents, 1 + s.spare_places),
    s.listing_url,
    s.listing_seen_on,
    s.status,
    s.note,
    s.updated_at::date,
    s.profile_id = auth.uid(),
    meu.status,
    case when s.profile_id = auth.uid() then pedidos.n else 0 end,
    case when sou_do_grupo.sim then s.group_id end,
    case when sou_do_grupo.sim then g.name end,
    s.visibility
  from public.stay_plan as s
  join public.profile as p on p.id = s.profile_id
  cross join lateral public.ride_reputation(array[s.profile_id]) as rep
  cross join lateral (
    select count(*)::integer as n from public.stay_place as sp
    where sp.plan_id = s.id and sp.status = 'aceite'
  ) as ocupados
  cross join lateral (
    select count(*)::integer as n from public.stay_place as sp
    where sp.plan_id = s.id and sp.status = 'pedido'
  ) as pedidos
  cross join lateral (
    select s.group_id is not null and public.is_group_member(s.group_id, auth.uid()) as sim
  ) as sou_do_grupo
  left join public.stay_place as meu on meu.plan_id = s.id and meu.profile_id = auth.uid()
  left join public.fan_group as g on g.id = s.group_id
  where s.fixture_id = p_fixture_id
    and auth.uid() is not null
    and (
      s.visibility = 'publica'
      or s.profile_id = auth.uid()
      or meu.profile_id is not null
      or sou_do_grupo.sim
    )
  order by
    case when s.status = 'reservada' then 1 else 0 end,
    s.updated_at desc;
$$;

revoke execute on function public.fixture_stay_plans(text) from public, anon;
grant execute on function public.fixture_stay_plans(text) to authenticated;

-- Entrar numa casa fechada ao grupo é só para quem é do grupo.
create or replace function public.request_stay_place(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  casa public.stay_plan;
  ocupados integer;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.can_share_house(caller) then
    raise exception 'needs_history' using errcode = '22023';
  end if;
  select * into casa from public.stay_plan where id = p_plan_id for update;
  if casa.id is null then
    raise exception 'house_not_found' using errcode = 'P0002';
  end if;
  if casa.visibility = 'grupo'
    and not (casa.group_id is not null and public.is_group_member(casa.group_id, caller)) then
    raise exception 'house_not_found' using errcode = 'P0002';
  end if;
  if casa.profile_id = caller then
    raise exception 'own_house' using errcode = '22023';
  end if;
  if casa.status = 'reservada' then
    raise exception 'house_full' using errcode = '22023';
  end if;
  select count(*) into ocupados from public.stay_place
  where plan_id = p_plan_id and status = 'aceite';
  if ocupados >= casa.spare_places then
    raise exception 'house_full' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'stay-place', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.stay_place (plan_id, profile_id, status)
  values (p_plan_id, caller, 'pedido')
  on conflict (plan_id, profile_id) do update
    set status = 'pedido'
    where public.stay_place.status in ('recusado', 'saiu');
end;
$$;

-- Pedir lugar numa boleia fechada ao grupo é só para quem é do grupo.
create or replace function public.request_ride_seat(p_ride_id uuid, p_accept_rules boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target public.ride;
  taken integer;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_accept_rules is not true then
    raise exception 'rules_not_accepted' using errcode = '22023';
  end if;
  if public.ride_ban_until(caller) is not null then
    raise exception 'suspended' using errcode = '22023';
  end if;
  select * into target from public.ride where id = p_ride_id for update;
  if target.id is null then
    raise exception 'ride_not_found' using errcode = 'P0002';
  end if;
  if target.visibility = 'grupo'
    and not (target.group_id is not null and public.is_group_member(target.group_id, caller)) then
    raise exception 'ride_not_found' using errcode = 'P0002';
  end if;
  if target.driver_id = caller then
    raise exception 'own_ride' using errcode = '22023';
  end if;
  if target.status <> 'open' or now() >= public.ride_requests_close_at(target.departure_at) then
    raise exception 'ride_closed' using errcode = '22023';
  end if;
  select count(*) into taken from public.ride_passenger where ride_id = p_ride_id and status = 'accepted';
  if taken >= target.seats_offered then
    raise exception 'ride_full' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'ride-request', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  insert into public.ride_passenger (ride_id, profile_id, status, rules_accepted_at)
  values (p_ride_id, caller, 'requested', now())
  on conflict (ride_id, profile_id) do update
    set status = 'requested', rules_accepted_at = now(), left_at = null
    where public.ride_passenger.status in ('declined', 'left', 'expired');
end;
$$;
