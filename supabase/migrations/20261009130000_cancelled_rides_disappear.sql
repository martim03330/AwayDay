-- A cancelled ride disappears from every list right away, instead of staying on the ride board (marked «Cancelada»)
-- for its driver and passengers until the nightly cleanup deletes it after 2 days. Who had a seat or asked for one
-- already gets the «Boleia cancelada» push and the in-app notice (my_ride_alerts); plans showing that car already hide
-- it (fixture_plan_summaries reads open rides only). New: the plan's group is told in its chat, so the group knows the
-- car is gone and someone else can offer one.

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
    -- Only open rides: a cancelled one disappears for everyone, the driver and its passengers included (they get the
    -- «Boleia cancelada» notice instead).
    and r.status = 'open'
    and (
      r.visibility = 'publica'
      or r.driver_id = auth.uid()
      or mine.profile_id is not null
      or sou_do_grupo.sim
    )
  -- As boleias de amigos primeiro: é com quem se vai de boa vontade.
  order by public.are_friends(r.driver_id, auth.uid()) desc, r.departure_at, r.created_at;
$$;

create or replace function public.tell_plans_ride_cancelled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plano record;
  quem text;
begin
  if new.status <> 'cancelled' or old.status = 'cancelled' then
    return new;
  end if;
  select coalesce(p.display_name, 'O condutor') into quem from public.profile as p where p.id = new.driver_id;
  for plano in
    select fp.id, fp.group_id
    from public.fixture_plan as fp
    join public.fixture as f on f.id = fp.fixture_id
    where fp.ride_id = new.id and fp.status <> 'cancelado' and f.kickoff_at > now()
  loop
    perform public.post_plan_notice(
      plano.group_id,
      new.driver_id,
      plano.id,
      quem || ' cancelou a boleia deste plano. O plano continua: quem levar carro pode oferecer outra aqui.'
    );
  end loop;
  return new;
end;
$$;

revoke execute on function public.tell_plans_ride_cancelled() from public, anon, authenticated;

create trigger ride_cancelled_tells_plans
  after update of status on public.ride
  for each row
  when (old.status is distinct from new.status and new.status = 'cancelled')
  execute function public.tell_plans_ride_cancelled();
