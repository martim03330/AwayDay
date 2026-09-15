-- Rides people can trust (slice 3, part 2). Without payments in the app, reliability comes from rules, reputation and
-- suspensions, with room for honest mishaps:
--
-- - Deadlines: a ride is published at least 3 h before it leaves (checked in the `rides` Edge Function). Requests
--   close 2 h before departure; requests nobody answered by then expire. Until then anyone cancels without a fault.
-- - Commitment: offering a ride and asking for a seat both require accepting the rules (no-shows and late
--   cancellations mark your reputation and can suspend you).
-- - After departure: participants confirm who turned up (48 h). Anyone can report an unforeseen event (from 2 h before
--   until 24 h after) with a reason; the others vote to accept it. A tie or no votes counts as accepted.
-- - Settlement (72 h after departure, hourly job): each participant gets an outcome. A no-show (most reports say so) or
--   a late cancellation is a fault unless the excuse was accepted. When two people blame each other it is a dispute,
--   not a fault.
-- - Suspension: 2 faults in 180 days suspend rides for 30 days; 3 faults for 180 days.
-- Reputation is only ever shown as counts. Every table is closed to the app; it goes through the functions below.

-- 1. Commitment, parking and the new passenger states.
alter table public.ride
  add column rules_accepted_at timestamptz not null default now(),
  add column parking_spot_id uuid references public.parking_spot (id) on delete set null,
  add column cancelled_at timestamptz,
  add column settled_at timestamptz;

alter table public.ride_passenger
  add column rules_accepted_at timestamptz,
  add column left_at timestamptz,
  drop constraint ride_passenger_status_check,
  add constraint ride_passenger_status_check
    check (status in ('requested', 'accepted', 'declined', 'left', 'left_late', 'expired'));

create function public.ride_requests_close_at(p_departure_at timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select p_departure_at - interval '2 hours';
$$;

-- 2. What happened after departure.
create table public.ride_attendance (
  ride_id uuid not null references public.ride (id) on delete cascade,
  reporter_id uuid not null references public.profile (id) on delete cascade,
  subject_id uuid not null references public.profile (id) on delete cascade,
  showed_up boolean not null,
  created_at timestamptz not null default now(),
  primary key (ride_id, reporter_id, subject_id),
  constraint ride_attendance_not_self check (reporter_id <> subject_id)
);

create table public.ride_incident (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.ride (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  reason text not null check (reason in ('doenca', 'avaria', 'acidente_transito', 'trabalho_familia', 'outro')),
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now(),
  unique (ride_id, profile_id)
);

create table public.ride_incident_vote (
  incident_id uuid not null references public.ride_incident (id) on delete cascade,
  voter_id uuid not null references public.profile (id) on delete cascade,
  accept boolean not null,
  created_at timestamptz not null default now(),
  primary key (incident_id, voter_id)
);

create table public.ride_outcome (
  ride_id uuid not null references public.ride (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  role text not null check (role in ('driver', 'passenger')),
  outcome text not null check (outcome in ('completed', 'no_show', 'late_cancel', 'excused', 'dispute')),
  created_at timestamptz not null default now(),
  primary key (ride_id, profile_id)
);

create index ride_outcome_profile_idx on public.ride_outcome (profile_id, created_at);
create index ride_incident_ride_idx on public.ride_incident (ride_id);

alter table public.ride_attendance enable row level security;
alter table public.ride_incident enable row level security;
alter table public.ride_incident_vote enable row level security;
alter table public.ride_outcome enable row level security;
revoke all on public.ride_attendance from anon, authenticated;
revoke all on public.ride_incident from anon, authenticated;
revoke all on public.ride_incident_vote from anon, authenticated;
revoke all on public.ride_outcome from anon, authenticated;

-- 3. Who takes part in a ride: the driver and passengers who had a seat (including those who left late).
create function public.ride_role(p_ride_id uuid, p_profile_id uuid)
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
  end;
$$;

-- 4. Reputation and suspension.
create function public.ride_ban_until(p_profile_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  faults integer;
  latest timestamptz;
  until timestamptz;
begin
  select count(*), max(o.created_at) into faults, latest
  from public.ride_outcome as o
  where o.profile_id = p_profile_id
    and o.outcome in ('no_show', 'late_cancel')
    and o.created_at > now() - interval '180 days';
  if faults >= 3 then
    until := latest + interval '180 days';
  elsif faults >= 2 then
    until := latest + interval '30 days';
  end if;
  return case when until > now() then until end;
end;
$$;

create function public.ride_reputation(p_profile_ids uuid[])
returns table (profile_id uuid, completed integer, faults integer, excused integer, banned_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ids.id,
    (select count(*)::integer from public.ride_outcome as o where o.profile_id = ids.id and o.outcome = 'completed'),
    (select count(*)::integer from public.ride_outcome as o
      where o.profile_id = ids.id and o.outcome in ('no_show', 'late_cancel') and o.created_at > now() - interval '180 days'),
    (select count(*)::integer from public.ride_outcome as o where o.profile_id = ids.id and o.outcome = 'excused'),
    public.ride_ban_until(ids.id)
  from unnest(p_profile_ids) as ids (id)
  where auth.uid() is not null;
$$;

-- 5. Seats, with the deadline, the commitment and suspensions.
drop function public.request_ride_seat(uuid);

create function public.request_ride_seat(p_ride_id uuid, p_accept_rules boolean)
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

create or replace function public.answer_ride_request(p_ride_id uuid, p_profile_id uuid, p_accept boolean)
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
end;
$$;

-- Leaving before the deadline is free; leaving a seat after it is a late cancellation (a fault unless excused).
create or replace function public.leave_ride(p_ride_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
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
$$;

create or replace function public.cancel_ride(p_ride_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ride
  set status = 'cancelled', cancelled_at = now()
  where id = p_ride_id and driver_id = auth.uid() and status = 'open';
$$;

-- 6. After departure: who turned up, unforeseen events and votes.
create function public.report_ride_attendance(p_ride_id uuid, p_subject_id uuid, p_showed_up boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target public.ride;
begin
  select * into target from public.ride where id = p_ride_id;
  if target.id is null or public.ride_role(p_ride_id, caller) is null or public.ride_role(p_ride_id, p_subject_id) is null
    or caller = p_subject_id then
    raise exception 'not_participant' using errcode = '42501';
  end if;
  if now() < target.departure_at or now() > target.departure_at + interval '48 hours' then
    raise exception 'outside_window' using errcode = '22023';
  end if;
  insert into public.ride_attendance (ride_id, reporter_id, subject_id, showed_up)
  values (p_ride_id, caller, p_subject_id, p_showed_up)
  on conflict (ride_id, reporter_id, subject_id) do update set showed_up = excluded.showed_up, created_at = now();
end;
$$;

create function public.report_ride_incident(p_ride_id uuid, p_reason text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target public.ride;
begin
  select * into target from public.ride where id = p_ride_id;
  if target.id is null or public.ride_role(p_ride_id, caller) is null then
    raise exception 'not_participant' using errcode = '42501';
  end if;
  if now() < public.ride_requests_close_at(target.departure_at) or now() > target.departure_at + interval '24 hours' then
    raise exception 'outside_window' using errcode = '22023';
  end if;
  insert into public.ride_incident (ride_id, profile_id, reason, note)
  values (p_ride_id, caller, p_reason, nullif(btrim(p_note), ''))
  on conflict (ride_id, profile_id) do update set reason = excluded.reason, note = excluded.note, created_at = now();
end;
$$;

create function public.vote_ride_incident(p_incident_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  incident public.ride_incident;
  target public.ride;
begin
  select * into incident from public.ride_incident where id = p_incident_id;
  select * into target from public.ride where id = incident.ride_id;
  if incident.id is null or incident.profile_id = caller or public.ride_role(incident.ride_id, caller) is null then
    raise exception 'not_participant' using errcode = '42501';
  end if;
  if now() > target.departure_at + interval '72 hours' then
    raise exception 'outside_window' using errcode = '22023';
  end if;
  insert into public.ride_incident_vote (incident_id, voter_id, accept)
  values (p_incident_id, caller, p_accept)
  on conflict (incident_id, voter_id) do update set accept = excluded.accept, created_at = now();
end;
$$;

-- What a participant sees after departure: the unforeseen events (with votes) and their own attendance answers.
create function public.ride_incidents(p_ride_id uuid)
returns table (
  id uuid,
  profile_id uuid,
  display_name text,
  reason text,
  note text,
  created_at timestamptz,
  accepts integer,
  rejects integer,
  my_vote boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id, i.profile_id, p.display_name, i.reason, i.note, i.created_at,
    (select count(*)::integer from public.ride_incident_vote as v where v.incident_id = i.id and v.accept),
    (select count(*)::integer from public.ride_incident_vote as v where v.incident_id = i.id and not v.accept),
    (select v.accept from public.ride_incident_vote as v where v.incident_id = i.id and v.voter_id = auth.uid())
  from public.ride_incident as i
  join public.profile as p on p.id = i.profile_id
  where i.ride_id = p_ride_id and public.ride_role(p_ride_id, auth.uid()) is not null
  order by i.created_at;
$$;

create function public.my_ride_attendance(p_ride_id uuid)
returns table (subject_id uuid, showed_up boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.subject_id, a.showed_up
  from public.ride_attendance as a
  where a.ride_id = p_ride_id and a.reporter_id = auth.uid();
$$;

-- The rides the caller drives or has a seat in, from yesterday on: for reminders and follow-up.
create function public.my_rides()
returns table (id uuid, fixture_id text, origin_name text, departure_at timestamptz, role text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.fixture_id, r.origin_name, r.departure_at, public.ride_role(r.id, auth.uid()), r.status
  from public.ride as r
  where auth.uid() is not null
    and public.ride_role(r.id, auth.uid()) is not null
    and r.departure_at > now() - interval '3 days'
  order by r.departure_at;
$$;

-- 7. Settlement and expiry (service role only, from pg_cron).
create function public.expire_ride_requests()
returns integer
language sql
security definer
set search_path = ''
as $$
  with expired as (
    update public.ride_passenger as rp
    set status = 'expired'
    from public.ride as r
    where r.id = rp.ride_id and rp.status = 'requested' and now() >= public.ride_requests_close_at(r.departure_at)
    returning 1
  )
  select count(*)::integer from expired;
$$;

create function public.settle_rides()
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

      if late or said_no > said_yes then
        result := case
          when excused then 'excused'
          when not late and disputed then 'dispute'
          when late then 'late_cancel'
          else 'no_show'
        end;
      elsif target.status = 'cancelled' then
        -- Passengers of a ride the driver cancelled late did not travel, through no fault of theirs.
        result := null;
      else
        result := 'completed';
      end if;

      if result is not null then
        insert into public.ride_outcome (ride_id, profile_id, role, outcome)
        values (target.id, person.profile_id, person.role, result)
        on conflict (ride_id, profile_id) do nothing;
      end if;
    end loop;

    update public.ride set settled_at = now() where id = target.id;
    settled := settled + 1;
  end loop;
  return settled;
end;
$$;

select cron.schedule('expire-ride-requests', '*/10 * * * *', $$ select public.expire_ride_requests(); $$);
select cron.schedule('settle-rides', '17 * * * *', $$ select public.settle_rides(); $$);

-- 8. The board and the people list, now with deadlines, parking and reputation.
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
  parking_distance_m integer
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
    ps.distance_m
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
  where auth.uid() is not null
    and r.fixture_id = p_fixture_id
    and (r.status = 'open' or r.driver_id = auth.uid() or mine.profile_id is not null)
  order by r.departure_at, r.created_at;
$$;

drop function public.ride_people(uuid);

create function public.ride_people(p_ride_id uuid)
returns table (profile_id uuid, display_name text, status text, is_driver boolean, completed integer, faults integer)
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
        where rp.ride_id = p_ride_id and rp.profile_id = auth.uid() and rp.status in ('accepted', 'left_late')
      ) as is_passenger
  ),
  people as (
    select t.driver_id as profile_id, 'driver' as status, true as is_driver
    from target as t cross join caller as c
    where c.is_driver or c.is_passenger
    union all
    select rp.profile_id, rp.status, false
    from public.ride_passenger as rp cross join caller as c
    where rp.ride_id = p_ride_id
      and (
        (c.is_driver and rp.status in ('requested', 'accepted', 'left_late'))
        or (c.is_passenger and rp.status in ('accepted', 'left_late'))
      )
  )
  select pe.profile_id, p.display_name, pe.status, pe.is_driver, rep.completed, rep.faults
  from people as pe
  join public.profile as p on p.id = pe.profile_id
  cross join lateral public.ride_reputation(array[pe.profile_id]) as rep;
$$;

-- 9. Grants.
revoke execute on function public.ride_role(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.ride_requests_close_at(timestamptz) from public, anon;
revoke execute on function public.ride_ban_until(uuid) from public, anon, authenticated;
revoke execute on function public.expire_ride_requests() from public, anon, authenticated;
revoke execute on function public.settle_rides() from public, anon, authenticated;
revoke execute on function public.ride_reputation(uuid[]) from public, anon;
revoke execute on function public.request_ride_seat(uuid, boolean) from public, anon;
revoke execute on function public.report_ride_attendance(uuid, uuid, boolean) from public, anon;
revoke execute on function public.report_ride_incident(uuid, text, text) from public, anon;
revoke execute on function public.vote_ride_incident(uuid, boolean) from public, anon;
revoke execute on function public.ride_incidents(uuid) from public, anon;
revoke execute on function public.my_ride_attendance(uuid) from public, anon;
revoke execute on function public.my_rides() from public, anon;
revoke execute on function public.ride_board(text) from public, anon;
revoke execute on function public.ride_people(uuid) from public, anon;
grant execute on function public.ride_requests_close_at(timestamptz) to authenticated;
grant execute on function public.ride_reputation(uuid[]) to authenticated;
grant execute on function public.request_ride_seat(uuid, boolean) to authenticated;
grant execute on function public.report_ride_attendance(uuid, uuid, boolean) to authenticated;
grant execute on function public.report_ride_incident(uuid, text, text) to authenticated;
grant execute on function public.vote_ride_incident(uuid, boolean) to authenticated;
grant execute on function public.ride_incidents(uuid) to authenticated;
grant execute on function public.my_ride_attendance(uuid) to authenticated;
grant execute on function public.my_rides() to authenticated;
grant execute on function public.ride_board(text) to authenticated;
grant execute on function public.ride_people(uuid) to authenticated;
