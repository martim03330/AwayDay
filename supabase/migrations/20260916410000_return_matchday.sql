-- A volta, no dia do jogo.
--
-- Depois do apito, uma boleia de ida não serve para nada: o que interessa é quem volta e para onde. Três mudanças:
--
-- 1. **Os pedidos de boleia de volta abrem com o apito** (abriam ao intervalo). Quem chegou ao estádio já sabe se
--    tem maneira de voltar, e é nessa altura que vale a pena perguntar.
-- 2. **Cada boleia guarda para onde volta** (`origin_city`, o concelho de onde saiu, escrito na criação pela função
--    `rides`). É o que permite mostrar «quem volta para Viseu» em vez de uma lista solta de nomes.
-- 3. **Dá para abrir lugares na volta a meio do jogo**: quem publicou uma boleia de ida e volta pode dizer, já com o
--    jogo a decorrer, que aceita gente na volta — ou deixar de aceitar.

alter table public.ride
  add column origin_city text check (char_length(btrim(origin_city)) between 2 and 80);

-- Abre com o apito: é aí que se percebe quem ficou sem transporte.
create or replace function public.ride_return_opens_at(p_kickoff timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select p_kickoff;
$$;

-- Abrir (ou fechar) os lugares da volta, a qualquer momento. Só o condutor, e só em boleias de ida e volta.
create function public.set_ride_return_requests(p_ride_id uuid, p_accepts boolean)
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
  if p_accepts and not alvo.round_trip then
    raise exception 'not_round_trip' using errcode = '22023';
  end if;
  update public.ride set accepts_return_requests = p_accepts where id = p_ride_id;
end;
$$;

revoke execute on function public.set_ride_return_requests(uuid, boolean) from public, anon;
grant execute on function public.set_ride_return_requests(uuid, boolean) to authenticated;

-- O quadro da volta passa a dizer para onde cada carro vai (o tipo de retorno muda, por isso a função sai e entra).
drop function if exists public.ride_return_board(text);

create function public.ride_return_board(p_fixture_id text)
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
  origin_city text,
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
    r.origin_city,
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
  order by coalesce(r.origin_city, 'zzz'), (r.seats_offered - taken.n - back.n) desc, p.display_name;
$$;

revoke execute on function public.ride_return_board(text) from public, anon;
grant execute on function public.ride_return_board(text) to authenticated;

-- O quadro normal também diz para onde volta cada boleia, para a app poder agrupar por destino.
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
  origin_city text,
  origin_latitude double precision,
  origin_longitude double precision,
  departure_at timestamptz,
  requests_close_at timestamptz,
  seats_offered smallint,
  seats_taken integer,
  route_option text,
  round_trip boolean,
  accepts_return_requests boolean,
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
    r.origin_city,
    extensions.st_y(r.origin::extensions.geometry),
    extensions.st_x(r.origin::extensions.geometry),
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
