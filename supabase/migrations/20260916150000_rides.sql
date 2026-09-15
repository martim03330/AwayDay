-- Rides to a game (slice 3). A driver opens a ride with a number of free seats; other fans ask for a seat and the
-- driver accepts or declines. The trip's cost (fuel and tolls, one way or both) is computed by the `rides` Edge
-- Function from the route and never comes from the app. Each person pays the total divided by everyone in the car
-- (the driver included), so the price per person goes down as seats fill up.
--
-- Privacy: the starting point is a public meeting point the driver chooses (a station, a petrol station), never a
-- home address, and nobody's location is tracked. Only the driver and accepted passengers see who else is going.
-- Both tables are closed to the app: it reads and writes through the functions below.

-- 1. Tolls. Class 1 prices of reference trips divided by the tolled metres of those trips on the same router.
create table public.toll_rate (
  motorway text primary key check (motorway = 'default' or motorway ~ '^A[0-9]+(-[0-9]+)?$'),
  reference_trip text not null check (char_length(reference_trip) <= 200),
  reference_cents integer not null check (reference_cents > 0),
  reference_m integer not null check (reference_m > 0),
  source_url text not null check (source_url ~ '^https://'),
  checked_on date not null
);

alter table public.toll_rate enable row level security;
create policy "toll rates are readable by everyone"
  on public.toll_rate for select to anon, authenticated using (true);
revoke all on public.toll_rate from anon, authenticated;
grant select on public.toll_rate to anon, authenticated;

-- One national rate for now: the router does not always say which motorway a tolled stretch belongs to (the A1 comes
-- back unnamed). Measured on Valhalla (FOSSGIS) on 2026-09-16: A1 Lisboa–Porto 287,8 km tolled (25,05 €), A2
-- Lisboa–Paderne 241,1 km (23,80 €), A2/A6 Marateca–Caia 158,6 km (15,40 €). Ex-SCUT motorways free since 2025 are
-- not tolled on the router either. The app shows tolls as an estimate.
insert into public.toll_rate (motorway, reference_trip, reference_cents, reference_m, source_url, checked_on)
values (
  'default',
  'A1 Lisboa–Porto + A2 Lisboa–Algarve + A2/A6 Marateca–Caia, classe 1, 2026',
  6425,
  687500,
  'https://eco.sapo.pt/2025/12/31/portagens-sobem-45-centimos-entre-lisboa-e-porto-e-50-centimos-entre-lisboa-e-algarve/',
  '2026-09-16'
);

-- 2. Rides.
create table public.ride (
  id uuid primary key default gen_random_uuid(),
  fixture_id text not null references public.fixture (id) on delete cascade,
  driver_id uuid not null references public.profile (id) on delete cascade,
  origin_name text not null check (char_length(btrim(origin_name)) between 2 and 80),
  origin extensions.geography(point, 4326) not null,
  departure_at timestamptz not null,
  seats_offered smallint not null check (seats_offered between 1 and 7),
  route_option text not null check (route_option in ('rapida', 'equilibrio', 'sem_portagens')),
  round_trip boolean not null,
  distance_m integer not null check (distance_m > 0),
  duration_s integer not null check (duration_s > 0),
  toll_m integer not null check (toll_m >= 0),
  consumption_cl_per_100km integer not null check (consumption_cl_per_100km between 200 and 2500),
  fuel_price_milli_per_litre integer not null check (fuel_price_milli_per_litre between 500 and 4000),
  fuel_cents integer not null check (fuel_cents >= 0),
  toll_cents integer not null check (toll_cents >= 0),
  total_cents integer not null,
  note text check (char_length(note) <= 280),
  status text not null default 'open' check (status in ('open', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ride_total_is_fuel_plus_tolls check (total_cents = fuel_cents + toll_cents)
);

create index ride_fixture_id_idx on public.ride (fixture_id, departure_at);
create index ride_driver_id_idx on public.ride (driver_id);

create trigger ride_set_updated_at
  before update on public.ride
  for each row execute function public.set_updated_at();

create table public.ride_passenger (
  ride_id uuid not null references public.ride (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'accepted', 'declined', 'left')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ride_id, profile_id)
);

create index ride_passenger_profile_id_idx on public.ride_passenger (profile_id);

create trigger ride_passenger_set_updated_at
  before update on public.ride_passenger
  for each row execute function public.set_updated_at();

alter table public.ride enable row level security;
alter table public.ride_passenger enable row level security;
revoke all on public.ride from anon, authenticated;
revoke all on public.ride_passenger from anon, authenticated;

-- 3. What each person pays: the total divided by everyone in the car, rounded up to the cent (the same rule as
-- sharePerPersonCents in supabase/functions/_shared/ride-cost.ts, which has the tests).
create function public.ride_share_cents(p_total_cents integer, p_people integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (p_total_cents + greatest(p_people, 1) - 1) / greatest(p_people, 1);
$$;

-- 4. The rides for a game, for signed-in fans: open rides, plus the ones the caller drives or is part of.
create function public.ride_board(p_fixture_id text)
returns table (
  id uuid,
  is_mine boolean,
  driver_name text,
  origin_name text,
  origin_latitude double precision,
  origin_longitude double precision,
  departure_at timestamptz,
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
  my_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.driver_id = auth.uid(),
    p.display_name,
    r.origin_name,
    extensions.st_y(r.origin::extensions.geometry),
    extensions.st_x(r.origin::extensions.geometry),
    r.departure_at,
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
    mine.status
  from public.ride as r
  join public.profile as p on p.id = r.driver_id
  cross join lateral (
    select count(*)::integer as n
    from public.ride_passenger as rp
    where rp.ride_id = r.id and rp.status = 'accepted'
  ) as taken
  left join public.ride_passenger as mine on mine.ride_id = r.id and mine.profile_id = auth.uid()
  where auth.uid() is not null
    and r.fixture_id = p_fixture_id
    and (r.status = 'open' or r.driver_id = auth.uid() or mine.profile_id is not null)
  order by r.departure_at, r.created_at;
$$;

-- 5. Who is in a ride. The driver sees everyone who asked; an accepted passenger sees the driver and the other
-- accepted passengers; anyone else sees nobody.
create function public.ride_people(p_ride_id uuid)
returns table (profile_id uuid, display_name text, status text, is_driver boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select r.id, r.driver_id from public.ride as r where r.id = p_ride_id
  ),
  caller as (
    select
      (select t.driver_id = auth.uid() from target as t) as is_driver,
      exists (
        select 1 from public.ride_passenger as rp
        where rp.ride_id = p_ride_id and rp.profile_id = auth.uid() and rp.status = 'accepted'
      ) as is_passenger
  )
  select t.driver_id, p.display_name, 'driver', true
  from target as t
  join public.profile as p on p.id = t.driver_id
  cross join caller as c
  where c.is_driver or c.is_passenger
  union all
  select rp.profile_id, p.display_name, rp.status, false
  from public.ride_passenger as rp
  join public.profile as p on p.id = rp.profile_id
  cross join caller as c
  where rp.ride_id = p_ride_id
    and (
      (c.is_driver and rp.status in ('requested', 'accepted'))
      or (c.is_passenger and rp.status = 'accepted')
    );
$$;

-- 6. Asking for a seat. At most 20 requests a day per person.
create function public.request_ride_seat(p_ride_id uuid)
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
  select * into target from public.ride where id = p_ride_id for update;
  if target.id is null then
    raise exception 'ride_not_found' using errcode = 'P0002';
  end if;
  if target.driver_id = caller then
    raise exception 'own_ride' using errcode = '22023';
  end if;
  if target.status <> 'open' or target.departure_at <= now() then
    raise exception 'ride_closed' using errcode = '22023';
  end if;
  select count(*) into taken from public.ride_passenger where ride_id = p_ride_id and status = 'accepted';
  if taken >= target.seats_offered then
    raise exception 'ride_full' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'ride-request', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  insert into public.ride_passenger (ride_id, profile_id, status)
  values (p_ride_id, caller, 'requested')
  on conflict (ride_id, profile_id) do update
    set status = 'requested'
    where public.ride_passenger.status in ('declined', 'left');
end;
$$;

-- 7. The driver accepts or declines a request. Accepting never goes over the seats offered.
create function public.answer_ride_request(p_ride_id uuid, p_profile_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.ride;
  taken integer;
begin
  select * into target from public.ride where id = p_ride_id for update;
  if target.id is null or target.driver_id is distinct from auth.uid() then
    raise exception 'not_driver' using errcode = '42501';
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
end;
$$;

-- 8. A passenger leaves (or withdraws a request); the driver cancels the ride.
create function public.leave_ride(p_ride_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ride_passenger
  set status = 'left'
  where ride_id = p_ride_id and profile_id = auth.uid() and status in ('requested', 'accepted');
$$;

create function public.cancel_ride(p_ride_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ride set status = 'cancelled' where id = p_ride_id and driver_id = auth.uid();
$$;

revoke execute on function public.ride_share_cents(integer, integer) from public;
grant execute on function public.ride_share_cents(integer, integer) to authenticated;
revoke execute on function public.ride_board(text) from public, anon;
revoke execute on function public.ride_people(uuid) from public, anon;
revoke execute on function public.request_ride_seat(uuid) from public, anon;
revoke execute on function public.answer_ride_request(uuid, uuid, boolean) from public, anon;
revoke execute on function public.leave_ride(uuid) from public, anon;
revoke execute on function public.cancel_ride(uuid) from public, anon;
grant execute on function public.ride_board(text) to authenticated;
grant execute on function public.ride_people(uuid) to authenticated;
grant execute on function public.request_ride_seat(uuid) to authenticated;
grant execute on function public.answer_ride_request(uuid, uuid, boolean) to authenticated;
grant execute on function public.leave_ride(uuid) to authenticated;
grant execute on function public.cancel_ride(uuid) to authenticated;
