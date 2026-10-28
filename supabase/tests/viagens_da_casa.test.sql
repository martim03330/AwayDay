-- Logic tests for Viagens da Casa: vehicle assignment, the waiting list, one transport per game, payments, the
-- manager's tools, «só sócios» trips, deadlines, cancelling a trip and suspending the Casa, and the notifications
-- (what the triggers send to club-trip-notify, and who is alerted about a new trip).
--
-- People: G (Gil) owns the Casa; ADM is an admin with the second factor; A, B, C, D, E, F, P, H are fans of the
-- Casa's club; R (Rui) offers a car to the same game; W is a fan of the other club.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/viagens_da_casa.test.sql

begin;

create temporary table expect_log (name text) on commit drop;
create temporary table t_ids (key text primary key, id uuid) on commit drop;
grant insert, select, update on expect_log, t_ids to authenticated, anon;

create function pg_temp.expect(p_name text, p_actual anyelement, p_expected anyelement)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAILED %: got %, expected %', p_name, p_actual, p_expected;
  end if;
  insert into expect_log values (p_name);
end;
$$;

create function pg_temp.id(p_key text)
returns uuid
language sql
as $$
  select id from t_ids where key = p_key;
$$;

create function pg_temp.as_user(p_id text)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

-- Runs a call that must be refused, and returns 'message (sqlstate)', or 'accepted'.
create function pg_temp.refusal(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return 'accepted';
exception when others then
  return sqlerrm || ' (' || sqlstate || ')';
end;
$$;

-- The status of a booking, with its vehicle's label (or its cancel reason).
-- Security definer (owned by the test session's superuser): the checks see every row, whoever is signed in.
create function pg_temp.booking(p_key text)
returns text
language sql
security definer
as $$
  select b.status || '|' || coalesce(v.label, b.cancel_reason, '-')
  from public.club_trip_booking as b
  left join public.club_trip_vehicle as v on v.id = b.vehicle_id and b.status = 'booked'
  where b.id = pg_temp.id(p_key);
$$;

-- What the triggers queued for club-trip-notify (pg_net sends it only after commit, so here it just waits), as
-- 'key:status' (the key in t_ids, or the id), in order.
create function pg_temp.notified(p_kind text)
returns text
language sql
security definer
as $$
  select string_agg(coalesce(k.key, q.body ->> 'id') || coalesce(':' || (q.body ->> 'status'), ''), ',' order by q.id)
  from (
    select r.id, convert_from(r.body, 'utf8')::jsonb as body
    from net.http_request_queue as r
    where r.url like '%/functions/v1/club-trip-notify'
  ) as q
  left join t_ids as k on k.id::text = q.body ->> 'id'
  where q.body ->> 'kind' = p_kind;
$$;

create function pg_temp.going(p_user text)
returns text
language sql
security definer
as $$
  select status from public.fixture_attendance
  where profile_id = p_user::uuid and fixture_id = current_setting('test.fixture');
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('ca600000-0000-4000-8000-0000000000a9', 'viagens-g@test.invalid', '{"display_name":"Gil"}', 'authenticated', 'authenticated'),
  ('ca600000-0000-4000-8000-0000000000ad', 'viagens-adm@test.invalid', '{"display_name":"Admin Viagens"}', 'authenticated', 'authenticated'),
  ('ca600000-0000-4000-8000-0000000000a1', 'viagens-a@test.invalid', '{"display_name":"Ana"}', 'authenticated', 'authenticated'),
  ('ca600000-0000-4000-8000-0000000000b1', 'viagens-b@test.invalid', '{"display_name":"Bruno"}', 'authenticated', 'authenticated'),
  ('ca600000-0000-4000-8000-0000000000c1', 'viagens-c@test.invalid', '{"display_name":"Carla"}', 'authenticated', 'authenticated'),
  ('ca600000-0000-4000-8000-0000000000d1', 'viagens-d@test.invalid', '{"display_name":"Duarte"}', 'authenticated', 'authenticated'),
  ('ca600000-0000-4000-8000-0000000000e1', 'viagens-e@test.invalid', '{"display_name":"Eva"}', 'authenticated', 'authenticated'),
  ('ca600000-0000-4000-8000-0000000000f1', 'viagens-f@test.invalid', '{"display_name":"Filipe"}', 'authenticated', 'authenticated'),
  ('ca600000-0000-4000-8000-0000000000e2', 'viagens-p@test.invalid', '{"display_name":"Paula"}', 'authenticated', 'authenticated'),
  ('ca600000-0000-4000-8000-0000000000e3', 'viagens-h@test.invalid', '{"display_name":"Hugo"}', 'authenticated', 'authenticated'),
  ('ca600000-0000-4000-8000-0000000000e4', 'viagens-r@test.invalid', '{"display_name":"Rui"}', 'authenticated', 'authenticated'),
  ('ca600000-0000-4000-8000-0000000000e5', 'viagens-w@test.invalid', '{"display_name":"Wilson"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'ca600000-0000-4000-8000-0000000000ad';

-- A game still days away; the Casa is of its home club.
select set_config('test.fixture',
  (select id from public.fixture where kickoff_at > now() + interval '3 days' order by kickoff_at, id limit 1), true);
select set_config('test.kickoff',
  (select kickoff_at::text from public.fixture where id = current_setting('test.fixture')), true);
select set_config('test.club',
  (select home_club_id from public.fixture where id = current_setting('test.fixture')), true);
select set_config('test.other_club',
  (select away_club_id from public.fixture where id = current_setting('test.fixture')), true);
select set_config('test.other_fixture',
  (select id from public.fixture
   where kickoff_at > now() + interval '1 day'
     and current_setting('test.club') not in (home_club_id, away_club_id)
   order by kickoff_at, id limit 1), true);
select set_config('test.municipality', (select id from public.municipality order by id limit 1), true);

insert into public.profile_club (profile_id, relation, club_id)
select u::uuid, 'supporter', current_setting('test.club')
from unnest(array[
  'ca600000-0000-4000-8000-0000000000a1', 'ca600000-0000-4000-8000-0000000000b1',
  'ca600000-0000-4000-8000-0000000000c1', 'ca600000-0000-4000-8000-0000000000d1',
  'ca600000-0000-4000-8000-0000000000e1', 'ca600000-0000-4000-8000-0000000000f1',
  'ca600000-0000-4000-8000-0000000000e2', 'ca600000-0000-4000-8000-0000000000e3',
  'ca600000-0000-4000-8000-0000000000e4'
]) as u
on conflict (profile_id, relation) do update set club_id = excluded.club_id;
insert into public.profile_club (profile_id, relation, club_id)
values ('ca600000-0000-4000-8000-0000000000e5', 'supporter', current_setting('test.other_club'))
on conflict (profile_id, relation) do update set club_id = excluded.club_id;

-- Rui offers a car to the same game.
insert into t_ids (key, id) values ('car', gen_random_uuid());
insert into public.ride (
  id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
  total_cents
)
select pg_temp.id('car'), f.id, 'ca600000-0000-4000-8000-0000000000e4', 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)',
  f.kickoff_at - interval '3 hours', 3, 'rapida', false, 100000, 3600, 0, 600, 1700, 1020, 0, 1020
from public.fixture as f where f.id = current_setting('test.fixture');

create function pg_temp.stops()
returns jsonb
language sql
as $$
  select jsonb_build_array(
    jsonb_build_object('name', 'Sede da Casa', 'lat', 40.2, 'lng', -8.42,
      'passes_at', current_setting('test.kickoff')::timestamptz - interval '5 hours'),
    jsonb_build_object('name', 'Rotunda do Estádio', 'lat', 40.25, 'lng', -8.45,
      'passes_at', current_setting('test.kickoff')::timestamptz - interval '270 minutes')
  );
$$;

set local role authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 0. A verified Casa publishes a trip with two vans: 2 and 3 seats, 12,50 € each person.

select pg_temp.as_user('ca600000-0000-4000-8000-0000000000a9');
insert into t_ids (key, id) values ('casa', public.request_supporters_club(
  current_setting('test.club'), 'Casa Teste Viagens', current_setting('test.municipality'), null));
select pg_temp.expect('a pending Casa cannot publish trips',
  pg_temp.refusal(format(
    'select public.create_club_trip(%L, %L, ''Viagem'', 0, false, %L, null, %L, ''[{"kind":"carrinha","label":"C","seats":2}]'')',
    pg_temp.id('casa'), current_setting('test.fixture'),
    current_setting('test.kickoff')::timestamptz - interval '1 day', pg_temp.stops())),
  'club_not_verified (22023)');

select pg_temp.as_user('ca600000-0000-4000-8000-0000000000ad');
select public.decide_supporters_club(pg_temp.id('casa'), 'verified');

select pg_temp.as_user('ca600000-0000-4000-8000-0000000000a9');
insert into t_ids (key, id) values ('trip', public.create_club_trip(
  pg_temp.id('casa'), current_setting('test.fixture'), '  Carrinhas de Teste  ', 1250, false,
  current_setting('test.kickoff')::timestamptz - interval '1 day', null, pg_temp.stops(),
  '[{"kind":"carrinha","label":"Carrinha 1","seats":2},{"kind":"carrinha","label":"Carrinha 2","seats":3}]'));
insert into t_ids (key, id)
select 'stop', id from public.club_trip_stop where trip_id = pg_temp.id('trip') and position = 1;
insert into t_ids (key, id)
select 'v' || right(label, 1), id from public.club_trip_vehicle where trip_id = pg_temp.id('trip');

select pg_temp.expect('the trip is open, its name trimmed',
  (select status || '|' || name from public.club_trip where id = pg_temp.id('trip')), 'open|Carrinhas de Teste');
select pg_temp.expect('the stops keep their order',
  (select string_agg(name, ' > ' order by position) from public.club_trip_stop where trip_id = pg_temp.id('trip')),
  'Sede da Casa > Rotunda do Estádio');
select pg_temp.expect('both vans are there', (pg_temp.id('v1') is not null and pg_temp.id('v2') is not null), true);
select pg_temp.expect('a game of other clubs is refused',
  pg_temp.refusal(format(
    'select public.create_club_trip(%L, %L, ''Viagem'', 0, false, now() + interval ''1 hour'', null, %L, ''[{"kind":"carrinha","label":"C","seats":2}]'')',
    pg_temp.id('casa'), current_setting('test.other_fixture'), pg_temp.stops())),
  'wrong_fixture (22023)');
select pg_temp.expect('a vehicle with more than 80 seats is refused',
  pg_temp.refusal(format(
    'select public.create_club_trip(%L, %L, ''Viagem'', 0, false, %L, null, %L, ''[{"kind":"autocarro","label":"A","seats":81}]'')',
    pg_temp.id('casa'), current_setting('test.fixture'),
    current_setting('test.kickoff')::timestamptz - interval '1 day', pg_temp.stops())),
  'bad_vehicle (22023)');
select pg_temp.expect('a deadline after the kickoff is refused',
  pg_temp.refusal(format(
    'select public.create_club_trip(%L, %L, ''Viagem'', 0, false, %L, null, %L, ''[{"kind":"carrinha","label":"C","seats":2}]'')',
    pg_temp.id('casa'), current_setting('test.fixture'),
    current_setting('test.kickoff')::timestamptz + interval '1 minute', pg_temp.stops())),
  'bad_bookings_close_at (22023)');
select pg_temp.expect('a negative price is refused',
  pg_temp.refusal(format(
    'select public.create_club_trip(%L, %L, ''Viagem'', -1, false, %L, null, %L, ''[{"kind":"carrinha","label":"C","seats":2}]'')',
    pg_temp.id('casa'), current_setting('test.fixture'),
    current_setting('test.kickoff')::timestamptz - interval '1 day', pg_temp.stops())),
  'bad_price (22023)');

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Assignment: the whole booking goes to the first van with room for all its people.

select pg_temp.as_user('ca600000-0000-4000-8000-0000000000a1');
insert into t_ids (key, id)
select 'bk_a', b.id from public.book_club_trip(pg_temp.id('trip'), pg_temp.id('stop'), array[' Filho da Ana '], null) as b;
select pg_temp.expect('Ana with one companion is booked in van 1', pg_temp.booking('bk_a'), 'booked|Carrinha 1');
select pg_temp.expect('her booking counts 2 people, the companion trimmed',
  (select people || '|' || companions[1] from public.club_trip_booking where id = pg_temp.id('bk_a')), '2|Filho da Ana');
select pg_temp.expect('a booked seat marks Ana as going to the game',
  pg_temp.going('ca600000-0000-4000-8000-0000000000a1'), 'going');
select pg_temp.expect('booking twice in the same trip is refused',
  pg_temp.refusal(format('select public.book_club_trip(%L, %L, null, null)', pg_temp.id('trip'), pg_temp.id('stop'))),
  'already_booked (22023)');
select pg_temp.expect('a companion name too short is refused',
  pg_temp.refusal(format('select public.book_club_trip(%L, %L, array[''x''], null)', pg_temp.id('trip'), pg_temp.id('stop'))),
  'bad_companions (22023)');

select pg_temp.as_user('ca600000-0000-4000-8000-0000000000b1');
select pg_temp.expect('more than 10 companions is refused',
  pg_temp.refusal(format(
    'select public.book_club_trip(%L, %L, array[''P1'',''P2'',''P3'',''P4'',''P5'',''P6'',''P7'',''P8'',''P9'',''P10'',''P11''], null)',
    pg_temp.id('trip'), pg_temp.id('stop'))),
  'bad_companions (22023)');
insert into t_ids (key, id)
select 'bk_b', b.id from public.book_club_trip(pg_temp.id('trip'), pg_temp.id('stop'), array['Irmão do Bruno'], null) as b;
select pg_temp.expect('Bruno with one companion skips the full van 1 and goes to van 2',
  pg_temp.booking('bk_b'), 'booked|Carrinha 2');
select pg_temp.expect('Bruno sees his van, and 25 € to pay',
  (select vehicle_label || '|' || due_cents || '|' || paid from public.my_club_booking(pg_temp.id('trip'))),
  'Carrinha 2|2500|false');

select pg_temp.as_user('ca600000-0000-4000-8000-0000000000c1');
insert into t_ids (key, id)
select 'bk_c', b.id from public.book_club_trip(pg_temp.id('trip'), pg_temp.id('stop'), '{}', null) as b;
select pg_temp.expect('Carla alone takes the last seat of van 2', pg_temp.booking('bk_c'), 'booked|Carrinha 2');

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Waiting list: never split across vans.

select pg_temp.as_user('ca600000-0000-4000-8000-0000000000d1');
insert into t_ids (key, id)
select 'bk_d', b.id from public.book_club_trip(
  pg_temp.id('trip'), pg_temp.id('stop'), array['Mãe do Duarte', 'Pai do Duarte', 'Tio do Duarte'], null) as b;
select pg_temp.expect('Duarte with 3 companions, and no seat free, waits whole', pg_temp.booking('bk_d'), 'waiting|-');
select pg_temp.expect('first in the waiting list: 4 people, no van',
  (select position_in_waiting || '|' || people || '|' || coalesce(vehicle_label, '-')
   from public.my_club_booking(pg_temp.id('trip'))),
  '1|4|-');
select pg_temp.expect('nothing is due while waiting (no seat yet)',
  (select due_cents from public.my_club_booking(pg_temp.id('trip'))), 0);
select pg_temp.expect('waiting does not mark Duarte as going', pg_temp.going('ca600000-0000-4000-8000-0000000000d1'), null::text);

select pg_temp.as_user('ca600000-0000-4000-8000-0000000000e1');
insert into t_ids (key, id)
select 'bk_e', b.id from public.book_club_trip(pg_temp.id('trip'), pg_temp.id('stop'), null, null) as b;
select pg_temp.expect('Eva alone waits too, second',
  (select status || '|' || position_in_waiting from public.my_club_booking(pg_temp.id('trip'))), 'waiting|2');

-- Ana cancels: 2 seats free in van 1. Duarte (4) still does not fit; Eva (1), behind him, goes.
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000a1');
select public.cancel_my_club_booking(pg_temp.id('bk_a'));
select pg_temp.expect('Ana is cancelled by herself', pg_temp.booking('bk_a'), 'cancelled|self');
select pg_temp.expect('Duarte still does not fit and keeps waiting', pg_temp.booking('bk_d'), 'waiting|-');
select pg_temp.expect('Eva, smaller, is promoted to van 1', pg_temp.booking('bk_e'), 'booked|Carrinha 1');
select pg_temp.expect('the promotion marks Eva as going', pg_temp.going('ca600000-0000-4000-8000-0000000000e1'), 'going');
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000d1');
select pg_temp.expect('Duarte is now first in the waiting list',
  (select position_in_waiting from public.my_club_booking(pg_temp.id('trip'))), 1);

-- The Casa adds a 4-seat van: Duarte's whole booking goes there.
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000a9');
insert into t_ids (key, id) values ('v3', public.add_club_trip_vehicle(pg_temp.id('trip'), 'carrinha', 'Carrinha 3', 4));
select pg_temp.expect('Duarte is promoted to the new van', pg_temp.booking('bk_d'), 'booked|Carrinha 3');
select pg_temp.expect('and marked as going', pg_temp.going('ca600000-0000-4000-8000-0000000000d1'), 'going');

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. One transport per game.

-- Filipe (2 people) waits; meanwhile he gets a seat in Rui's car (waiting does not block cars).
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000f1');
insert into t_ids (key, id)
select 'bk_f', b.id from public.book_club_trip(pg_temp.id('trip'), pg_temp.id('stop'), array['Amigo do Filipe'], null) as b;
select pg_temp.expect('Filipe and a friend wait (1 seat free)', pg_temp.booking('bk_f'), 'waiting|-');
select pg_temp.expect('someone waiting can still ask for a car seat',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', pg_temp.id('car'))), 'accepted');
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000e4');
select public.answer_ride_request(pg_temp.id('car'), 'ca600000-0000-4000-8000-0000000000f1', true);

-- Carla cancels: the waiting list moves, and Filipe, already in a car, leaves it.
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000c1');
select public.cancel_my_club_booking(pg_temp.id('bk_c'));
select pg_temp.expect('Filipe, in a car, leaves the waiting list', pg_temp.booking('bk_f'), 'cancelled|other_transport');
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000f1');
select pg_temp.expect('Filipe sees his booking cancelled, nothing to pay',
  (select status || '|' || due_cents from public.my_club_booking(pg_temp.id('trip'))), 'cancelled|0');
select pg_temp.expect('a car passenger cannot book a seat with room in the trip',
  pg_temp.refusal(format('select public.book_club_trip(%L, %L, null, null)', pg_temp.id('trip'), pg_temp.id('stop'))),
  'already_in_car (22023)');
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000e4');
select pg_temp.expect('nor can the driver',
  pg_temp.refusal(format('select public.book_club_trip(%L, %L, null, null)', pg_temp.id('trip'), pg_temp.id('stop'))),
  'already_in_car (22023)');

select pg_temp.as_user('ca600000-0000-4000-8000-0000000000b1');
select pg_temp.expect('someone booked cannot ask for a car seat in that game',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', pg_temp.id('car'))),
  'already_on_club_trip (22023)');
reset role;
select pg_temp.expect('nor offer a car to that game',
  pg_temp.refusal($$insert into public.ride (
  fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
  total_cents
) select f.id, 'ca600000-0000-4000-8000-0000000000b1', 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)',
  f.kickoff_at - interval '3 hours', 3, 'rapida', false, 100000, 3600, 0, 600, 1700, 1020, 0, 1020
  from public.fixture as f where f.id = current_setting('test.fixture')$$),
  'already_on_club_trip (22023)');
set local role authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Payments and boarding: the totals are computed here (price × unpaid people).

select pg_temp.as_user('ca600000-0000-4000-8000-0000000000a9');
select public.manage_club_booking(pg_temp.id('bk_b'), 'paid');
select pg_temp.expect('van 2: Bruno and his brother paid, nothing due',
  (select occupied || '|' || paid_people || '|' || due_cents from public.club_trip_summary(pg_temp.id('trip'))
   where vehicle_id = pg_temp.id('v2')),
  '2|2|0');
select pg_temp.expect('the whole trip: 2 paid, 5 unpaid people × 12,50 € due, nobody waiting',
  (select sum(paid_people) || '|' || sum(due_cents) || '|' || max(waiting_people)
   from public.club_trip_summary(pg_temp.id('trip'))),
  '2|6250|0');
select public.manage_club_booking(pg_temp.id('bk_b'), 'unpaid');
select pg_temp.expect('marking unpaid puts 25 € back as due',
  (select due_cents from public.club_trip_summary(pg_temp.id('trip')) where vehicle_id = pg_temp.id('v2')), 2500);
select public.manage_club_booking(pg_temp.id('bk_b'), 'paid');
select public.manage_club_booking(pg_temp.id('bk_b'), 'boarded');
select pg_temp.expect('Bruno is marked paid and boarded',
  (select paid_at is not null and boarded_at is not null from public.club_trip_booking where id = pg_temp.id('bk_b')),
  true);
select pg_temp.expect('a cancelled booking cannot be managed',
  pg_temp.refusal(format('select public.manage_club_booking(%L, ''boarded'')', pg_temp.id('bk_f'))),
  'booking_cancelled (22023)');
select pg_temp.expect('an unknown action is refused',
  pg_temp.refusal(format('select public.manage_club_booking(%L, ''fly'')', pg_temp.id('bk_b'))),
  'bad_action (22023)');

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Vehicles with people in them.

select pg_temp.expect('a van cannot get fewer seats than the people in it',
  pg_temp.refusal(format('select public.update_club_trip_vehicle(%L, ''Carrinha 3'', 3)', pg_temp.id('v3'))),
  'vehicle_not_empty (22023)');
select pg_temp.expect('nor be removed while someone is booked in it',
  pg_temp.refusal(format('select public.remove_club_trip_vehicle(%L)', pg_temp.id('v1'))),
  'vehicle_not_empty (22023)');
select pg_temp.expect('moving 4 people to a van with 1 free seat is refused',
  pg_temp.refusal(format('select public.manage_club_booking(%L, ''move'', %L)', pg_temp.id('bk_d'), pg_temp.id('v1'))),
  'vehicle_full (22023)');
select public.manage_club_booking(pg_temp.id('bk_e'), 'move', pg_temp.id('v2'));
select pg_temp.expect('Eva is moved to van 2', pg_temp.booking('bk_e'), 'booked|Carrinha 2');
select public.remove_club_trip_vehicle(pg_temp.id('v1'));
select pg_temp.expect('the empty van 1 is removed',
  (select count(*)::integer from public.club_trip_vehicle where trip_id = pg_temp.id('trip')), 2);
select public.update_club_trip_vehicle(pg_temp.id('v3'), ' Carrinha Grande ', 5);
select pg_temp.expect('a van can be renamed and get more seats',
  (select label || '|' || seats from public.club_trip_vehicle where id = pg_temp.id('v3')), 'Carrinha Grande|5');

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. «Só sócios»: the Casa's member code; one Casa trip per game.

insert into t_ids (key, id) values ('socios', public.create_club_trip(
  pg_temp.id('casa'), current_setting('test.fixture'), 'Minibus dos Sócios', 0, true,
  current_setting('test.kickoff')::timestamptz - interval '1 day', 'Só para sócios com as quotas em dia.',
  pg_temp.stops(), '[{"kind":"minibus","label":"Minibus","seats":10}]'));
insert into t_ids (key, id)
select 'stop_s', id from public.club_trip_stop where trip_id = pg_temp.id('socios') and position = 2;
select set_config('test.code', public.supporters_club_member_code(pg_temp.id('casa')), true);
select pg_temp.expect('a «só sócios» trip creates the member code',
  current_setting('test.code') ~ '^[a-z0-9]{10}$', true);

select pg_temp.as_user('ca600000-0000-4000-8000-0000000000e2');
select pg_temp.expect('without the code the booking is refused',
  pg_temp.refusal(format('select public.book_club_trip(%L, %L, null, null)', pg_temp.id('socios'), pg_temp.id('stop_s'))),
  'member_code_required (22023)');
select pg_temp.expect('a wrong code is refused',
  pg_temp.refusal(format('select public.book_club_trip(%L, %L, null, ''zzzzzzzzzz'')', pg_temp.id('socios'), pg_temp.id('stop_s'))),
  'bad_member_code (22023)');
select pg_temp.expect('a stop of another trip is refused',
  pg_temp.refusal(format('select public.book_club_trip(%L, %L, null, %L)',
    pg_temp.id('socios'), pg_temp.id('stop'), current_setting('test.code'))),
  'bad_stop (22023)');
insert into t_ids (key, id)
select 'bk_p', b.id
from public.book_club_trip(pg_temp.id('socios'), pg_temp.id('stop_s'), null, upper(' ' || current_setting('test.code') || ' ')) as b;
select pg_temp.expect('with the code (any case) Paula is booked', pg_temp.booking('bk_p'), 'booked|Minibus');

select pg_temp.as_user('ca600000-0000-4000-8000-0000000000b1');
select pg_temp.expect('someone booked in one Casa trip cannot be booked in another of the same game',
  pg_temp.refusal(format('select public.book_club_trip(%L, %L, null, %L)',
    pg_temp.id('socios'), pg_temp.id('stop_s'), current_setting('test.code'))),
  'already_on_club_trip (22023)');

select pg_temp.as_user('ca600000-0000-4000-8000-0000000000a9');
select set_config('test.new_code', public.rotate_supporters_club_member_code(pg_temp.id('casa')), true);
select pg_temp.expect('rotating gives a new code', current_setting('test.new_code') <> current_setting('test.code'), true);
select public.set_club_trip_status(pg_temp.id('socios'), 'closed');
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000e3');
select pg_temp.expect('a closed trip takes no bookings',
  pg_temp.refusal(format('select public.book_club_trip(%L, %L, null, %L)',
    pg_temp.id('socios'), pg_temp.id('stop_s'), current_setting('test.new_code'))),
  'bookings_closed (22023)');
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000a9');
select public.set_club_trip_status(pg_temp.id('socios'), 'open');
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000e3');
select pg_temp.expect('the old code no longer works',
  pg_temp.refusal(format('select public.book_club_trip(%L, %L, null, %L)',
    pg_temp.id('socios'), pg_temp.id('stop_s'), current_setting('test.code'))),
  'bad_member_code (22023)');

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Who can book, and until when.

select pg_temp.as_user('ca600000-0000-4000-8000-0000000000e5');
select pg_temp.expect('a fan of another club is refused',
  pg_temp.refusal(format('select public.book_club_trip(%L, %L, null, null)', pg_temp.id('trip'), pg_temp.id('stop'))),
  'wrong_club (22023)');

reset role;
update public.club_trip set bookings_close_at = now() - interval '1 minute' where id = pg_temp.id('trip');
set local role authenticated;
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000e3');
select pg_temp.expect('after the deadline nobody books',
  pg_temp.refusal(format('select public.book_club_trip(%L, %L, null, null)', pg_temp.id('trip'), pg_temp.id('stop'))),
  'bookings_closed (22023)');
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000e1');
select pg_temp.expect('nor cancels their own booking',
  pg_temp.refusal(format('select public.cancel_my_club_booking(%L)', pg_temp.id('bk_e'))),
  'bookings_closed (22023)');

-- The Casa still adds people signed up at the seat; with no room they wait, and move up when someone is removed.
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000a9');
insert into t_ids (key, id)
select 'bk_m', b.id from public.add_manual_club_booking(pg_temp.id('trip'), ' Senhor Joaquim ', pg_temp.id('stop'), array['Neto']) as b;
select pg_temp.expect('a manual booking with no room waits', pg_temp.booking('bk_m'), 'waiting|-');
select pg_temp.expect('it has the name and no account',
  (select manual_name || '|' || (profile_id is null) || '|' || people from public.club_trip_booking where id = pg_temp.id('bk_m')),
  'Senhor Joaquim|true|2');
select pg_temp.expect('a waiting booking cannot be marked paid',
  pg_temp.refusal(format('select public.manage_club_booking(%L, ''paid'')', pg_temp.id('bk_m'))),
  'not_booked (22023)');
select pg_temp.expect('nor unpaid',
  pg_temp.refusal(format('select public.manage_club_booking(%L, ''unpaid'')', pg_temp.id('bk_m'))),
  'not_booked (22023)');
select public.manage_club_booking(pg_temp.id('bk_d'), 'remove');
select pg_temp.expect('Duarte is removed by the Casa', pg_temp.booking('bk_d'), 'cancelled|manager');
select pg_temp.expect('the manual booking moves up into the freed van', pg_temp.booking('bk_m'), 'booked|Carrinha Grande');

-- ---------------------------------------------------------------------------------------------------------------------
-- 7b. Notifications: what the triggers send, and who hears about a new trip.

reset role;
select pg_temp.expect('each published trip is sent to club-trip-notify', pg_temp.notified('trip'), 'trip:open,socios:open');
select pg_temp.expect('the waiting list changes people are told about: Eva and Duarte got a seat, Filipe left it',
  pg_temp.notified('booking'), 'bk_e:booked,bk_d:booked,bk_f:cancelled');
set local role authenticated;
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000a9');
insert into t_ids (key, id) values ('notice', public.post_club_trip_notice(pg_temp.id('socios'), 'Saída às 14h em ponto.'));
reset role;
select pg_temp.expect('a notice is sent too', pg_temp.notified('notice'), 'notice');

-- Where the fans live, measured from the first stop of the «só sócios» trip.
select set_config('test.first_stop',
  (select location::text from public.club_trip_stop where trip_id = pg_temp.id('socios') and position = 1), true);
select set_config('test.near',
  (select id from public.municipality
   order by extensions.st_distance(location, current_setting('test.first_stop')::extensions.geography), id limit 1), true);
select set_config('test.district', (select district from public.municipality where id = current_setting('test.near')), true);
select set_config('test.close_other',
  (select id from public.municipality
   where district <> current_setting('test.district')
     and extensions.st_dwithin(location, current_setting('test.first_stop')::extensions.geography, 50000)
   order by id limit 1), true);
select set_config('test.far',
  (select id from public.municipality
   where district <> current_setting('test.district')
     and not extensions.st_dwithin(location, current_setting('test.first_stop')::extensions.geography, 50000)
   order by id limit 1), true);

insert into public.profile_club (profile_id, relation, club_id)
values ('ca600000-0000-4000-8000-0000000000a9', 'supporter', current_setting('test.club'))
on conflict (profile_id, relation) do update set club_id = excluded.club_id;
insert into public.profile_home (profile_id, municipality_id)
values
  ('ca600000-0000-4000-8000-0000000000e3', current_setting('test.near')),        -- Hugo: same district
  ('ca600000-0000-4000-8000-0000000000a1', current_setting('test.close_other')), -- Ana: other district, < 50 km
  ('ca600000-0000-4000-8000-0000000000c1', current_setting('test.far')),         -- Carla: far away
  ('ca600000-0000-4000-8000-0000000000e1', current_setting('test.near')),        -- Eva: turned the switch off
  ('ca600000-0000-4000-8000-0000000000b1', current_setting('test.near')),        -- Bruno: blocked Gil
  ('ca600000-0000-4000-8000-0000000000d1', current_setting('test.near')),        -- Duarte: already alerted
  ('ca600000-0000-4000-8000-0000000000a9', current_setting('test.near'))         -- Gil: manages the Casa
on conflict (profile_id) do update set municipality_id = excluded.municipality_id;
insert into public.notification_preference (profile_id, kind, enabled)
values ('ca600000-0000-4000-8000-0000000000e1', 'club_trips', false)
on conflict (profile_id, kind) do update set enabled = false;
insert into public.user_block (blocker_id, blocked_id)
values ('ca600000-0000-4000-8000-0000000000b1', 'ca600000-0000-4000-8000-0000000000a9');
insert into public.club_trip_alert (profile_id, fixture_id)
values ('ca600000-0000-4000-8000-0000000000d1', current_setting('test.fixture'));
select pg_temp.expect('one alert per person per game: a second one for Duarte conflicts',
  pg_temp.refusal(format('insert into public.club_trip_alert (profile_id, fixture_id) values (%L, %L)',
    'ca600000-0000-4000-8000-0000000000d1', current_setting('test.fixture'))),
  'duplicate key value violates unique constraint "club_trip_alert_pkey" (23505)');

-- Wilson supports the other club but follows the Casa.
set local role authenticated;
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000e5');
select public.set_supporters_club_follow(pg_temp.id('casa'), true);
reset role;

select pg_temp.expect('alerted: Ana (< 50 km), Hugo (same district) and Wilson (follower); not Carla, Eva, Bruno, Duarte, Gil',
  (select string_agg(a::text, ',' order by a) from public.claim_club_trip_alerts(pg_temp.id('socios')) as a),
  'ca600000-0000-4000-8000-0000000000a1,ca600000-0000-4000-8000-0000000000e3,ca600000-0000-4000-8000-0000000000e5');
select pg_temp.expect('their alerts are recorded for the game',
  (select count(*)::integer from public.club_trip_alert
   where fixture_id = current_setting('test.fixture') and profile_id::text like 'ca600000-%'), 4);
select pg_temp.expect('a second trip to the same game alerts nobody again',
  (select count(*)::integer from public.claim_club_trip_alerts(pg_temp.id('socios'))), 0);
select pg_temp.expect('a report of a trip is accepted',
  pg_temp.refusal(format(
    'insert into public.content_report (reporter_id, kind, target_id, reason) values (%L, ''club_trip'', %L, ''spam'')',
    'ca600000-0000-4000-8000-0000000000a1', pg_temp.id('socios'))),
  'accepted');
select pg_temp.expect('and of a Casa',
  pg_temp.refusal(format(
    'insert into public.content_report (reporter_id, kind, target_id, reason) values (%L, ''supporters_club'', %L, ''spam'')',
    'ca600000-0000-4000-8000-0000000000a1', pg_temp.id('casa'))),
  'accepted');
set local role authenticated;
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000a9');

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. Cancelling the trip cancels every live booking.

select public.set_club_trip_status(pg_temp.id('trip'), 'cancelled');
select pg_temp.expect('the trip is cancelled',
  (select status from public.club_trip where id = pg_temp.id('trip')), 'cancelled');
select pg_temp.expect('no live booking is left in it',
  (select count(*)::integer from public.club_trip_booking
   where trip_id = pg_temp.id('trip') and status <> 'cancelled'), 0);
select pg_temp.expect('Bruno, Eva and the manual booking were cancelled with the trip',
  (select count(*)::integer from public.club_trip_booking
   where trip_id = pg_temp.id('trip') and cancel_reason = 'trip_cancelled'), 3);
select pg_temp.expect('a cancelled trip cannot be reopened',
  pg_temp.refusal(format('select public.set_club_trip_status(%L, ''open'')', pg_temp.id('trip'))),
  'trip_cancelled (22023)');
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000b1');
select pg_temp.expect('once cancelled, Bruno can ask for a car seat again',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', pg_temp.id('car'))), 'accepted');

reset role;
select pg_temp.expect('a cancelled trip is sent once, for all its bookings',
  pg_temp.notified('trip'), 'trip:open,socios:open,trip:cancelled');
select pg_temp.expect('the bookings cancelled with it send nothing of their own',
  pg_temp.notified('booking'), 'bk_e:booked,bk_d:booked,bk_f:cancelled');
set local role authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. Suspending the Casa cancels its open trips and freezes it.

select pg_temp.as_user('ca600000-0000-4000-8000-0000000000ad');
select public.decide_supporters_club(pg_temp.id('casa'), 'suspended');
select pg_temp.as_user('ca600000-0000-4000-8000-0000000000a9');
select pg_temp.expect('the «só sócios» trip is cancelled (its managers still see it)',
  (select status from public.club_trip where id = pg_temp.id('socios')), 'cancelled');
select pg_temp.expect('and Paula''s booking with it', pg_temp.booking('bk_p'), 'cancelled|trip_cancelled');
select pg_temp.expect('a suspended Casa cannot add vehicles',
  pg_temp.refusal(format('select public.add_club_trip_vehicle(%L, ''autocarro'', ''Autocarro'', 50)', pg_temp.id('socios'))),
  'club_suspended (22023)');
select pg_temp.expect('nor publish trips',
  pg_temp.refusal(format(
    'select public.create_club_trip(%L, %L, ''Viagem'', 0, false, %L, null, %L, ''[{"kind":"carrinha","label":"C","seats":2}]'')',
    pg_temp.id('casa'), current_setting('test.fixture'),
    current_setting('test.kickoff')::timestamptz - interval '1 day', pg_temp.stops())),
  'club_suspended (22023)');
select pg_temp.expect('nor post notices',
  pg_temp.refusal(format('select public.post_club_trip_notice(%L, ''Olá'')', pg_temp.id('socios'))),
  'club_suspended (22023)');
select pg_temp.expect('nor be renamed',
  pg_temp.refusal(format('select public.update_supporters_club(%L, ''Outro Nome'', null)', pg_temp.id('casa'))),
  'club_suspended (22023)');
select pg_temp.expect('nor invite managers',
  pg_temp.refusal(format('select public.create_supporters_club_invite(%L)', pg_temp.id('casa'))),
  'club_suspended (22023)');
select pg_temp.expect('nor change its member code',
  pg_temp.refusal(format('select public.rotate_supporters_club_member_code(%L)', pg_temp.id('casa'))),
  'club_suspended (22023)');

reset role;
select pg_temp.expect('suspending the Casa sends its cancelled trip',
  pg_temp.notified('trip'), 'trip:open,socios:open,trip:cancelled,socios:cancelled');
select count(*) as checks_passed from expect_log;

rollback;
