-- As boleias de amigos aparecem primeiro.
--
-- É a terceira coisa que a amizade serve (as outras duas são convidar e ver as viagens que se fizeram juntos):
-- quando há cinco carros para o mesmo jogo, o de um amigo não pode estar perdido a meio da lista. O quadro passa a
-- dizer quais são de amigos e a pô-los à frente.

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
  visibility text,
  driver_is_friend boolean
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
  -- As boleias de amigos primeiro: é com quem se vai de boa vontade.
  order by public.are_friends(r.driver_id, auth.uid()) desc, r.departure_at, r.created_at;
$$;

revoke execute on function public.ride_board(text) from public, anon;
grant execute on function public.ride_board(text) to authenticated;
