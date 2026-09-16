-- Viagens ligam-se a grupos; as boleias deixam de criar grupos.
--
-- O desenho anterior tratava uma boleia como se fosse um grupo. Não é: um grupo é gente que anda junta e dura, uma
-- boleia é uma viagem que acaba no domingo à noite. A criar um grupo por cada boleia, ao fim de três jogos havia
-- sete grupos e seis eram lixo — e pior: se alguém do meu grupo aparecesse por acaso numa boleia minha, nascia um
-- segundo grupo com as mesmas pessoas.
--
-- Agora:
-- - **nenhum grupo nasce sozinho** (o gatilho sai);
-- - uma boleia ou uma casa podem ser **de um grupo**: quem as oferece escolhe, entre os grupos em que está. Fica a
--   aparecer dentro do grupo, e o grupo passa a ter o histórico das viagens que fez;
-- - quem andou com desconhecidos e gostou cria um grupo **quando quiser**, com um toque, em vez de o receber feito.

drop trigger if exists ride_passenger_group on public.ride_passenger;
drop function if exists public.group_for_ride();

alter table public.ride
  add column group_id uuid references public.fan_group (id) on delete set null;
alter table public.stay_plan
  add column group_id uuid references public.fan_group (id) on delete set null;

create index ride_group_idx on public.ride (group_id) where group_id is not null;
create index stay_plan_group_idx on public.stay_plan (group_id) where group_id is not null;

-- Dizer de que grupo é uma boleia. Só o condutor, e só para grupos em que ele está (ou `null`, para tirar).
create function public.set_ride_group(p_ride_id uuid, p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_group_id is not null and not public.is_group_member(p_group_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  update public.ride set group_id = p_group_id where id = p_ride_id and driver_id = caller;
  if not found then
    raise exception 'not_driver' using errcode = '42501';
  end if;
end;
$$;

-- O mesmo para uma casa proposta.
create function public.set_stay_group(p_plan_id uuid, p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_group_id is not null and not public.is_group_member(p_group_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  update public.stay_plan set group_id = p_group_id where id = p_plan_id and profile_id = caller;
  if not found then
    raise exception 'not_owner' using errcode = '42501';
  end if;
end;
$$;

-- As viagens do grupo: os jogos em que o grupo tem boleia ou casa, do mais próximo para trás.
create function public.group_trips(p_group_id uuid)
returns table (
  fixture_id text,
  kickoff_at timestamptz,
  rides integer,
  houses integer,
  seats_taken integer
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
    ), 0)
  from viagens as v
  join public.fixture as f on f.id = v.fixture_id
  where public.is_group_member(p_group_id, auth.uid())
  group by v.fixture_id, f.kickoff_at
  order by f.kickoff_at desc;
$$;

revoke execute on function public.set_ride_group(uuid, uuid) from public, anon;
revoke execute on function public.set_stay_group(uuid, uuid) from public, anon;
revoke execute on function public.group_trips(uuid) from public, anon;
grant execute on function public.set_ride_group(uuid, uuid) to authenticated;
grant execute on function public.set_stay_group(uuid, uuid) to authenticated;
grant execute on function public.group_trips(uuid) to authenticated;

-- O quadro das boleias passa a dizer de que grupo é cada uma.
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
  group_name text
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
    r.group_id,
    g.name
  from public.ride as r
  join public.profile as p on p.id = r.driver_id
  cross join lateral public.ride_reputation(array[r.driver_id]) as rep
  cross join lateral (
    select count(*)::integer as n
    from public.ride_passenger as rp
    where rp.ride_id = r.id and rp.status = 'accepted'
  ) as taken
  left join public.ride_passenger as mine on mine.ride_id = r.id and mine.profile_id = auth.uid()
  left join public.parking_spot as ps on ps.id = r.parking_spot_id
  left join public.fan_group as g on g.id = r.group_id
  where auth.uid() is not null
    and r.fixture_id = p_fixture_id
    and (r.status = 'open' or r.driver_id = auth.uid() or mine.profile_id is not null)
  order by r.departure_at, r.created_at;
$$;

revoke execute on function public.ride_board(text) from public, anon;
grant execute on function public.ride_board(text) to authenticated;
