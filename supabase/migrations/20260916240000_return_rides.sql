-- Boleia de volta: a seat home for a fan who missed their transport.
--
-- After the game someone is left at the stadium — the bus gone, the train missed. This lets them ask a driver who is
-- already going back for a seat on the way home only, and the driver decides.
--
-- The rules, all enforced here and not in the app:
-- - only rides that come back (round_trip) and whose driver said they take these requests;
-- - only between an hour after kick-off (about half time) and three and a half hours after it (about an hour after
--   the final whistle): before that nobody has missed anything, after that the cars are gone;
-- - the fan pays their share of *half* the cost — the way home — split between everyone in the car on the way back,
--   so the more people come back, the less each pays. Computed here, in whole cents, never in the app;
-- - the driver is told how far the fan is from the car (rounded to 100 m). The fan's position is never stored and
--   never shown to anyone: only that distance is kept;
-- - the same reliability rules as any other seat: being accepted and not turning up is a fault, and someone
--   suspended cannot ask.

alter table public.ride
  add column accepts_return_requests boolean not null default false,
  add constraint ride_return_needs_round_trip check (not accepts_return_requests or round_trip);

-- 1. The window, from the game's kick-off.
create function public.ride_return_opens_at(p_kickoff timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select p_kickoff + interval '1 hour';
$$;

create function public.ride_return_closes_at(p_kickoff timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select p_kickoff + interval '3 hours 30 minutes';
$$;

-- 2. What a seat on the way back costs: half the trip (the way home), split between everyone in the car, rounded up
-- to the cent like every other share.
create function public.ride_return_share_cents(p_total_cents integer, p_people integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select ((p_total_cents + 1) / 2 + greatest(p_people, 1) - 1) / greatest(p_people, 1);
$$;

create table public.ride_return_request (
  ride_id uuid not null references public.ride (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  -- How far the fan is from the car, rounded to 100 m. Their position is never stored.
  distance_to_car_m integer not null check (distance_to_car_m >= 0),
  share_cents integer not null check (share_cents >= 0),
  rules_accepted_at timestamptz not null,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ride_id, profile_id)
);

create index ride_return_request_profile_idx on public.ride_return_request (profile_id);

create trigger ride_return_request_set_updated_at
  before update on public.ride_return_request
  for each row execute function public.set_updated_at();

alter table public.ride_return_request enable row level security;
revoke all on public.ride_return_request from anon, authenticated;

-- 3. How many people share the way home: the driver, everyone with a seat, and the return requests already accepted.
create function public.ride_return_people_count(p_ride_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select 1
    + (select count(*) from public.ride_passenger as rp where rp.ride_id = p_ride_id and rp.status = 'accepted')
    + (select count(*) from public.ride_return_request as rr
       where rr.ride_id = p_ride_id and rr.status = 'accepted');
$$;

-- 4. Asking for a seat home. The fan sends where they are; only the distance to the car is kept.
create function public.request_return_seat(
  p_ride_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accept_rules boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target public.ride;
  kickoff timestamptz;
  car extensions.geography;
  here extensions.geography;
  distance integer;
  people integer;
  free integer;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_accept_rules is not true then
    raise exception 'rules_not_accepted' using errcode = '22023';
  end if;
  if p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'bad_location' using errcode = '22023';
  end if;
  if public.ride_ban_until(caller) is not null then
    raise exception 'suspended' using errcode = '22023';
  end if;

  select * into target from public.ride where id = p_ride_id for update;
  if target.id is null then
    raise exception 'ride_not_found' using errcode = 'P0002';
  end if;
  if target.driver_id = caller then
    raise exception 'own_ride' using errcode = '22023';
  end if;
  if target.status <> 'open' or not target.round_trip or not target.accepts_return_requests then
    raise exception 'no_return_seats' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.ride_passenger as rp
    where rp.ride_id = p_ride_id and rp.profile_id = caller and rp.status = 'accepted'
  ) then
    raise exception 'already_going' using errcode = '22023';
  end if;

  select f.kickoff_at, v.location into kickoff, car
  from public.fixture as f
  join public.venue as v on v.id = f.venue_id
  where f.id = target.fixture_id;
  if kickoff is null then
    raise exception 'ride_not_found' using errcode = 'P0002';
  end if;
  if now() < public.ride_return_opens_at(kickoff) or now() > public.ride_return_closes_at(kickoff) then
    raise exception 'outside_window' using errcode = '22023';
  end if;

  -- Where the car is: the car park the driver chose, or the stadium when they did not choose one.
  select coalesce(ps.location, car) into car
  from public.ride as r
  left join public.parking_spot as ps on ps.id = r.parking_spot_id
  where r.id = p_ride_id;

  people := public.ride_return_people_count(p_ride_id);
  free := target.seats_offered
    - (select count(*) from public.ride_passenger as rp where rp.ride_id = p_ride_id and rp.status = 'accepted')
    - (select count(*) from public.ride_return_request as rr
       where rr.ride_id = p_ride_id and rr.status = 'accepted');
  if free <= 0 then
    raise exception 'ride_full' using errcode = '22023';
  end if;

  if not public.take_rate_limit(caller, 'ride-return-request', 10, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  here := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography;
  distance := (round(extensions.st_distance(car, here) / 100) * 100)::integer;
  -- Far enough away and it is not a seat home from this game any more.
  if distance > 20000 then
    raise exception 'too_far' using errcode = '22023';
  end if;

  insert into public.ride_return_request (
    ride_id, profile_id, status, distance_to_car_m, share_cents, rules_accepted_at
  )
  values (
    p_ride_id, caller, 'pending', distance,
    public.ride_return_share_cents(target.total_cents, people + 1), now()
  )
  on conflict (ride_id, profile_id) do update
    set status = 'pending',
        distance_to_car_m = excluded.distance_to_car_m,
        share_cents = excluded.share_cents,
        rules_accepted_at = now(),
        answered_at = null
    where public.ride_return_request.status in ('declined', 'cancelled', 'expired');
end;
$$;

-- 5. The driver answers. Accepting recomputes what each person pays: one more in the car, less each.
create function public.answer_return_request(p_ride_id uuid, p_profile_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.ride;
  kickoff timestamptz;
  free integer;
begin
  select * into target from public.ride where id = p_ride_id for update;
  if target.id is null or target.driver_id is distinct from auth.uid() then
    raise exception 'not_driver' using errcode = '42501';
  end if;
  select f.kickoff_at into kickoff from public.fixture as f where f.id = target.fixture_id;
  if now() > public.ride_return_closes_at(kickoff) + interval '1 hour' then
    raise exception 'too_late' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.ride_return_request as rr
    where rr.ride_id = p_ride_id and rr.profile_id = p_profile_id and rr.status = 'pending'
  ) then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;

  if p_accept then
    free := target.seats_offered
      - (select count(*) from public.ride_passenger as rp where rp.ride_id = p_ride_id and rp.status = 'accepted')
      - (select count(*) from public.ride_return_request as rr
         where rr.ride_id = p_ride_id and rr.status = 'accepted');
    if free <= 0 then
      raise exception 'ride_full' using errcode = '22023';
    end if;
  end if;

  update public.ride_return_request
  set status = case when p_accept then 'accepted' else 'declined' end, answered_at = now()
  where ride_id = p_ride_id and profile_id = p_profile_id;

  if p_accept then
    update public.ride_return_request
    set share_cents = public.ride_return_share_cents(
      target.total_cents, public.ride_return_people_count(p_ride_id)
    )
    where ride_id = p_ride_id and status = 'accepted';
  end if;
end;
$$;

-- 6. The fan gives up the seat home (found another way, or asked more than one driver).
create function public.cancel_return_request(p_ride_id uuid)
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
  update public.ride_return_request
  set status = 'cancelled'
  where ride_id = p_ride_id and profile_id = caller and status in ('pending', 'accepted');
  if not found then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
  -- One less in the car on the way back: the others pay a little more.
  update public.ride_return_request as rr
  set share_cents = public.ride_return_share_cents(r.total_cents, public.ride_return_people_count(p_ride_id))
  from public.ride as r
  where r.id = p_ride_id and rr.ride_id = p_ride_id and rr.status = 'accepted';
end;
$$;

-- 7. Rides going back with room, for a fan looking for a way home. No exact positions: the car park's, at most.
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
    and now() between public.ride_return_opens_at(f.kickoff_at) and public.ride_return_closes_at(f.kickoff_at)
    and (r.seats_offered - taken.n - back.n) > 0
  order by (r.seats_offered - taken.n - back.n) desc, p.display_name;
$$;

-- 8. Who asked for a seat home in this ride. Only the driver sees the people waiting for an answer; a fan sees
-- their own request. Never a position — only how far away they said they were.
create function public.ride_return_people(p_ride_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  status text,
  distance_to_car_m integer,
  share_cents integer,
  completed integer,
  faults integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select rr.profile_id, p.display_name, rr.status, rr.distance_to_car_m, rr.share_cents, rep.completed, rep.faults
  from public.ride_return_request as rr
  join public.profile as p on p.id = rr.profile_id
  join public.ride as r on r.id = rr.ride_id
  cross join lateral public.ride_reputation(array[rr.profile_id]) as rep
  where rr.ride_id = p_ride_id
    and auth.uid() is not null
    and (r.driver_id = auth.uid() or rr.profile_id = auth.uid())
    and rr.status in ('pending', 'accepted')
  order by rr.created_at;
$$;

revoke execute on function public.request_return_seat(uuid, double precision, double precision, boolean)
  from public, anon;
revoke execute on function public.answer_return_request(uuid, uuid, boolean) from public, anon;
revoke execute on function public.cancel_return_request(uuid) from public, anon;
revoke execute on function public.ride_return_board(text) from public, anon;
revoke execute on function public.ride_return_people(uuid) from public, anon;
revoke execute on function public.ride_return_people_count(uuid) from public, anon, authenticated;
grant execute on function public.request_return_seat(uuid, double precision, double precision, boolean)
  to authenticated;
grant execute on function public.answer_return_request(uuid, uuid, boolean) to authenticated;
grant execute on function public.cancel_return_request(uuid) to authenticated;
grant execute on function public.ride_return_board(text) to authenticated;
grant execute on function public.ride_return_people(uuid) to authenticated;

-- 9. A seat home is a seat: the same reliability rules, so being accepted and not turning up is a fault.
create or replace function public.ride_role(p_ride_id uuid, p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.ride as r where r.id = p_ride_id and r.driver_id = p_profile_id) then 'driver'
    when exists (
      select 1 from public.ride_passenger as rp
      where rp.ride_id = p_ride_id and rp.profile_id = p_profile_id and rp.status in ('accepted', 'left_late')
    ) then 'passenger'
    when exists (
      select 1 from public.ride_return_request as rr
      where rr.ride_id = p_ride_id and rr.profile_id = p_profile_id and rr.status = 'accepted'
    ) then 'passenger'
  end;
$$;

-- 10. Notifications: the driver hears about a request for a seat home, the fan hears the answer.
create or replace function public.notify_ride_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if tg_table_name = 'ride_passenger' then
    payload := jsonb_build_object(
      'kind', 'passenger',
      'ride_id', new.ride_id,
      'profile_id', new.profile_id,
      'status', new.status,
      'old_status', case when tg_op = 'UPDATE' then old.status end
    );
  elsif tg_table_name = 'ride_return_request' then
    payload := jsonb_build_object(
      'kind', 'return',
      'ride_id', new.ride_id,
      'profile_id', new.profile_id,
      'status', new.status,
      'old_status', case when tg_op = 'UPDATE' then old.status end,
      'distance_m', new.distance_to_car_m,
      'share_cents', new.share_cents
    );
  else
    payload := jsonb_build_object('kind', 'ride', 'ride_id', new.id, 'status', new.status, 'old_status', old.status);
  end if;

  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ride-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := payload,
    timeout_milliseconds := 10000
  );
  return null;
exception when others then
  -- A notification must never block a request or an answer.
  return null;
end;
$$;

create trigger ride_return_request_notify
  after insert or update of status on public.ride_return_request
  for each row
  execute function public.notify_ride_change();

-- 11. Alerts at the top of the app: requests to answer, and the answer when it comes.
create or replace function public.my_ride_alerts()
returns table (
  kind text,
  ride_id uuid,
  fixture_id text,
  pending integer,
  requests_close_at timestamptz,
  departure_at timestamptz,
  driver_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Requests waiting for the driver's answer.
  select 'pedidos', r.id, r.fixture_id, count(rp.profile_id)::integer,
    public.ride_requests_close_at(r.departure_at), r.departure_at, null::text
  from public.ride as r
  join public.ride_passenger as rp on rp.ride_id = r.id and rp.status = 'requested'
  where r.driver_id = auth.uid() and r.status = 'open' and now() < public.ride_requests_close_at(r.departure_at)
  group by r.id
  union all
  -- Seats confirmed, until departure.
  select 'aceite', r.id, r.fixture_id, 0, public.ride_requests_close_at(r.departure_at), r.departure_at, p.display_name
  from public.ride_passenger as rp
  join public.ride as r on r.id = rp.ride_id
  join public.profile as p on p.id = r.driver_id
  where rp.profile_id = auth.uid() and rp.status = 'accepted' and r.status = 'open' and r.departure_at > now()
  union all
  -- Requests declined or left unanswered, for a day.
  select case when rp.status = 'expired' then 'sem_resposta' else 'recusado' end, r.id, r.fixture_id, 0,
    public.ride_requests_close_at(r.departure_at), r.departure_at, p.display_name
  from public.ride_passenger as rp
  join public.ride as r on r.id = rp.ride_id
  join public.profile as p on p.id = r.driver_id
  where rp.profile_id = auth.uid() and rp.status in ('declined', 'expired')
    and rp.updated_at > now() - interval '24 hours' and r.departure_at > now()
  union all
  -- Rides the fan had a seat in and the driver cancelled, for a day.
  select 'cancelada', r.id, r.fixture_id, 0, public.ride_requests_close_at(r.departure_at), r.departure_at, p.display_name
  from public.ride_passenger as rp
  join public.ride as r on r.id = rp.ride_id
  join public.profile as p on p.id = r.driver_id
  where rp.profile_id = auth.uid() and rp.status = 'accepted' and r.status = 'cancelled'
    and r.cancelled_at > now() - interval '24 hours' and r.departure_at > now() - interval '1 hour'
  union all
  -- Someone asking for a seat home, while the window is open: the most urgent thing there is.
  select 'volta_pedidos', r.id, r.fixture_id, count(rr.profile_id)::integer,
    public.ride_return_closes_at(f.kickoff_at), r.departure_at, null::text
  from public.ride as r
  join public.fixture as f on f.id = r.fixture_id
  join public.ride_return_request as rr on rr.ride_id = r.id and rr.status = 'pending'
  where r.driver_id = auth.uid() and r.status = 'open'
    and now() < public.ride_return_closes_at(f.kickoff_at) + interval '1 hour'
  group by r.id, f.kickoff_at
  union all
  -- The answer to the fan who asked for a seat home.
  select case when rr.status = 'accepted' then 'volta_aceite' else 'volta_recusado' end,
    r.id, r.fixture_id, 0, public.ride_return_closes_at(f.kickoff_at), r.departure_at, p.display_name
  from public.ride_return_request as rr
  join public.ride as r on r.id = rr.ride_id
  join public.fixture as f on f.id = r.fixture_id
  join public.profile as p on p.id = r.driver_id
  where rr.profile_id = auth.uid() and rr.status in ('accepted', 'declined')
    and rr.updated_at > now() - interval '6 hours'
  order by 1 desc, 6;
$$;

-- 12. Settling a ride now counts the seats home too.
create or replace function public.settle_rides()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.ride;
  person record;
  settled integer := 0;
  late boolean;
  said_no integer;
  said_yes integer;
  excused boolean;
  disputed boolean;
  result text;
begin
  for target in
    select * from public.ride
    where settled_at is null and departure_at + interval '72 hours' < now()
    for update skip locked
  loop
    -- A ride cancelled before the deadline, or that nobody joined, leaves no outcomes.
    if (target.status = 'cancelled' and target.cancelled_at < public.ride_requests_close_at(target.departure_at))
      or not exists (
        select 1 from public.ride_passenger
        where ride_id = target.id and status in ('accepted', 'left_late')
        union all
        select 1 from public.ride_return_request
        where ride_id = target.id and status = 'accepted'
      ) then
      update public.ride set settled_at = now() where id = target.id;
      settled := settled + 1;
      continue;
    end if;

    for person in
      select target.driver_id as profile_id, 'driver' as role
      union all
      select rp.profile_id, 'passenger' from public.ride_passenger as rp
      where rp.ride_id = target.id and rp.status in ('accepted', 'left_late')
      union all
      select rr.profile_id, 'passenger' from public.ride_return_request as rr
      where rr.ride_id = target.id and rr.status = 'accepted'
        and not exists (
          select 1 from public.ride_passenger as rp
          where rp.ride_id = target.id and rp.profile_id = rr.profile_id
            and rp.status in ('accepted', 'left_late')
        )
    loop
      late := case
        when person.role = 'driver' then target.status = 'cancelled'
        else exists (
          select 1 from public.ride_passenger
          where ride_id = target.id and profile_id = person.profile_id and status = 'left_late'
        )
      end;

      select count(*) filter (where not a.showed_up), count(*) filter (where a.showed_up)
      into said_no, said_yes
      from public.ride_attendance as a
      where a.ride_id = target.id and a.subject_id = person.profile_id;

      -- Accepted unless more people rejected the excuse than accepted it.
      excused := exists (
        select 1 from public.ride_incident as i
        where i.ride_id = target.id and i.profile_id = person.profile_id
          and (select count(*) from public.ride_incident_vote as v where v.incident_id = i.id and not v.accept)
            <= (select count(*) from public.ride_incident_vote as v where v.incident_id = i.id and v.accept)
      );

      -- Everyone who said this person did not turn up was, in turn, said by this person not to have turned up.
      disputed := said_no > 0 and not exists (
        select 1 from public.ride_attendance as a
        where a.ride_id = target.id and a.subject_id = person.profile_id and not a.showed_up
          and not exists (
            select 1 from public.ride_attendance as b
            where b.ride_id = target.id and b.reporter_id = person.profile_id
              and b.subject_id = a.reporter_id and not b.showed_up
          )
      );

      result := case
        when excused then 'excused'
        when late then 'late_cancel'
        when disputed then 'dispute'
        when said_no > said_yes then 'no_show'
        else 'completed'
      end;

      insert into public.ride_outcome (ride_id, profile_id, role, outcome)
      values (target.id, person.profile_id, person.role, result)
      on conflict (ride_id, profile_id) do update set outcome = excluded.outcome;
    end loop;

    update public.ride set settled_at = now() where id = target.id;
    settled := settled + 1;
  end loop;
  return settled;
end;
$$;
