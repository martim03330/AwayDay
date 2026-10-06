-- Access tests for matchday on a ride: seats home (ride_return_request), who turned up (ride_attendance),
-- incidents and their votes (ride_incident, ride_incident_vote).
--
-- People: D drives a public round trip with P in it; D2 drives a round trip only for their group (with G); W drives
-- one way; F and Q ask for seats home; R comes too late; O is an outsider; ADM is an admin; BAN is suspended.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_boleia_volta.test.sql

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

-- Runs a call that must be refused, and returns its message (or 'accepted').
create function pg_temp.refusal(p_sql text)
returns text
language plpgsql
as $$
declare
  mensagem text;
begin
  execute p_sql;
  return 'accepted';
exception when others then
  get stacked diagnostics mensagem = message_text;
  return mensagem;
end;
$$;

-- Tries select, insert, update and delete on a table with the current role, and says what got through.
-- 'denied' = no privilege on the table; 'rls' = blocked by row level security; 'allowed' = it ran.
create function pg_temp.direct_access(p_table text)
returns text
language plpgsql
as $$
declare
  coluna text;
  resultado text := '';
  operacao text;
  comando text;
  estado text;
begin
  select a.attname into coluna
  from pg_catalog.pg_attribute as a
  where a.attrelid = ('public.' || p_table)::regclass and a.attnum = 1;
  foreach operacao in array array['select', 'insert', 'update', 'delete'] loop
    comando := case operacao
      when 'select' then format('select count(*) from public.%I', p_table)
      when 'insert' then format('insert into public.%I default values', p_table)
      when 'update' then format('update public.%I set %I = %I', p_table, coluna, coluna)
      else format('delete from public.%I', p_table)
    end;
    begin
      execute comando;
      estado := 'allowed';
    exception when others then
      estado := case
        when sqlerrm like 'permission denied%' then 'denied'
        when sqlerrm like '%row-level security%' then 'rls'
        else 'allowed'
      end;
    end;
    resultado := resultado || operacao || ':' || estado || ' ';
  end loop;
  return btrim(resultado);
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
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.as_anon()
returns void
language sql
as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;

-- A game of our own, so the board only has the rides made here.
create function pg_temp.make_fixture(p_id text, p_kickoff timestamptz)
returns void
language sql
as $$
  insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at)
  select p_id, f.competition_id, f.stage, f.home_club_id, f.away_club_id, v.id, p_kickoff
  from public.fixture as f
  cross join lateral (
    select v.id from public.venue as v
    where v.location is not null and v.country = 'Portugal'
    order by v.id limit 1
  ) as v
  order by f.id
  limit 1;
$$;

-- A ride as the rides edge function writes it: total = fuel + tolls, worked out on the server.
create function pg_temp.make_ride(
  p_id uuid, p_fixture text, p_driver uuid, p_seats integer, p_fuel integer, p_tolls integer,
  p_round boolean default false, p_group uuid default null, p_visibility text default 'publica'
)
returns void
language sql
as $$
  insert into public.ride (
    id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
    distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
    total_cents, group_id, visibility
  )
  select p_id, f.id, p_driver, 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)', f.kickoff_at - interval '3 hours',
    p_seats, 'rapida', p_round, 100000, 3600, 20000, 600, 1700, p_fuel, p_tolls, p_fuel + p_tolls, p_group,
    p_visibility
  from public.fixture as f
  where f.id = p_fixture;
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('e3000000-0000-4000-8000-000000000001', 'volta-d@test.invalid', '{"display_name":"Volta D"}', 'authenticated', 'authenticated'),
  ('e3000000-0000-4000-8000-000000000002', 'volta-p@test.invalid', '{"display_name":"Volta P"}', 'authenticated', 'authenticated'),
  ('e3000000-0000-4000-8000-000000000003', 'volta-f@test.invalid', '{"display_name":"Volta F"}', 'authenticated', 'authenticated'),
  ('e3000000-0000-4000-8000-000000000004', 'volta-q@test.invalid', '{"display_name":"Volta Q"}', 'authenticated', 'authenticated'),
  ('e3000000-0000-4000-8000-000000000005', 'volta-o@test.invalid', '{"display_name":"Volta O"}', 'authenticated', 'authenticated'),
  ('e3000000-0000-4000-8000-000000000006', 'volta-adm@test.invalid', '{"display_name":"Volta Adm"}', 'authenticated', 'authenticated'),
  ('e3000000-0000-4000-8000-000000000007', 'volta-d2@test.invalid', '{"display_name":"Volta D2"}', 'authenticated', 'authenticated'),
  ('e3000000-0000-4000-8000-000000000008', 'volta-g@test.invalid', '{"display_name":"Volta G"}', 'authenticated', 'authenticated'),
  ('e3000000-0000-4000-8000-000000000009', 'volta-w@test.invalid', '{"display_name":"Volta W"}', 'authenticated', 'authenticated'),
  ('e3000000-0000-4000-8000-000000000010', 'volta-ban@test.invalid', '{"display_name":"Volta Ban"}', 'authenticated', 'authenticated'),
  ('e3000000-0000-4000-8000-000000000011', 'volta-r@test.invalid', '{"display_name":"Volta R"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'e3000000-0000-4000-8000-000000000006';

insert into public.fan_group (id, name, created_by, invite_code)
values ('e3000000-0000-4000-8000-0000000000a1', 'Grupo Volta', 'e3000000-0000-4000-8000-000000000007', 'tvolta0001');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('e3000000-0000-4000-8000-0000000000a1', 'e3000000-0000-4000-8000-000000000007', 'owner'),
  ('e3000000-0000-4000-8000-0000000000a1', 'e3000000-0000-4000-8000-000000000008', 'member');

-- The game started an hour ago: the cars left four hours ago, and the window to ask for a seat home is open.
select pg_temp.make_fixture('teste-acesso-volta', now() - interval '1 hour');
create temporary table t_loc (near_lat double precision, near_lon double precision, far_lat double precision) on commit drop;
grant select on t_loc to authenticated, anon;
insert into t_loc
select v.latitude + 0.01, v.longitude, v.latitude + 0.5
from public.fixture as f join public.venue as v on v.id = f.venue_id
where f.id = 'teste-acesso-volta';
select pg_temp.expect('the stadium has a location', (select count(*)::integer from t_loc where near_lat is not null), 1);

insert into t_ids (key, id) values
  ('rv', gen_random_uuid()), ('rp', gen_random_uuid()), ('rw', gen_random_uuid());
-- RV: public round trip with seats home, 3 seats, 30 € fuel + 10 € tolls. P went with D.
select pg_temp.make_ride(pg_temp.id('rv'), 'teste-acesso-volta', 'e3000000-0000-4000-8000-000000000001', 3, 3000, 1000, true);
-- RP: the same, but only for D2's group.
select pg_temp.make_ride(pg_temp.id('rp'), 'teste-acesso-volta', 'e3000000-0000-4000-8000-000000000007', 3, 3000, 1000, true,
  'e3000000-0000-4000-8000-0000000000a1', 'grupo');
-- RW: one way only.
select pg_temp.make_ride(pg_temp.id('rw'), 'teste-acesso-volta', 'e3000000-0000-4000-8000-000000000009', 3, 3000, 1000, false);
update public.ride set accepts_return_requests = true where id in (pg_temp.id('rv'), pg_temp.id('rp'));
insert into public.ride_passenger (ride_id, profile_id, status)
values (pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000002', 'accepted');
-- BAN has two no-shows.
insert into public.ride_outcome (ride_id, profile_id, role, outcome)
values
  (pg_temp.id('rp'), 'e3000000-0000-4000-8000-000000000010', 'passenger', 'no_show'),
  (pg_temp.id('rw'), 'e3000000-0000-4000-8000-000000000010', 'passenger', 'no_show');

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. No direct access to the matchday tables.

set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon: no direct access to ride_return_request', pg_temp.direct_access('ride_return_request'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon: no direct access to ride_attendance', pg_temp.direct_access('ride_attendance'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon: no direct access to ride_incident', pg_temp.direct_access('ride_incident'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon: no direct access to ride_incident_vote', pg_temp.direct_access('ride_incident_vote'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon cannot see the seats home',
  pg_temp.refusal('select * from public.ride_return_board(''teste-acesso-volta'')'),
  'permission denied for function ride_return_board');
select pg_temp.expect('anon cannot ask for a seat home',
  pg_temp.refusal(format('select public.request_return_seat(%L, 38.7, -9.1, true)', pg_temp.id('rv'))),
  'permission denied for function request_return_seat');
select pg_temp.expect('anon cannot report an incident',
  pg_temp.refusal(format('select public.report_ride_incident(%L, %L, null)', pg_temp.id('rv'), 'doenca')),
  'permission denied for function report_ride_incident');
select pg_temp.expect('anon cannot report attendance',
  pg_temp.refusal(format('select public.report_ride_attendance(%L, %L, false)', pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000002')),
  'permission denied for function report_ride_attendance');

set local role authenticated;
select pg_temp.as_user('e3000000-0000-4000-8000-000000000001');
select pg_temp.expect('driver: no direct access to ride_return_request', pg_temp.direct_access('ride_return_request'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('driver: no direct access to ride_attendance', pg_temp.direct_access('ride_attendance'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('driver: no direct access to ride_incident', pg_temp.direct_access('ride_incident'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('driver: no direct access to ride_incident_vote', pg_temp.direct_access('ride_incident_vote'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000006');
select pg_temp.expect('admin: no direct access to ride_return_request', pg_temp.direct_access('ride_return_request'),
  'select:denied insert:denied update:denied delete:denied');

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. The board of seats home.

select pg_temp.as_user('e3000000-0000-4000-8000-000000000003');
select pg_temp.expect('a fresh account sees only the public round trip, at half the trip split by four',
  (select string_agg(driver_name || ':' || seats_left || ':' || price_cents, ',') from public.ride_return_board('teste-acesso-volta')),
  'Volta D:2:667');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000008');
select pg_temp.expect('a group member also sees the group''s car',
  (select string_agg(driver_name, ',' order by driver_name) from public.ride_return_board('teste-acesso-volta')),
  'Volta D,Volta D2');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000001');
select pg_temp.expect('a driver does not see their own car',
  (select count(*)::integer from public.ride_return_board('teste-acesso-volta') where ride_id = pg_temp.id('rv')), 0);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Asking for a seat home: the location is used for the distance and thrown away.

select pg_temp.as_user('e3000000-0000-4000-8000-000000000003');
select pg_temp.expect('rules must be accepted',
  pg_temp.refusal(format('select public.request_return_seat(%L, %s, %s, false)', pg_temp.id('rv'),
    (select near_lat from t_loc), (select near_lon from t_loc))), 'rules_not_accepted');
select pg_temp.expect('a location off the globe is refused',
  pg_temp.refusal(format('select public.request_return_seat(%L, 91, 0, true)', pg_temp.id('rv'))), 'bad_location');
select pg_temp.expect('a missing location is refused',
  pg_temp.refusal(format('select public.request_return_seat(%L, null, null, true)', pg_temp.id('rv'))), 'bad_location');
select pg_temp.expect('a one-way car has no seats home',
  pg_temp.refusal(format('select public.request_return_seat(%L, %s, %s, true)', pg_temp.id('rw'),
    (select near_lat from t_loc), (select near_lon from t_loc))), 'no_return_seats');
select pg_temp.expect('too far from the car is refused',
  pg_temp.refusal(format('select public.request_return_seat(%L, %s, %s, true)', pg_temp.id('rv'),
    (select far_lat from t_loc), (select near_lon from t_loc))), 'too_far');
select pg_temp.expect('an unknown ride is not found',
  pg_temp.refusal(format('select public.request_return_seat(%L, %s, %s, true)', gen_random_uuid(),
    (select near_lat from t_loc), (select near_lon from t_loc))), 'ride_not_found');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000001');
select pg_temp.expect('the driver cannot ask for a seat in their own car',
  pg_temp.refusal(format('select public.request_return_seat(%L, %s, %s, true)', pg_temp.id('rv'),
    (select near_lat from t_loc), (select near_lon from t_loc))), 'own_ride');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000002');
select pg_temp.expect('someone already in the car does not ask again',
  pg_temp.refusal(format('select public.request_return_seat(%L, %s, %s, true)', pg_temp.id('rv'),
    (select near_lat from t_loc), (select near_lon from t_loc))), 'already_going');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000010');
select pg_temp.expect('a suspended fan cannot ask for a seat home',
  pg_temp.refusal(format('select public.request_return_seat(%L, %s, %s, true)', pg_temp.id('rv'),
    (select near_lat from t_loc), (select near_lon from t_loc))), 'suspended');

select pg_temp.as_user('e3000000-0000-4000-8000-000000000003');
select public.request_return_seat(pg_temp.id('rv'), (select near_lat from t_loc), (select near_lon from t_loc), true);

reset role;
select pg_temp.expect('no coordinates are kept for a seat home (only the rounded distance)',
  (select count(*)::integer from information_schema.columns
   where table_schema = 'public' and table_name = 'ride_return_request'
     and (data_type = 'USER-DEFINED' or column_name ~ '(lat|lon|location|point)')), 0);
select pg_temp.expect('the distance is rounded to 100 m',
  (select distance_to_car_m % 100 = 0 and distance_to_car_m between 1000 and 1300 from public.ride_return_request
   where ride_id = pg_temp.id('rv') and profile_id = 'e3000000-0000-4000-8000-000000000003'), true);
select pg_temp.expect('the share is worked out on the server',
  (select share_cents from public.ride_return_request
   where ride_id = pg_temp.id('rv') and profile_id = 'e3000000-0000-4000-8000-000000000003'), 667);
set local role authenticated;

select pg_temp.as_user('e3000000-0000-4000-8000-000000000003');
select pg_temp.expect('the fan sees their own request',
  (select status || ':' || share_cents from public.ride_return_people(pg_temp.id('rv'))), 'pending:667');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000002');
select pg_temp.expect('another passenger does not see who asked for a seat home',
  (select count(*)::integer from public.ride_return_people(pg_temp.id('rv'))), 0);
select pg_temp.as_user('e3000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider does not see who asked',
  (select count(*)::integer from public.ride_return_people(pg_temp.id('rv'))), 0);
select pg_temp.as_user('e3000000-0000-4000-8000-000000000001');
select pg_temp.expect('the driver sees the request and how far away the fan is',
  (select display_name || ':' || status || ':' || (distance_to_car_m > 0)::text from public.ride_return_people(pg_temp.id('rv'))),
  'Volta F:pending:true');
select pg_temp.expect('the driver is alerted',
  (select pending from public.my_ride_alerts() where kind = 'volta_pedidos' and ride_id = pg_temp.id('rv')), 1);

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Only the driver answers, and the price and seats are kept on the server.

select pg_temp.as_user('e3000000-0000-4000-8000-000000000003');
select pg_temp.expect('the fan cannot accept themselves',
  pg_temp.refusal(format('select public.answer_return_request(%L, %L, true)', pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000003')),
  'not_driver');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000002');
select pg_temp.expect('a passenger cannot accept',
  pg_temp.refusal(format('select public.answer_return_request(%L, %L, true)', pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000003')),
  'not_driver');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000006');
select pg_temp.expect('an admin cannot accept',
  pg_temp.refusal(format('select public.answer_return_request(%L, %L, true)', pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000003')),
  'not_driver');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000007');
select pg_temp.expect('another driver cannot accept',
  pg_temp.refusal(format('select public.answer_return_request(%L, %L, true)', pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000003')),
  'not_driver');

select pg_temp.as_user('e3000000-0000-4000-8000-000000000001');
select pg_temp.expect('answering someone who did not ask fails',
  pg_temp.refusal(format('select public.answer_return_request(%L, %L, true)', pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000005')),
  'request_not_found');
select public.answer_return_request(pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000003', true);

select pg_temp.as_user('e3000000-0000-4000-8000-000000000004');
select public.request_return_seat(pg_temp.id('rv'), (select near_lat from t_loc), (select near_lon from t_loc), true);
select pg_temp.expect('the next fan pays half the trip split by five (rounded up)',
  (select price_cents || ':' || seats_left from public.ride_return_board('teste-acesso-volta') where ride_id = pg_temp.id('rv')),
  '500:1');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000001');
select public.answer_return_request(pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000004', true);
select pg_temp.expect('accepting someone lowers everyone''s share',
  (select string_agg(display_name || ':' || share_cents, ',' order by display_name) from public.ride_return_people(pg_temp.id('rv'))),
  'Volta F:500,Volta Q:500');

-- The car is full on the way back: P + F + Q in three seats.
select pg_temp.as_user('e3000000-0000-4000-8000-000000000011');
select pg_temp.expect('a full car is off the board',
  (select count(*)::integer from public.ride_return_board('teste-acesso-volta') where ride_id = pg_temp.id('rv')), 0);
select pg_temp.expect('a full car takes no more requests',
  pg_temp.refusal(format('select public.request_return_seat(%L, %s, %s, true)', pg_temp.id('rv'),
    (select near_lat from t_loc), (select near_lon from t_loc))), 'ride_full');
select pg_temp.expect('someone with no request cannot cancel one',
  pg_temp.refusal(format('select public.cancel_return_request(%L)', pg_temp.id('rv'))), 'request_not_found');

select pg_temp.as_user('e3000000-0000-4000-8000-000000000004');
select public.cancel_return_request(pg_temp.id('rv'));
select pg_temp.as_user('e3000000-0000-4000-8000-000000000003');
select pg_temp.expect('one less on the way back: the others pay a bit more',
  (select share_cents from public.ride_return_people(pg_temp.id('rv'))), 667);
select pg_temp.expect('the fan is told they have a seat home',
  (select kind from public.my_ride_alerts() where ride_id = pg_temp.id('rv')), 'volta_aceite');

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Who turned up: only people in the car report on each other, and only see their own reports.

select pg_temp.as_user('e3000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider cannot report attendance',
  pg_temp.refusal(format('select public.report_ride_attendance(%L, %L, false)', pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000002')),
  'not_participant');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000004');
select pg_temp.expect('someone who cancelled their seat home cannot report',
  pg_temp.refusal(format('select public.report_ride_attendance(%L, %L, false)', pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000002')),
  'not_participant');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000001');
select pg_temp.expect('nobody reports on themselves',
  pg_temp.refusal(format('select public.report_ride_attendance(%L, %L, true)', pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000001')),
  'not_participant');
select pg_temp.expect('nobody reports on someone who was not in the car',
  pg_temp.refusal(format('select public.report_ride_attendance(%L, %L, false)', pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000005')),
  'not_participant');
select public.report_ride_attendance(pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000002', false);
select public.report_ride_attendance(pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000003', true);
select pg_temp.expect('the driver sees their own reports',
  (select count(*)::integer from public.my_ride_attendance(pg_temp.id('rv'))), 2);
select pg_temp.as_user('e3000000-0000-4000-8000-000000000002');
select public.report_ride_attendance(pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000001', false);
select pg_temp.expect('a passenger sees only their own report, not what was said about them',
  (select string_agg(subject_id::text || ':' || showed_up, ',') from public.my_ride_attendance(pg_temp.id('rv'))),
  'e3000000-0000-4000-8000-000000000001:false');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000003');
select pg_temp.expect('a fan with a seat home can report too',
  pg_temp.refusal(format('select public.report_ride_attendance(%L, %L, true)', pg_temp.id('rv'), 'e3000000-0000-4000-8000-000000000001')),
  'accepted');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider sees no attendance reports',
  (select count(*)::integer from public.my_ride_attendance(pg_temp.id('rv'))), 0);

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Incidents (a reason not to have turned up) and the votes on them.

select pg_temp.as_user('e3000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider cannot report an incident',
  pg_temp.refusal(format('select public.report_ride_incident(%L, %L, null)', pg_temp.id('rv'), 'doenca')), 'not_participant');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000002');
select pg_temp.expect('an unknown reason is refused',
  pg_temp.refusal(format('select public.report_ride_incident(%L, %L, null)', pg_temp.id('rv'), 'preguica')),
  'new row for relation "ride_incident" violates check constraint "ride_incident_reason_check"');
select pg_temp.expect('a long note is refused',
  pg_temp.refusal(format('select public.report_ride_incident(%L, %L, %L)', pg_temp.id('rv'), 'outro', repeat('x', 281))),
  'new row for relation "ride_incident" violates check constraint "ride_incident_note_check"');
select public.report_ride_incident(pg_temp.id('rv'), 'avaria', '  Furei um pneu  ');
insert into t_ids (key, id)
select 'inc', i.id from public.ride_incidents(pg_temp.id('rv')) as i where i.profile_id = 'e3000000-0000-4000-8000-000000000002';
select pg_temp.expect('the passenger sees their incident, trimmed',
  (select reason || ':' || note from public.ride_incidents(pg_temp.id('rv'))), 'avaria:Furei um pneu');
select pg_temp.expect('nobody votes on their own incident',
  pg_temp.refusal(format('select public.vote_ride_incident(%L, true)', pg_temp.id('inc'))), 'not_participant');

select pg_temp.as_user('e3000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider sees no incidents', (select count(*)::integer from public.ride_incidents(pg_temp.id('rv'))), 0);
select pg_temp.expect('an outsider cannot vote',
  pg_temp.refusal(format('select public.vote_ride_incident(%L, false)', pg_temp.id('inc'))), 'not_participant');
select pg_temp.expect('an unknown incident is refused',
  pg_temp.refusal(format('select public.vote_ride_incident(%L, false)', gen_random_uuid())), 'not_participant');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000006');
select pg_temp.expect('an admin sees no incidents either', (select count(*)::integer from public.ride_incidents(pg_temp.id('rv'))), 0);

select pg_temp.as_user('e3000000-0000-4000-8000-000000000001');
select public.vote_ride_incident(pg_temp.id('inc'), true);
select pg_temp.as_user('e3000000-0000-4000-8000-000000000003');
select public.vote_ride_incident(pg_temp.id('inc'), false);
select public.vote_ride_incident(pg_temp.id('inc'), false);
select pg_temp.expect('one vote each, changeable, counted on the server',
  (select accepts || ':' || rejects || ':' || my_vote from public.ride_incidents(pg_temp.id('rv'))), '1:1:false');

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. KNOWN HOLE (fails until fixed): request_return_seat does not check that a group-only car is visible to the caller.
-- request_ride_seat refuses 'ride_not_found' for an outsider; the seat home lets them in.

select pg_temp.as_user('e3000000-0000-4000-8000-000000000005');
select pg_temp.expect('the outsider does not see the group''s car on the board',
  (select count(*)::integer from public.ride_return_board('teste-acesso-volta') where ride_id = pg_temp.id('rp')), 0);
select pg_temp.expect('an outsider cannot ask for a seat home in a group-only car',
  pg_temp.refusal(format('select public.request_return_seat(%L, %s, %s, true)', pg_temp.id('rp'),
    (select near_lat from t_loc), (select near_lon from t_loc))), 'ride_not_found');

reset role;
select count(*) as checks_passed from expect_log;

rollback;
