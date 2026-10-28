-- Viagens da Casa (docs/superpowers/specs/2026-10-28-viagens-da-casa-design.md): a verified Casa publishes a trip to a
-- game of its club, with one or more vehicles (autocarro, minibus, carrinha) and the stops where they pass.
--
-- * A fan of the Casa's club books a seat at a stop, with up to 10 named companions; the whole booking goes to the
--   first vehicle (by label) with room for all of them, or, if none has room, to the waiting list, never split.
-- * When someone cancels, is removed, or a vehicle gets more seats, the waiting list moves up by order of arrival; a
--   booking that still does not fit stays put and smaller ones behind it may go first.
-- * One transport per person per game: a `booked` booking blocks a seat (asked or accepted) or a ride offered in the
--   same game, and vice versa. Only `booked` counts; `waiting` does not. Whoever reaches the top of the waiting list
--   while already in a car (or on another Casa trip) leaves the list (`cancelled/other_transport`).
-- * Managers keep the list: move people between vehicles, mark paid / boarded, add people without the app, close and
--   reopen bookings, add vehicles, cancel the trip, and write notices to the passengers.
-- * Every amount the app shows (free seats, occupied, waiting, paid, due) is computed here: due = price × people.
--
-- All writes go through the functions below (security definer). Every path that books, moves or promotes locks the
-- trip row first (`for update`), so two people taking the last seat end up one `booked`, one `waiting`. The «one
-- transport» checks take a transaction advisory lock per (person, game), shared with the car triggers.
--
-- Also here (from the Task 1 review): a suspended Casa is frozen. Its trips are cancelled when it is suspended, and
-- the owner/manager functions refuse with `club_suspended`.

-- =====================================================================================================================
-- 1. The member code of a Casa («só sócios» trips ask for it). Only managers read it, through a function: the column
--    is left out of the select grant on supporters_club.

alter table public.supporters_club
  add column member_code text check (member_code is null or member_code ~ '^[a-z0-9]{10}$');

revoke select on public.supporters_club from authenticated;
grant select (
  id, club_id, name, municipality_id, contact_email, status, requested_by, verified_at, verified_by, created_at,
  updated_at
) on public.supporters_club to authenticated;

-- =====================================================================================================================
-- 2. Tables.

create table public.club_trip (
  id uuid primary key default gen_random_uuid(),
  supporters_club_id uuid not null references public.supporters_club (id) on delete cascade,
  fixture_id text not null references public.fixture (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 3 and 60),
  -- Capped at 1000 € so that price × people summed over a trip always fits an integer.
  price_cents integer not null check (price_cents between 0 and 100000),
  members_only boolean not null default false,
  bookings_close_at timestamptz not null,
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  created_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index club_trip_fixture_idx on public.club_trip (fixture_id) where status <> 'cancelled';
create index club_trip_supporters_club_idx on public.club_trip (supporters_club_id);

create table public.club_trip_stop (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.club_trip (id) on delete cascade,
  position integer not null check (position between 1 and 8),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  -- A public place of the Casa (its seat, a square), never a person's location.
  location extensions.geography(point, 4326) not null,
  passes_at timestamptz not null,
  unique (trip_id, position)
);

create table public.club_trip_vehicle (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.club_trip (id) on delete cascade,
  kind text not null check (kind in ('autocarro', 'minibus', 'carrinha')),
  label text not null check (char_length(btrim(label)) between 1 and 40),
  seats integer not null check (seats between 1 and 80),
  created_at timestamptz not null default now()
);

create index club_trip_vehicle_trip_idx on public.club_trip_vehicle (trip_id);

-- Companions are names only (children, family, members without the app): up to 10, each 2–60 characters.
create function public.club_trip_companions_ok(p_companions text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(p_companions) <= 10
    and not exists (
      select 1 from unnest(p_companions) as c
      where c is null or char_length(btrim(c)) not between 2 and 60
    );
$$;

create table public.club_trip_booking (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.club_trip (id) on delete cascade,
  profile_id uuid references public.profile (id) on delete cascade,
  manual_name text check (manual_name is null or char_length(btrim(manual_name)) between 2 and 60),
  stop_id uuid not null references public.club_trip_stop (id),
  vehicle_id uuid references public.club_trip_vehicle (id) on delete set null,
  companions text[] not null default '{}' check (public.club_trip_companions_ok(companions)),
  people integer generated always as (1 + cardinality(companions)) stored,
  status text not null check (status in ('booked', 'waiting', 'cancelled')),
  cancel_reason text check (cancel_reason in ('self', 'manager', 'other_transport', 'trip_cancelled')),
  paid_at timestamptz,
  boarded_at timestamptz,
  created_by uuid references public.profile (id) on delete set null,
  -- clock_timestamp: the waiting list is ordered by arrival, also between bookings made in the same transaction.
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now(),
  constraint club_trip_booking_person_or_name check ((profile_id is null) <> (manual_name is null)),
  constraint club_trip_booking_reason check ((status = 'cancelled') = (cancel_reason is not null)),
  constraint club_trip_booking_vehicle check (
    (status = 'booked' and vehicle_id is not null) or (status = 'waiting' and vehicle_id is null) or status = 'cancelled'
  )
);

create unique index club_trip_booking_one_per_person_idx
  on public.club_trip_booking (trip_id, profile_id)
  where status <> 'cancelled' and profile_id is not null;
create index club_trip_booking_trip_idx on public.club_trip_booking (trip_id, status, created_at);
create index club_trip_booking_vehicle_idx on public.club_trip_booking (vehicle_id) where status = 'booked';
create index club_trip_booking_profile_idx on public.club_trip_booking (profile_id) where status <> 'cancelled';
create index club_trip_booking_stop_idx on public.club_trip_booking (stop_id);

create table public.club_trip_notice (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.club_trip (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now()
);

create index club_trip_notice_trip_idx on public.club_trip_notice (trip_id, created_at);

create trigger club_trip_set_updated_at
  before update on public.club_trip
  for each row execute function public.set_updated_at();

create trigger club_trip_booking_set_updated_at
  before update on public.club_trip_booking
  for each row execute function public.set_updated_at();

-- =====================================================================================================================
-- 3. Helpers for the policies (callable by signed-in people, like is_supporters_club_manager).

/** Can I see this trip? Trips of verified Casas, or of a Casa I manage. */
create function public.can_see_club_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.club_trip as t
    join public.supporters_club as s on s.id = t.supporters_club_id
    where t.id = p_trip_id
      and (s.status = 'verified' or public.is_supporters_club_manager(s.id))
  );
$$;

/** Am I a manager of the Casa of this trip? */
create function public.is_club_trip_manager(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.club_trip as t
    where t.id = p_trip_id and public.is_supporters_club_manager(t.supporters_club_id)
  );
$$;

-- =====================================================================================================================
-- 4. RLS: read-only for the app.

alter table public.club_trip enable row level security;
alter table public.club_trip_stop enable row level security;
alter table public.club_trip_vehicle enable row level security;
alter table public.club_trip_booking enable row level security;
alter table public.club_trip_notice enable row level security;

revoke all on public.club_trip from anon, authenticated;
revoke all on public.club_trip_stop from anon, authenticated;
revoke all on public.club_trip_vehicle from anon, authenticated;
revoke all on public.club_trip_booking from anon, authenticated;
revoke all on public.club_trip_notice from anon, authenticated;

grant select on public.club_trip to authenticated;
grant select on public.club_trip_stop to authenticated;
grant select on public.club_trip_vehicle to authenticated;
grant select on public.club_trip_booking to authenticated;
grant select on public.club_trip_notice to authenticated;

create policy "trips of verified casas, or of the casa I manage"
  on public.club_trip for select to authenticated
  using (public.can_see_club_trip(id));

create policy "stops of the trips I can see"
  on public.club_trip_stop for select to authenticated
  using (public.can_see_club_trip(trip_id));

create policy "vehicles of the trips I can see"
  on public.club_trip_vehicle for select to authenticated
  using (public.can_see_club_trip(trip_id));

-- The passenger list is the Casa's: a passenger sees only their own booking.
create policy "my own bookings, or all of them for the casa's managers"
  on public.club_trip_booking for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_club_trip_manager(trip_id));

create policy "notices for the casa's managers and for whoever has a live booking"
  on public.club_trip_notice for select to authenticated
  using (
    public.is_club_trip_manager(trip_id)
    or exists (
      select 1 from public.club_trip_booking as b
      where b.trip_id = club_trip_notice.trip_id
        and b.profile_id = (select auth.uid())
        and b.status in ('booked', 'waiting')
    )
  );

-- =====================================================================================================================
-- 5. Internal helpers (not callable by the app).

/** Trims the companions' names and refuses a bad list (`bad_companions`). */
create function public.club_trip_clean_companions(p_companions text[])
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  limpo text[];
begin
  select coalesce(array_agg(btrim(c) order by o), '{}')
  into limpo
  from unnest(coalesce(p_companions, '{}')) with ordinality as x (c, o);
  if not public.club_trip_companions_ok(limpo) then
    raise exception 'bad_companions' using errcode = '22023';
  end if;
  return limpo;
end;
$$;

/** The trip, locked, if the caller manages its Casa and the Casa is not suspended. */
create function public.club_trip_for_manager(p_trip_id uuid)
returns public.club_trip
language plpgsql
security definer
set search_path = ''
as $$
declare
  casa uuid;
  estado text;
  viagem public.club_trip;
begin
  -- Check before locking: someone who is not a manager never holds the lock.
  select t.supporters_club_id, s.status into casa, estado
  from public.club_trip as t
  join public.supporters_club as s on s.id = t.supporters_club_id
  where t.id = p_trip_id;
  if auth.uid() is null or casa is null or not public.is_supporters_club_manager(casa) then
    raise exception 'not_manager' using errcode = '42501';
  end if;
  if estado = 'suspended' then
    raise exception 'club_suspended' using errcode = '22023';
  end if;

  select * into viagem from public.club_trip where id = p_trip_id for update;
  return viagem;
end;
$$;

/** The first vehicle of the trip (by label) with room for `p_people` booked people, or null. Call with the trip locked. */
create function public.club_trip_free_vehicle(p_trip_id uuid, p_people integer)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select v.id
  from public.club_trip_vehicle as v
  where v.trip_id = p_trip_id
    and v.seats - coalesce((
      select sum(b.people) from public.club_trip_booking as b
      where b.vehicle_id = v.id and b.status = 'booked'
    ), 0) >= p_people
  order by v.label, v.id
  limit 1;
$$;

/** Serialises the «one transport per game» checks of one person for one game (cars and Casa trips alike). */
create function public.lock_one_transport(p_profile_id uuid, p_fixture_id text)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('one-transport:' || p_profile_id::text || ':' || p_fixture_id, 0));
$$;

/**
 * Does this person already have another transport for the game? 'already_in_car' (a seat asked or accepted, or a
 * ride offered, in an open ride), 'already_on_club_trip' (booked on another Casa trip), or null. Takes the lock.
 */
create function public.club_trip_conflict(p_profile_id uuid, p_fixture_id text, p_trip_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lock_one_transport(p_profile_id, p_fixture_id);
  if exists (
    select 1 from public.ride as r
    where r.driver_id = p_profile_id and r.fixture_id = p_fixture_id and r.status = 'open'
  ) or exists (
    select 1
    from public.ride_passenger as rp
    join public.ride as r on r.id = rp.ride_id
    where rp.profile_id = p_profile_id
      and rp.status in ('requested', 'accepted')
      and r.fixture_id = p_fixture_id
      and r.status = 'open'
  ) then
    return 'already_in_car';
  end if;
  if exists (
    select 1
    from public.club_trip_booking as b
    join public.club_trip as t on t.id = b.trip_id
    where b.profile_id = p_profile_id
      and b.status = 'booked'
      and t.fixture_id = p_fixture_id
      and t.id <> p_trip_id
  ) then
    return 'already_on_club_trip';
  end if;
  return null;
end;
$$;

/**
 * Moves the waiting list up, by order of arrival. Whoever meanwhile got another transport for the game leaves the
 * list (`cancelled/other_transport`); a booking that does not fit stays waiting and the later (smaller) ones may go.
 */
create function public.promote_club_trip_waiting(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viagem public.club_trip;
  pedido record;
  carro uuid;
begin
  select * into viagem from public.club_trip where id = p_trip_id for update;
  if viagem.id is null or viagem.status = 'cancelled' then
    return;
  end if;

  for pedido in
    select b.id, b.profile_id, b.people
    from public.club_trip_booking as b
    where b.trip_id = p_trip_id and b.status = 'waiting'
    order by b.created_at, b.id
  loop
    if pedido.profile_id is not null
       and public.club_trip_conflict(pedido.profile_id, viagem.fixture_id, p_trip_id) is not null then
      update public.club_trip_booking
      set status = 'cancelled', cancel_reason = 'other_transport'
      where id = pedido.id;
      continue;
    end if;

    carro := public.club_trip_free_vehicle(p_trip_id, pedido.people);
    if carro is not null then
      update public.club_trip_booking set status = 'booked', vehicle_id = carro where id = pedido.id;
    end if;
  end loop;
end;
$$;

/** Cancels a trip and every live booking in it (`cancelled/trip_cancelled`). */
create function public.club_trip_cancel(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.club_trip where id = p_trip_id for update;
  update public.club_trip set status = 'cancelled' where id = p_trip_id and status <> 'cancelled';
  update public.club_trip_booking
  set status = 'cancelled', cancel_reason = 'trip_cancelled'
  where trip_id = p_trip_id and status in ('booked', 'waiting');
end;
$$;

-- =====================================================================================================================
-- 6. One transport per person per game: triggers in both directions (like 20261009140000_one_car_per_game.sql).

-- A booking becoming `booked` is refused when the person is in a car (or booked on another Casa trip) for the game.
-- Promotion checks first and cancels instead, so it never reaches this refusal.
create function public.club_trip_booking_one_transport()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jogo text;
  conflito text;
begin
  if new.status <> 'booked' or new.profile_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'booked' then
    return new;
  end if;
  select t.fixture_id into jogo from public.club_trip as t where t.id = new.trip_id;
  conflito := public.club_trip_conflict(new.profile_id, jogo, new.trip_id);
  if conflito is not null then
    raise exception '%', conflito using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger club_trip_booking_one_transport_per_game
  before insert or update of status on public.club_trip_booking
  for each row execute function public.club_trip_booking_one_transport();

-- A booked seat is going to the game, like a seat in a car.
create function public.club_trip_booking_marks_going()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jogo text;
begin
  select t.fixture_id into jogo from public.club_trip as t where t.id = new.trip_id;
  if jogo is not null then
    perform public.mark_going_to_fixture(new.profile_id, jogo);
  end if;
  return null;
end;
$$;

create trigger club_trip_booking_booked_marks_going
  after insert on public.club_trip_booking
  for each row
  when (new.status = 'booked' and new.profile_id is not null)
  execute function public.club_trip_booking_marks_going();

create trigger club_trip_booking_booked_change_marks_going
  after update of status on public.club_trip_booking
  for each row
  when (new.status = 'booked' and old.status is distinct from 'booked' and new.profile_id is not null)
  execute function public.club_trip_booking_marks_going();

-- Asking for or getting a seat in a car is refused while booked on a Casa trip of that game.
create function public.ride_passenger_not_on_club_trip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jogo text;
begin
  if new.status not in ('requested', 'accepted') then
    return new;
  end if;
  select r.fixture_id into jogo from public.ride as r where r.id = new.ride_id;
  if jogo is null then
    return new;
  end if;
  perform public.lock_one_transport(new.profile_id, jogo);
  if exists (
    select 1
    from public.club_trip_booking as b
    join public.club_trip as t on t.id = b.trip_id
    where b.profile_id = new.profile_id and b.status = 'booked' and t.fixture_id = jogo
  ) then
    raise exception 'already_on_club_trip' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger ride_passenger_not_on_club_trip
  before insert or update of status on public.ride_passenger
  for each row execute function public.ride_passenger_not_on_club_trip();

-- Offering a car is refused while booked on a Casa trip of that game.
create function public.ride_driver_not_on_club_trip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'open' then
    return new;
  end if;
  perform public.lock_one_transport(new.driver_id, new.fixture_id);
  if exists (
    select 1
    from public.club_trip_booking as b
    join public.club_trip as t on t.id = b.trip_id
    where b.profile_id = new.driver_id and b.status = 'booked' and t.fixture_id = new.fixture_id
  ) then
    raise exception 'already_on_club_trip' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger ride_driver_not_on_club_trip
  before insert or update of status on public.ride
  for each row execute function public.ride_driver_not_on_club_trip();

-- =====================================================================================================================
-- 7. Managers: publish a trip, its vehicles, its status.

create function public.create_club_trip(
  p_club_id uuid,
  p_fixture_id text,
  p_name text,
  p_price_cents integer,
  p_members_only boolean,
  p_bookings_close_at timestamptz,
  p_note text,
  p_stops jsonb,
  p_vehicles jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  casa public.supporters_club;
  jogo public.fixture;
  nome text := btrim(coalesce(p_name, ''));
  nota text := nullif(btrim(coalesce(p_note, '')), '');
  nova uuid;
  item jsonb;
  posicao bigint;
  parada_nome text;
  lat double precision;
  lng double precision;
  hora timestamptz;
  tipo text;
  rotulo text;
  lugares integer;
begin
  if caller is null or not public.is_supporters_club_manager(p_club_id) then
    raise exception 'not_manager' using errcode = '42501';
  end if;
  select * into casa from public.supporters_club where id = p_club_id;
  if casa.status = 'suspended' then
    raise exception 'club_suspended' using errcode = '22023';
  end if;
  if casa.status <> 'verified' then
    raise exception 'club_not_verified' using errcode = '22023';
  end if;

  select * into jogo from public.fixture where id = p_fixture_id;
  if jogo.id is null or casa.club_id not in (jogo.home_club_id, jogo.away_club_id) then
    raise exception 'wrong_fixture' using errcode = '22023';
  end if;
  if jogo.kickoff_at <= now() then
    raise exception 'fixture_started' using errcode = '22023';
  end if;
  if char_length(nome) < 3 or char_length(nome) > 60 then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  if p_price_cents is null or p_price_cents < 0 or p_price_cents > 100000 then
    raise exception 'bad_price' using errcode = '22023';
  end if;
  if p_bookings_close_at is null or p_bookings_close_at <= now() or p_bookings_close_at > jogo.kickoff_at then
    raise exception 'bad_bookings_close_at' using errcode = '22023';
  end if;
  if nota is not null and char_length(nota) > 300 then
    raise exception 'bad_note' using errcode = '22023';
  end if;
  if p_stops is null or jsonb_typeof(p_stops) <> 'array' or jsonb_array_length(p_stops) not between 1 and 8 then
    raise exception 'bad_stops' using errcode = '22023';
  end if;
  if p_vehicles is null or jsonb_typeof(p_vehicles) <> 'array'
     or jsonb_array_length(p_vehicles) not between 1 and 10 then
    raise exception 'bad_vehicles' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'club-trip-create', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  -- A «só sócios» trip needs the Casa's member code: create it the first time.
  if coalesce(p_members_only, false) and casa.member_code is null then
    update public.supporters_club set member_code = public.new_invite_code() where id = p_club_id;
  end if;

  insert into public.club_trip (
    supporters_club_id, fixture_id, name, price_cents, members_only, bookings_close_at, note, created_by
  )
  values (p_club_id, jogo.id, nome, p_price_cents, coalesce(p_members_only, false), p_bookings_close_at, nota, caller)
  returning id into nova;

  for item, posicao in select value, ordinality from jsonb_array_elements(p_stops) with ordinality loop
    begin
      parada_nome := btrim(coalesce(item ->> 'name', ''));
      lat := (item ->> 'lat')::double precision;
      lng := (item ->> 'lng')::double precision;
      hora := (item ->> 'passes_at')::timestamptz;
    exception when others then
      raise exception 'bad_stop' using errcode = '22023';
    end;
    if char_length(parada_nome) not between 2 and 80
       or lat is null or lng is null or lat not between -90 and 90 or lng not between -180 and 180
       or hora is null or hora <= now() or hora > jogo.kickoff_at then
      raise exception 'bad_stop' using errcode = '22023';
    end if;
    insert into public.club_trip_stop (trip_id, position, name, location, passes_at)
    values (
      nova, posicao, parada_nome,
      extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography, hora
    );
  end loop;

  for item in select value from jsonb_array_elements(p_vehicles) loop
    begin
      tipo := item ->> 'kind';
      rotulo := btrim(coalesce(item ->> 'label', ''));
      lugares := (item ->> 'seats')::integer;
    exception when others then
      raise exception 'bad_vehicle' using errcode = '22023';
    end;
    if tipo is null or tipo not in ('autocarro', 'minibus', 'carrinha')
       or char_length(rotulo) not between 1 and 40 or lugares is null or lugares not between 1 and 80 then
      raise exception 'bad_vehicle' using errcode = '22023';
    end if;
    insert into public.club_trip_vehicle (trip_id, kind, label, seats) values (nova, tipo, rotulo, lugares);
  end loop;

  return nova;
end;
$$;

-- A new vehicle when the waiting list grows: the waiting list moves up into it.
create function public.add_club_trip_vehicle(p_trip_id uuid, p_kind text, p_label text, p_seats integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  viagem public.club_trip := public.club_trip_for_manager(p_trip_id);
  rotulo text := btrim(coalesce(p_label, ''));
  novo uuid;
begin
  if viagem.status = 'cancelled' then
    raise exception 'trip_cancelled' using errcode = '22023';
  end if;
  if p_kind is null or p_kind not in ('autocarro', 'minibus', 'carrinha')
     or char_length(rotulo) not between 1 and 40 or p_seats is null or p_seats not between 1 and 80 then
    raise exception 'bad_vehicle' using errcode = '22023';
  end if;
  if (select count(*) from public.club_trip_vehicle where trip_id = p_trip_id) >= 10 then
    raise exception 'too_many_vehicles' using errcode = '22023';
  end if;

  insert into public.club_trip_vehicle (trip_id, kind, label, seats)
  values (p_trip_id, p_kind, rotulo, p_seats)
  returning id into novo;

  perform public.promote_club_trip_waiting(p_trip_id);
  return novo;
end;
$$;

-- Rename a vehicle or change its seats; never below the people already in it.
create function public.update_club_trip_vehicle(p_vehicle_id uuid, p_label text, p_seats integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viagem public.club_trip;
  rotulo text := btrim(coalesce(p_label, ''));
  ocupados integer;
begin
  viagem := public.club_trip_for_manager((select trip_id from public.club_trip_vehicle where id = p_vehicle_id));
  if viagem.status = 'cancelled' then
    raise exception 'trip_cancelled' using errcode = '22023';
  end if;
  if char_length(rotulo) not between 1 and 40 or p_seats is null or p_seats not between 1 and 80 then
    raise exception 'bad_vehicle' using errcode = '22023';
  end if;
  select coalesce(sum(people), 0) into ocupados
  from public.club_trip_booking
  where vehicle_id = p_vehicle_id and status = 'booked';
  if p_seats < ocupados then
    raise exception 'vehicle_not_empty' using errcode = '22023';
  end if;

  update public.club_trip_vehicle set label = rotulo, seats = p_seats where id = p_vehicle_id;
  perform public.promote_club_trip_waiting(viagem.id);
end;
$$;

-- Remove an empty vehicle. The last one stays: a trip always has at least one.
create function public.remove_club_trip_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viagem public.club_trip;
begin
  viagem := public.club_trip_for_manager((select trip_id from public.club_trip_vehicle where id = p_vehicle_id));
  if exists (select 1 from public.club_trip_booking where vehicle_id = p_vehicle_id and status = 'booked') then
    raise exception 'vehicle_not_empty' using errcode = '22023';
  end if;
  if (select count(*) from public.club_trip_vehicle where trip_id = viagem.id) <= 1 then
    raise exception 'last_vehicle' using errcode = '22023';
  end if;
  delete from public.club_trip_vehicle where id = p_vehicle_id;
end;
$$;

-- Close or reopen bookings, or cancel the trip (every live booking becomes `cancelled/trip_cancelled`).
create function public.set_club_trip_status(p_trip_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viagem public.club_trip := public.club_trip_for_manager(p_trip_id);
begin
  if p_status is null or p_status not in ('open', 'closed', 'cancelled') then
    raise exception 'bad_status' using errcode = '22023';
  end if;
  if viagem.status = 'cancelled' then
    raise exception 'trip_cancelled' using errcode = '22023';
  end if;
  if p_status = viagem.status then
    return;
  end if;
  if p_status = 'cancelled' then
    perform public.club_trip_cancel(p_trip_id);
  else
    update public.club_trip set status = p_status where id = p_trip_id;
  end if;
end;
$$;

-- =====================================================================================================================
-- 8. Booking.

/**
 * Book a seat: a fan of the Casa's club (with its code, for «só sócios»), while the trip is open and before the
 * deadline. The whole booking (the caller plus companions) goes to the first vehicle with room for all, or waits.
 */
create function public.book_club_trip(p_trip_id uuid, p_stop_id uuid, p_companions text[], p_code text)
returns public.club_trip_booking
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  viagem public.club_trip;
  casa public.supporters_club;
  acompanhantes text[];
  codigo text := nullif(lower(btrim(coalesce(p_code, ''))), '');
  carro uuid;
  nova public.club_trip_booking;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.can_see_club_trip(p_trip_id) then
    raise exception 'trip_not_found' using errcode = 'P0002';
  end if;
  acompanhantes := public.club_trip_clean_companions(p_companions);
  if not public.take_rate_limit(caller, 'club-trip-book', 30, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  select * into viagem from public.club_trip where id = p_trip_id for update;
  select * into casa from public.supporters_club where id = viagem.supporters_club_id;
  if casa.status <> 'verified' then
    raise exception 'trip_not_found' using errcode = 'P0002';
  end if;
  if viagem.status <> 'open' or now() >= viagem.bookings_close_at then
    raise exception 'bookings_closed' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profile_club
    where profile_id = caller and relation = 'supporter' and club_id = casa.club_id
  ) then
    raise exception 'wrong_club' using errcode = '22023';
  end if;
  if viagem.members_only then
    if codigo is null then
      raise exception 'member_code_required' using errcode = '22023';
    end if;
    if casa.member_code is null or codigo <> casa.member_code then
      raise exception 'bad_member_code' using errcode = '22023';
    end if;
  end if;
  if not exists (select 1 from public.club_trip_stop where id = p_stop_id and trip_id = p_trip_id) then
    raise exception 'bad_stop' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.club_trip_booking
    where trip_id = p_trip_id and profile_id = caller and status <> 'cancelled'
  ) then
    raise exception 'already_booked' using errcode = '22023';
  end if;

  carro := public.club_trip_free_vehicle(p_trip_id, 1 + cardinality(acompanhantes));
  insert into public.club_trip_booking (trip_id, profile_id, stop_id, vehicle_id, companions, status, created_by)
  values (
    p_trip_id, caller, p_stop_id, carro, acompanhantes,
    case when carro is null then 'waiting' else 'booked' end, caller
  )
  returning * into nova;

  return nova;
end;
$$;

-- Cancel my own booking, until the deadline (after it, only the Casa removes people). The waiting list moves up.
create function public.cancel_my_club_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  reserva public.club_trip_booking;
  viagem public.club_trip;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select * into reserva from public.club_trip_booking where id = p_booking_id;
  if reserva.id is null or reserva.profile_id is distinct from caller or reserva.status = 'cancelled' then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  select * into viagem from public.club_trip where id = reserva.trip_id for update;
  if now() >= viagem.bookings_close_at then
    raise exception 'bookings_closed' using errcode = '22023';
  end if;

  update public.club_trip_booking
  set status = 'cancelled', cancel_reason = 'self'
  where id = p_booking_id and status <> 'cancelled';

  perform public.promote_club_trip_waiting(viagem.id);
end;
$$;

-- A manager books someone without the app (signed up at the Casa or by phone). Same rules for the vehicles.
create function public.add_manual_club_booking(p_trip_id uuid, p_name text, p_stop_id uuid, p_companions text[])
returns public.club_trip_booking
language plpgsql
security definer
set search_path = ''
as $$
declare
  viagem public.club_trip := public.club_trip_for_manager(p_trip_id);
  nome text := btrim(coalesce(p_name, ''));
  acompanhantes text[] := public.club_trip_clean_companions(p_companions);
  carro uuid;
  nova public.club_trip_booking;
begin
  if viagem.status = 'cancelled' then
    raise exception 'trip_cancelled' using errcode = '22023';
  end if;
  if char_length(nome) not between 2 and 60 then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  if not exists (select 1 from public.club_trip_stop where id = p_stop_id and trip_id = p_trip_id) then
    raise exception 'bad_stop' using errcode = '22023';
  end if;
  if (
    select count(*) from public.club_trip_booking where trip_id = p_trip_id and status <> 'cancelled'
  ) >= 1000 then
    raise exception 'too_many_bookings' using errcode = '22023';
  end if;

  carro := public.club_trip_free_vehicle(p_trip_id, 1 + cardinality(acompanhantes));
  insert into public.club_trip_booking (trip_id, manual_name, stop_id, vehicle_id, companions, status, created_by)
  values (
    p_trip_id, nome, p_stop_id, carro, acompanhantes,
    case when carro is null then 'waiting' else 'booked' end, auth.uid()
  )
  returning * into nova;

  return nova;
end;
$$;

/**
 * A manager's actions on one booking: `move` (to a vehicle with room for all its people; a waiting booking moved
 * in becomes booked), `paid` / `unpaid`, `boarded` / `not_boarded`, `remove` (the waiting list moves up).
 */
create function public.manage_club_booking(p_booking_id uuid, p_action text, p_vehicle_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reserva public.club_trip_booking;
  viagem public.club_trip;
  livres integer;
begin
  viagem := public.club_trip_for_manager((select trip_id from public.club_trip_booking where id = p_booking_id));
  select * into reserva from public.club_trip_booking where id = p_booking_id;
  if reserva.status = 'cancelled' then
    raise exception 'booking_cancelled' using errcode = '22023';
  end if;

  if p_action = 'move' then
    if viagem.status = 'cancelled' then
      raise exception 'trip_cancelled' using errcode = '22023';
    end if;
    if p_vehicle_id is null
       or not exists (select 1 from public.club_trip_vehicle where id = p_vehicle_id and trip_id = viagem.id) then
      raise exception 'bad_vehicle' using errcode = '22023';
    end if;
    if reserva.status = 'booked' and reserva.vehicle_id = p_vehicle_id then
      return;
    end if;
    select v.seats - coalesce((
      select sum(b.people) from public.club_trip_booking as b
      where b.vehicle_id = v.id and b.status = 'booked'
    ), 0) into livres
    from public.club_trip_vehicle as v where v.id = p_vehicle_id;
    if livres < reserva.people then
      raise exception 'vehicle_full' using errcode = '22023';
    end if;
    update public.club_trip_booking set status = 'booked', vehicle_id = p_vehicle_id where id = p_booking_id;
    if reserva.status = 'booked' then
      perform public.promote_club_trip_waiting(viagem.id);
    end if;
  elsif p_action = 'paid' then
    update public.club_trip_booking set paid_at = coalesce(paid_at, now()) where id = p_booking_id;
  elsif p_action = 'unpaid' then
    update public.club_trip_booking set paid_at = null where id = p_booking_id;
  elsif p_action in ('boarded', 'not_boarded') then
    if reserva.status <> 'booked' then
      raise exception 'not_booked' using errcode = '22023';
    end if;
    update public.club_trip_booking
    set boarded_at = case when p_action = 'boarded' then coalesce(boarded_at, now()) end
    where id = p_booking_id;
  elsif p_action = 'remove' then
    update public.club_trip_booking set status = 'cancelled', cancel_reason = 'manager' where id = p_booking_id;
    perform public.promote_club_trip_waiting(viagem.id);
  else
    raise exception 'bad_action' using errcode = '22023';
  end if;
end;
$$;

-- A notice to every passenger of the trip (at most 10 per trip per day).
create function public.post_club_trip_notice(p_trip_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  viagem public.club_trip := public.club_trip_for_manager(p_trip_id);
  texto text := btrim(coalesce(p_body, ''));
  novo uuid;
begin
  if char_length(texto) not between 1 and 500 then
    raise exception 'bad_body' using errcode = '22023';
  end if;
  if (
    select count(*) from public.club_trip_notice
    where trip_id = viagem.id and created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'too_many_notices' using errcode = '22023';
  end if;

  insert into public.club_trip_notice (trip_id, body, created_by)
  values (viagem.id, texto, auth.uid())
  returning id into novo;
  return novo;
end;
$$;

-- =====================================================================================================================
-- 9. Reading: totals, the trips of a game, my booking.

/**
 * One row per vehicle: seats and occupied (people booked) for everyone who can see the trip; for the Casa's managers
 * also the people waiting (the whole trip's, repeated on every row), the people paid, and what is still due
 * (price × unpaid booked people). For anyone else those three are null.
 */
create function public.club_trip_summary(p_trip_id uuid)
returns table (
  vehicle_id uuid,
  label text,
  kind text,
  seats integer,
  occupied integer,
  waiting_people integer,
  paid_people integer,
  due_cents integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  viagem public.club_trip;
  gestor boolean;
  espera integer;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.can_see_club_trip(p_trip_id) then
    raise exception 'trip_not_found' using errcode = 'P0002';
  end if;
  select * into viagem from public.club_trip as t where t.id = p_trip_id;
  gestor := public.is_supporters_club_manager(viagem.supporters_club_id);
  select coalesce(sum(b.people), 0)::integer into espera
  from public.club_trip_booking as b
  where b.trip_id = p_trip_id and b.status = 'waiting';

  return query
  select
    v.id,
    v.label,
    v.kind,
    v.seats,
    coalesce(o.ocupados, 0)::integer,
    case when gestor then espera end,
    case when gestor then coalesce(o.pagos, 0)::integer end,
    case when gestor then (viagem.price_cents * (coalesce(o.ocupados, 0) - coalesce(o.pagos, 0)))::integer end
  from public.club_trip_vehicle as v
  left join lateral (
    select sum(b.people) as ocupados, sum(b.people) filter (where b.paid_at is not null) as pagos
    from public.club_trip_booking as b
    where b.vehicle_id = v.id and b.status = 'booked'
  ) as o on true
  where v.trip_id = p_trip_id
  order by v.label, v.id;
end;
$$;

/**
 * The Casa trips (open or closed, of verified Casas) for a game, nearest first: distance from the caller's concelho
 * (profile_home) to the first stop; without a concelho, distance_km is null and they come by time. my_status is the
 * caller's live booking in each (booked / waiting), or null.
 */
create function public.club_trips_for_fixture(p_fixture_id text)
returns table (
  trip_id uuid,
  club_id uuid,
  club_name text,
  municipality_name text,
  first_stop_name text,
  first_stop_passes_at timestamptz,
  price_cents integer,
  members_only boolean,
  free_seats integer,
  distance_km integer,
  my_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := auth.uid();
  casa_minha extensions.geography;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select m.location into casa_minha
  from public.profile_home as h
  join public.municipality as m on m.id = h.municipality_id
  where h.profile_id = caller;

  return query
  select
    t.id,
    s.id,
    s.name,
    mu.name,
    fs.name,
    fs.passes_at,
    t.price_cents,
    t.members_only,
    greatest(0, coalesce(cap.lugares, 0) - coalesce(occ.pessoas, 0))::integer,
    case when casa_minha is not null
      then round(extensions.st_distance(casa_minha, fs.location) / 1000)::integer end,
    mb.status
  from public.club_trip as t
  join public.supporters_club as s on s.id = t.supporters_club_id and s.status = 'verified'
  join public.municipality as mu on mu.id = s.municipality_id
  join lateral (
    select st.name, st.passes_at, st.location
    from public.club_trip_stop as st
    where st.trip_id = t.id
    order by st.position
    limit 1
  ) as fs on true
  left join lateral (
    select sum(v.seats) as lugares from public.club_trip_vehicle as v where v.trip_id = t.id
  ) as cap on true
  left join lateral (
    select sum(b.people) as pessoas from public.club_trip_booking as b
    where b.trip_id = t.id and b.status = 'booked'
  ) as occ on true
  left join lateral (
    select b.status from public.club_trip_booking as b
    where b.trip_id = t.id and b.profile_id = caller and b.status <> 'cancelled'
    limit 1
  ) as mb on true
  where t.fixture_id = p_fixture_id and t.status in ('open', 'closed')
  order by 10 nulls last, fs.passes_at, t.id;
end;
$$;

/**
 * My booking in a trip: the live one, or else the latest (so the app can say it was cancelled). due_cents is what I
 * still owe (price × people, 0 once paid or cancelled); position_in_waiting counts from 1, only while waiting.
 */
create function public.my_club_booking(p_trip_id uuid)
returns table (
  booking_id uuid,
  status text,
  stop_name text,
  passes_at timestamptz,
  vehicle_label text,
  people integer,
  due_cents integer,
  paid boolean,
  position_in_waiting integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  return query
  select
    b.id,
    b.status,
    st.name,
    st.passes_at,
    case when b.status = 'booked' then v.label end,
    b.people,
    case when b.status = 'cancelled' or b.paid_at is not null then 0 else t.price_cents * b.people end,
    b.paid_at is not null,
    case when b.status = 'waiting' then (
      select count(*)::integer from public.club_trip_booking as w
      where w.trip_id = b.trip_id and w.status = 'waiting' and (w.created_at, w.id) <= (b.created_at, b.id)
    ) end
  from public.club_trip_booking as b
  join public.club_trip as t on t.id = b.trip_id
  join public.club_trip_stop as st on st.id = b.stop_id
  left join public.club_trip_vehicle as v on v.id = b.vehicle_id
  where b.trip_id = p_trip_id and b.profile_id = caller
  order by (b.status <> 'cancelled') desc, b.created_at desc
  limit 1;
end;
$$;

-- =====================================================================================================================
-- 10. The member code, and the Task 1 functions that a suspended Casa must refuse.

/** A manager creates (or replaces) the Casa's member code, and gets it back. */
create function public.rotate_supporters_club_member_code(p_club_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  codigo text;
begin
  if auth.uid() is null or not public.is_supporters_club_manager(p_club_id) then
    raise exception 'not_manager' using errcode = '42501';
  end if;
  if (select status from public.supporters_club where id = p_club_id) = 'suspended' then
    raise exception 'club_suspended' using errcode = '22023';
  end if;
  update public.supporters_club set member_code = public.new_invite_code() where id = p_club_id
  returning member_code into codigo;
  return codigo;
end;
$$;

/** The Casa's current member code, for its managers (the column is not readable by the app). */
create function public.supporters_club_member_code(p_club_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_supporters_club_manager(p_club_id) then
    raise exception 'not_manager' using errcode = '42501';
  end if;
  return (select member_code from public.supporters_club where id = p_club_id);
end;
$$;

-- Suspending a Casa now also cancels its open and closed trips (and every live booking in them).
create or replace function public.decide_supporters_club(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viagem uuid;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('verified', 'suspended') then
    raise exception 'bad_status' using errcode = '22023';
  end if;

  if p_status = 'verified' then
    update public.supporters_club
    set status = 'verified', verified_at = now(), verified_by = auth.uid()
    where id = p_id;
  else
    update public.supporters_club set status = 'suspended' where id = p_id;
  end if;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if p_status = 'suspended' then
    for viagem in
      select id from public.club_trip where supporters_club_id = p_id and status in ('open', 'closed')
    loop
      perform public.club_trip_cancel(viagem);
    end loop;
  end if;
end;
$$;

create or replace function public.create_supporters_club_invite(p_club_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  codigo text := public.new_invite_code();
begin
  if caller is null or not public.is_supporters_club_owner(p_club_id) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if (select status from public.supporters_club where id = p_club_id) = 'suspended' then
    raise exception 'club_suspended' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'supporters-club-invite', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.supporters_club_invite (code, club_id, created_by)
  values (codigo, p_club_id, caller);

  return codigo;
end;
$$;

create or replace function public.update_supporters_club(p_id uuid, p_name text, p_contact_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  nome text := btrim(coalesce(p_name, ''));
  email text := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
begin
  if auth.uid() is null or not public.is_supporters_club_owner(p_id) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if (select status from public.supporters_club where id = p_id) = 'suspended' then
    raise exception 'club_suspended' using errcode = '22023';
  end if;
  if char_length(nome) < 3 or char_length(nome) > 80 then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  if email is not null
     and (char_length(email) > 254 or email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'bad_email' using errcode = '22023';
  end if;

  begin
    update public.supporters_club set name = nome, contact_email = email where id = p_id;
  exception when unique_violation then
    raise exception 'name_taken' using errcode = '23505';
  end;
end;
$$;

-- =====================================================================================================================
-- 11. Grants. The app calls only the functions meant for it; internal and trigger functions are not callable.

revoke execute on function public.club_trip_companions_ok(text[]) from public, anon, authenticated;
revoke execute on function public.club_trip_clean_companions(text[]) from public, anon, authenticated;
revoke execute on function public.club_trip_for_manager(uuid) from public, anon, authenticated;
revoke execute on function public.club_trip_free_vehicle(uuid, integer) from public, anon, authenticated;
revoke execute on function public.lock_one_transport(uuid, text) from public, anon, authenticated;
revoke execute on function public.club_trip_conflict(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.promote_club_trip_waiting(uuid) from public, anon, authenticated;
revoke execute on function public.club_trip_cancel(uuid) from public, anon, authenticated;
revoke execute on function public.club_trip_booking_one_transport() from public, anon, authenticated;
revoke execute on function public.club_trip_booking_marks_going() from public, anon, authenticated;
revoke execute on function public.ride_passenger_not_on_club_trip() from public, anon, authenticated;
revoke execute on function public.ride_driver_not_on_club_trip() from public, anon, authenticated;

revoke execute on function public.can_see_club_trip(uuid) from public, anon;
revoke execute on function public.is_club_trip_manager(uuid) from public, anon;
revoke execute on function public.create_club_trip(uuid, text, text, integer, boolean, timestamptz, text, jsonb, jsonb)
  from public, anon;
revoke execute on function public.add_club_trip_vehicle(uuid, text, text, integer) from public, anon;
revoke execute on function public.update_club_trip_vehicle(uuid, text, integer) from public, anon;
revoke execute on function public.remove_club_trip_vehicle(uuid) from public, anon;
revoke execute on function public.set_club_trip_status(uuid, text) from public, anon;
revoke execute on function public.book_club_trip(uuid, uuid, text[], text) from public, anon;
revoke execute on function public.cancel_my_club_booking(uuid) from public, anon;
revoke execute on function public.add_manual_club_booking(uuid, text, uuid, text[]) from public, anon;
revoke execute on function public.manage_club_booking(uuid, text, uuid) from public, anon;
revoke execute on function public.post_club_trip_notice(uuid, text) from public, anon;
revoke execute on function public.club_trip_summary(uuid) from public, anon;
revoke execute on function public.club_trips_for_fixture(text) from public, anon;
revoke execute on function public.my_club_booking(uuid) from public, anon;
revoke execute on function public.rotate_supporters_club_member_code(uuid) from public, anon;
revoke execute on function public.supporters_club_member_code(uuid) from public, anon;
revoke execute on function public.decide_supporters_club(uuid, text) from public, anon;
revoke execute on function public.create_supporters_club_invite(uuid) from public, anon;
revoke execute on function public.update_supporters_club(uuid, text, text) from public, anon;

grant execute on function public.can_see_club_trip(uuid) to authenticated;
grant execute on function public.is_club_trip_manager(uuid) to authenticated;
grant execute on function public.create_club_trip(uuid, text, text, integer, boolean, timestamptz, text, jsonb, jsonb)
  to authenticated;
grant execute on function public.add_club_trip_vehicle(uuid, text, text, integer) to authenticated;
grant execute on function public.update_club_trip_vehicle(uuid, text, integer) to authenticated;
grant execute on function public.remove_club_trip_vehicle(uuid) to authenticated;
grant execute on function public.set_club_trip_status(uuid, text) to authenticated;
grant execute on function public.book_club_trip(uuid, uuid, text[], text) to authenticated;
grant execute on function public.cancel_my_club_booking(uuid) to authenticated;
grant execute on function public.add_manual_club_booking(uuid, text, uuid, text[]) to authenticated;
grant execute on function public.manage_club_booking(uuid, text, uuid) to authenticated;
grant execute on function public.post_club_trip_notice(uuid, text) to authenticated;
grant execute on function public.club_trip_summary(uuid) to authenticated;
grant execute on function public.club_trips_for_fixture(text) to authenticated;
grant execute on function public.my_club_booking(uuid) to authenticated;
grant execute on function public.rotate_supporters_club_member_code(uuid) to authenticated;
grant execute on function public.supporters_club_member_code(uuid) to authenticated;
grant execute on function public.decide_supporters_club(uuid, text) to authenticated;
grant execute on function public.create_supporters_club_invite(uuid) to authenticated;
grant execute on function public.update_supporters_club(uuid, text, text) to authenticated;
