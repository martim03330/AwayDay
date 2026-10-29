-- Access tests for Viagens da Casa: club_trip, club_trip_stop, club_trip_vehicle, club_trip_booking,
-- club_trip_notice, the member code, and their functions.
--
-- People: G (Gina) owns a verified Casa; S (Sara) is booked on its trip; N (Nuno) is another fan of the same club,
-- with no booking and no role in the Casa; ADM is an admin with the second factor.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_viagens_da_casa.test.sql

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

-- Just the sqlstate of a refused call, for messages that name a table or a column.
create function pg_temp.refused_state(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return 'accepted';
exception when others then
  return sqlstate;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('ca700000-0000-4000-8000-0000000000a1', 'acesso-viagens-g@test.invalid', '{"display_name":"Gina"}', 'authenticated', 'authenticated'),
  ('ca700000-0000-4000-8000-0000000000a2', 'acesso-viagens-s@test.invalid', '{"display_name":"Sara"}', 'authenticated', 'authenticated'),
  ('ca700000-0000-4000-8000-0000000000a3', 'acesso-viagens-n@test.invalid', '{"display_name":"Nuno"}', 'authenticated', 'authenticated'),
  ('ca700000-0000-4000-8000-0000000000ad', 'acesso-viagens-adm@test.invalid', '{"display_name":"Admin Acesso"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'ca700000-0000-4000-8000-0000000000ad';

select set_config('test.fixture',
  (select id from public.fixture where kickoff_at > now() + interval '3 days' order by kickoff_at, id limit 1), true);
select set_config('test.kickoff',
  (select kickoff_at::text from public.fixture where id = current_setting('test.fixture')), true);
select set_config('test.club',
  (select home_club_id from public.fixture where id = current_setting('test.fixture')), true);
select set_config('test.municipality', (select id from public.municipality order by id limit 1), true);

insert into public.profile_club (profile_id, relation, club_id)
select u::uuid, 'supporter', current_setting('test.club')
from unnest(array['ca700000-0000-4000-8000-0000000000a2', 'ca700000-0000-4000-8000-0000000000a3']) as u
on conflict (profile_id, relation) do update set club_id = excluded.club_id;

set local role authenticated;

-- A verified Casa with one bus; Sara books, Gina adds someone by hand and posts a notice.
select pg_temp.as_user('ca700000-0000-4000-8000-0000000000a1');
insert into t_ids (key, id) values ('casa', public.request_supporters_club(
  current_setting('test.club'), 'Casa Teste Acesso Viagens', current_setting('test.municipality'), null));
select pg_temp.as_user('ca700000-0000-4000-8000-0000000000ad');
select public.decide_supporters_club(pg_temp.id('casa'), 'verified');

select pg_temp.as_user('ca700000-0000-4000-8000-0000000000a1');
insert into t_ids (key, id) values ('trip', public.create_club_trip(
  pg_temp.id('casa'), current_setting('test.fixture'), 'Autocarro de Teste', 1500, false,
  current_setting('test.kickoff')::timestamptz - interval '1 day', null,
  jsonb_build_array(jsonb_build_object('name', 'Sede da Casa', 'lat', 41.15, 'lng', -8.61,
    'passes_at', current_setting('test.kickoff')::timestamptz - interval '4 hours')),
  '[{"kind":"autocarro","label":"Autocarro 1","seats":50}]'));
insert into t_ids (key, id) select 'stop', id from public.club_trip_stop where trip_id = pg_temp.id('trip');
insert into t_ids (key, id) select 'bus', id from public.club_trip_vehicle where trip_id = pg_temp.id('trip');
insert into t_ids (key, id)
select 'manual', b.id from public.add_manual_club_booking(pg_temp.id('trip'), 'Senhor Manuel', pg_temp.id('stop'), null) as b;

select pg_temp.as_user('ca700000-0000-4000-8000-0000000000a2');
insert into t_ids (key, id)
select 'sara', b.id from public.book_club_trip(pg_temp.id('trip'), pg_temp.id('stop'), null, null) as b;

select pg_temp.as_user('ca700000-0000-4000-8000-0000000000a1');
insert into t_ids (key, id) values ('notice', public.post_club_trip_notice(pg_temp.id('trip'), ' Saída às 8h em ponto. '));

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Another fan sees the trip, its stops and vehicles, but not the passengers or the notices.

select pg_temp.as_user('ca700000-0000-4000-8000-0000000000a3');
select pg_temp.expect('another fan sees the trip of a verified Casa',
  (select count(*)::integer from public.club_trip where id = pg_temp.id('trip')), 1);
select pg_temp.expect('and its stop and vehicle',
  (select count(*)::integer from public.club_trip_stop where trip_id = pg_temp.id('trip'))
  + (select count(*)::integer from public.club_trip_vehicle where trip_id = pg_temp.id('trip')), 2);
select pg_temp.expect('but none of the bookings',
  (select count(*)::integer from public.club_trip_booking where trip_id = pg_temp.id('trip')), 0);
select pg_temp.expect('nor the notices',
  (select count(*)::integer from public.club_trip_notice where trip_id = pg_temp.id('trip')), 0);
select pg_temp.expect('and has no booking of his own',
  (select count(*)::integer from public.my_club_booking(pg_temp.id('trip'))), 0);

select pg_temp.expect('the summary shows seats and occupied, but not the money nor the waiting list',
  (select seats || '|' || occupied || '|' || (waiting_people is null) || '|' || (paid_people is null)
          || '|' || (due_cents is null)
   from public.club_trip_summary(pg_temp.id('trip'))),
  '50|2|true|true|true');

select pg_temp.expect('the trips of the game: free seats computed, no distance without a concelho, no status',
  (select free_seats || '|' || (distance_km is null) || '|' || coalesce(my_status, '-') || '|' || club_name
   from public.club_trips_for_fixture(current_setting('test.fixture')) where trip_id = pg_temp.id('trip')),
  '48|true|-|Casa Teste Acesso Viagens');
reset role;
insert into public.profile_home (profile_id, municipality_id)
values ('ca700000-0000-4000-8000-0000000000a3', current_setting('test.municipality'))
on conflict (profile_id) do update set municipality_id = excluded.municipality_id;
set local role authenticated;
select pg_temp.expect('with a concelho, the distance to the first stop is given',
  (select distance_km is not null and distance_km >= 0
   from public.club_trips_for_fixture(current_setting('test.fixture')) where trip_id = pg_temp.id('trip')),
  true);

-- He cannot call any manager function (42501).
select pg_temp.expect('a non-manager cannot publish a trip for the Casa',
  pg_temp.refusal(format(
    'select public.create_club_trip(%L, %L, ''Viagem'', 0, false, now() + interval ''1 day'', null, ''[]'', ''[]'')',
    pg_temp.id('casa'), current_setting('test.fixture'))),
  'not_manager (42501)');
select pg_temp.expect('nor add a vehicle',
  pg_temp.refusal(format('select public.add_club_trip_vehicle(%L, ''autocarro'', ''Autocarro 2'', 50)', pg_temp.id('trip'))),
  'not_manager (42501)');
select pg_temp.expect('nor change one',
  pg_temp.refusal(format('select public.update_club_trip_vehicle(%L, ''X'', 10)', pg_temp.id('bus'))),
  'not_manager (42501)');
select pg_temp.expect('nor remove one',
  pg_temp.refusal(format('select public.remove_club_trip_vehicle(%L)', pg_temp.id('bus'))),
  'not_manager (42501)');
select pg_temp.expect('nor close or cancel the trip',
  pg_temp.refusal(format('select public.set_club_trip_status(%L, ''cancelled'')', pg_temp.id('trip'))),
  'not_manager (42501)');
select pg_temp.expect('nor add someone by hand',
  pg_temp.refusal(format('select public.add_manual_club_booking(%L, ''Intruso'', %L, null)', pg_temp.id('trip'), pg_temp.id('stop'))),
  'not_manager (42501)');
select pg_temp.expect('nor mark someone paid',
  pg_temp.refusal(format('select public.manage_club_booking(%L, ''paid'')', pg_temp.id('sara'))),
  'not_manager (42501)');
select pg_temp.expect('nor remove someone',
  pg_temp.refusal(format('select public.manage_club_booking(%L, ''remove'')', pg_temp.id('sara'))),
  'not_manager (42501)');
select pg_temp.expect('nor post a notice',
  pg_temp.refusal(format('select public.post_club_trip_notice(%L, ''Olá'')', pg_temp.id('trip'))),
  'not_manager (42501)');
select pg_temp.expect('nor see the member code',
  pg_temp.refusal(format('select public.supporters_club_member_code(%L)', pg_temp.id('casa'))),
  'not_manager (42501)');
select pg_temp.expect('nor change it',
  pg_temp.refusal(format('select public.rotate_supporters_club_member_code(%L)', pg_temp.id('casa'))),
  'not_manager (42501)');
select pg_temp.expect('nor cancel Sara''s booking',
  pg_temp.refusal(format('select public.cancel_my_club_booking(%L)', pg_temp.id('sara'))),
  'booking_not_found (P0002)');

-- No direct writes, and the member code column is not readable.
select pg_temp.expect('the app cannot insert a booking directly',
  pg_temp.refusal(format(
    'insert into public.club_trip_booking (trip_id, profile_id, stop_id, status) values (%L, %L, %L, ''booked'')',
    pg_temp.id('trip'), 'ca700000-0000-4000-8000-0000000000a3', pg_temp.id('stop'))),
  'permission denied for table club_trip_booking (42501)');
select pg_temp.expect('nor change a trip',
  pg_temp.refusal(format('update public.club_trip set price_cents = 0 where id = %L', pg_temp.id('trip'))),
  'permission denied for table club_trip (42501)');
select pg_temp.expect('nor write a notice',
  pg_temp.refusal(format('insert into public.club_trip_notice (trip_id, body) values (%L, ''x'')', pg_temp.id('trip'))),
  'permission denied for table club_trip_notice (42501)');
select pg_temp.expect('the member code column cannot be read',
  pg_temp.refused_state(format('select member_code from public.supporters_club where id = %L', pg_temp.id('casa'))),
  '42501');
select pg_temp.expect('the other Casa columns still can',
  (select name from public.supporters_club where id = pg_temp.id('casa')), 'Casa Teste Acesso Viagens');

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. The passenger sees her own booking and the notices, never the others' bookings.

select pg_temp.as_user('ca700000-0000-4000-8000-0000000000a2');
select pg_temp.expect('Sara sees only her own booking',
  (select count(*)::integer from public.club_trip_booking where trip_id = pg_temp.id('trip')), 1);
select pg_temp.expect('her booking: booked, 15 € due, not paid, bus and stop',
  (select status || '|' || due_cents || '|' || paid || '|' || vehicle_label || '|' || stop_name
   from public.my_club_booking(pg_temp.id('trip'))),
  'booked|1500|false|Autocarro 1|Sede da Casa');
select pg_temp.expect('Sara sees the notice, trimmed',
  (select body from public.club_trip_notice where trip_id = pg_temp.id('trip')), 'Saída às 8h em ponto.');
select pg_temp.expect('the trips of the game show Sara as booked',
  (select my_status from public.club_trips_for_fixture(current_setting('test.fixture')) where trip_id = pg_temp.id('trip')),
  'booked');
select pg_temp.expect('the summary hides the money from a passenger too',
  (select due_cents is null from public.club_trip_summary(pg_temp.id('trip'))), true);

-- The managers see everything.
select pg_temp.as_user('ca700000-0000-4000-8000-0000000000a1');
select pg_temp.expect('the manager sees every booking',
  (select count(*)::integer from public.club_trip_booking where trip_id = pg_temp.id('trip')), 2);
select pg_temp.expect('and the money: 2 people × 15 € due',
  (select due_cents || '|' || paid_people || '|' || waiting_people from public.club_trip_summary(pg_temp.id('trip'))),
  '3000|0|0');

-- At most 10 notices per trip per day.
select public.post_club_trip_notice(pg_temp.id('trip'), 'Aviso ' || n) from generate_series(2, 10) as n;
select pg_temp.expect('an eleventh notice in a day is refused',
  pg_temp.refusal(format('select public.post_club_trip_notice(%L, ''Mais um'')', pg_temp.id('trip'))),
  'too_many_notices (22023)');

-- The passenger list with names: managers only, and the name of someone they do not know comes with it.
select pg_temp.as_user('ca700000-0000-4000-8000-0000000000a1');
select pg_temp.expect('a manager gets the names, also of a stranger and of a person added by hand',
  (select string_agg(display_name || ':' || is_manual, ',' order by display_name)
   from public.club_trip_bookings(pg_temp.id('trip'))),
  'Sara:false,Senhor Manuel:true');
select pg_temp.as_user('ca700000-0000-4000-8000-0000000000a2');
select pg_temp.expect('a passenger cannot read the passenger list',
  pg_temp.refusal(format('select * from public.club_trip_bookings(%L)', pg_temp.id('trip'))),
  'not_manager (42501)');
select pg_temp.as_user('ca700000-0000-4000-8000-0000000000a3');
select pg_temp.expect('nor can another fan',
  pg_temp.refusal(format('select * from public.club_trip_bookings(%L)', pg_temp.id('trip'))),
  'not_manager (42501)');

select pg_temp.as_user('ca700000-0000-4000-8000-0000000000a1');

-- Once Sara cancels, the notices are no longer hers to read.
select pg_temp.as_user('ca700000-0000-4000-8000-0000000000a2');
select public.cancel_my_club_booking(pg_temp.id('sara'));
select pg_temp.expect('after cancelling, Sara no longer sees the notices',
  (select count(*)::integer from public.club_trip_notice where trip_id = pg_temp.id('trip')), 0);
select pg_temp.expect('but still sees her (cancelled) booking',
  (select status from public.my_club_booking(pg_temp.id('trip'))), 'cancelled');

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. A suspended Casa's trips disappear for everyone but its managers.

select pg_temp.as_user('ca700000-0000-4000-8000-0000000000ad');
select public.decide_supporters_club(pg_temp.id('casa'), 'suspended');
select pg_temp.as_user('ca700000-0000-4000-8000-0000000000a3');
select pg_temp.expect('another fan no longer sees the trip',
  (select count(*)::integer from public.club_trip where id = pg_temp.id('trip')), 0);
select pg_temp.expect('nor in the trips of the game',
  (select count(*)::integer from public.club_trips_for_fixture(current_setting('test.fixture'))
   where trip_id = pg_temp.id('trip')), 0);
select pg_temp.expect('nor its summary',
  pg_temp.refusal(format('select * from public.club_trip_summary(%L)', pg_temp.id('trip'))),
  'trip_not_found (P0002)');
select pg_temp.as_user('ca700000-0000-4000-8000-0000000000a1');
select pg_temp.expect('its manager still sees it, cancelled',
  (select status from public.club_trip where id = pg_temp.id('trip')), 'cancelled');

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Grants: nothing for signed-out visitors; internal and trigger functions for nobody in the app.

reset role;
select pg_temp.expect('anon cannot execute any Casa trip function',
  (select bool_or(has_function_privilege('anon', f, 'execute'))
   from unnest(array[
     'public.can_see_club_trip(uuid)',
     'public.is_club_trip_manager(uuid)',
     'public.create_club_trip(uuid, text, text, integer, boolean, timestamptz, text, jsonb, jsonb)',
     'public.add_club_trip_vehicle(uuid, text, text, integer)',
     'public.update_club_trip_vehicle(uuid, text, integer)',
     'public.remove_club_trip_vehicle(uuid)',
     'public.set_club_trip_status(uuid, text)',
     'public.book_club_trip(uuid, uuid, text[], text)',
     'public.cancel_my_club_booking(uuid)',
     'public.add_manual_club_booking(uuid, text, uuid, text[])',
     'public.manage_club_booking(uuid, text, uuid)',
     'public.post_club_trip_notice(uuid, text)',
     'public.club_trip_summary(uuid)',
     'public.club_trips_for_fixture(text)',
     'public.my_club_booking(uuid)',
     'public.rotate_supporters_club_member_code(uuid)',
     'public.supporters_club_member_code(uuid)',
     'public.promote_club_trip_waiting(uuid)',
     'public.club_trip_cancel(uuid)',
     'public.club_trip_for_manager(uuid)',
     'public.club_trip_free_vehicle(uuid, integer)',
     'public.club_trip_conflict(uuid, text, uuid)',
     'public.lock_one_transport(uuid, text)',
     'public.club_trip_clean_companions(text[])',
     'public.club_trip_companions_ok(text[])',
     'public.club_trip_booking_one_transport()',
     'public.club_trip_booking_marks_going()',
     'public.ride_passenger_not_on_club_trip()',
     'public.ride_driver_not_on_club_trip()',
     'public.decide_supporters_club(uuid, text)',
     'public.create_supporters_club_invite(uuid)',
     'public.update_supporters_club(uuid, text, text)'
   ]) as f),
  false);
select pg_temp.expect('authenticated cannot execute the internal or trigger functions',
  (select bool_or(has_function_privilege('authenticated', f, 'execute'))
   from unnest(array[
     'public.promote_club_trip_waiting(uuid)',
     'public.club_trip_cancel(uuid)',
     'public.club_trip_for_manager(uuid)',
     'public.club_trip_free_vehicle(uuid, integer)',
     'public.club_trip_conflict(uuid, text, uuid)',
     'public.lock_one_transport(uuid, text)',
     'public.club_trip_clean_companions(text[])',
     'public.club_trip_companions_ok(text[])',
     'public.club_trip_booking_one_transport()',
     'public.club_trip_booking_marks_going()',
     'public.ride_passenger_not_on_club_trip()',
     'public.ride_driver_not_on_club_trip()'
   ]) as f),
  false);
select pg_temp.expect('authenticated can execute the app functions',
  (select bool_and(has_function_privilege('authenticated', f, 'execute'))
   from unnest(array[
     'public.create_club_trip(uuid, text, text, integer, boolean, timestamptz, text, jsonb, jsonb)',
     'public.add_club_trip_vehicle(uuid, text, text, integer)',
     'public.update_club_trip_vehicle(uuid, text, integer)',
     'public.remove_club_trip_vehicle(uuid)',
     'public.set_club_trip_status(uuid, text)',
     'public.book_club_trip(uuid, uuid, text[], text)',
     'public.cancel_my_club_booking(uuid)',
     'public.add_manual_club_booking(uuid, text, uuid, text[])',
     'public.manage_club_booking(uuid, text, uuid)',
     'public.post_club_trip_notice(uuid, text)',
     'public.club_trip_summary(uuid)',
     'public.club_trips_for_fixture(text)',
     'public.my_club_booking(uuid)',
     'public.rotate_supporters_club_member_code(uuid)',
     'public.supporters_club_member_code(uuid)'
   ]) as f),
  true);
select pg_temp.expect('anon has no access to the tables',
  (select bool_or(has_table_privilege('anon', t, 'select'))
   from unnest(array['public.club_trip', 'public.club_trip_stop', 'public.club_trip_vehicle',
                     'public.club_trip_booking', 'public.club_trip_notice']) as t),
  false);
select pg_temp.expect('authenticated can only read the tables',
  (select bool_or(has_table_privilege('authenticated', t, 'insert,update,delete'))
   from unnest(array['public.club_trip', 'public.club_trip_stop', 'public.club_trip_vehicle',
                     'public.club_trip_booking', 'public.club_trip_notice']) as t),
  false);
select pg_temp.expect('RLS is on for every new table',
  (select bool_and(c.relrowsecurity) from pg_class as c
   where c.oid in ('public.club_trip'::regclass, 'public.club_trip_stop'::regclass, 'public.club_trip_vehicle'::regclass,
                   'public.club_trip_booking'::regclass, 'public.club_trip_notice'::regclass)),
  true);

select pg_temp.expect('nobody but the server reads or writes the alerts',
  has_table_privilege('anon', 'public.club_trip_alert', 'select,insert,update,delete')
    or has_table_privilege('authenticated', 'public.club_trip_alert', 'select,insert,update,delete'),
  false);
select pg_temp.expect('RLS is on for the alerts, with no policy',
  (select c.relrowsecurity and not exists (select 1 from pg_policy as p where p.polrelid = c.oid)
   from pg_class as c where c.oid = 'public.club_trip_alert'::regclass),
  true);
select pg_temp.expect('the alert audience and the notify trigger are not callable by the app',
  (select bool_or(has_function_privilege(r, f, 'execute'))
   from unnest(array['anon', 'authenticated']) as r,
        unnest(array['public.claim_club_trip_alerts(uuid)', 'public.notify_club_trip_change()']) as f),
  false);
select pg_temp.expect('the alert audience is callable by club-trip-notify (service role)',
  has_function_privilege('service_role', 'public.claim_club_trip_alerts(uuid)', 'execute'), true);

select count(*) as checks_passed from expect_log;

rollback;
