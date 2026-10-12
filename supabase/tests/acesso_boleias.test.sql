-- Access tests for rides: ride, ride_passenger, ride_invite (and the ban that ride_outcome drives).
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_boleias.test.sql
--
-- People: D drives a public ride, D2 drives a group-only ride, P and Q ask for seats, G is in D2's group,
-- O is an outsider, ADM is an admin, F is a fresh account, BAN has two no-shows (suspended).

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
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
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
  ('e1000000-0000-4000-8000-000000000001', 'boleias-d@test.invalid', '{"display_name":"Boleias D"}', 'authenticated', 'authenticated'),
  ('e1000000-0000-4000-8000-000000000002', 'boleias-p@test.invalid', '{"display_name":"Boleias P"}', 'authenticated', 'authenticated'),
  ('e1000000-0000-4000-8000-000000000003', 'boleias-q@test.invalid', '{"display_name":"Boleias Q"}', 'authenticated', 'authenticated'),
  ('e1000000-0000-4000-8000-000000000004', 'boleias-g@test.invalid', '{"display_name":"Boleias G"}', 'authenticated', 'authenticated'),
  ('e1000000-0000-4000-8000-000000000005', 'boleias-o@test.invalid', '{"display_name":"Boleias O"}', 'authenticated', 'authenticated'),
  ('e1000000-0000-4000-8000-000000000006', 'boleias-adm@test.invalid', '{"display_name":"Boleias Adm"}', 'authenticated', 'authenticated'),
  ('e1000000-0000-4000-8000-000000000007', 'boleias-f@test.invalid', '{"display_name":"Boleias F"}', 'authenticated', 'authenticated'),
  ('e1000000-0000-4000-8000-000000000008', 'boleias-ban@test.invalid', '{"display_name":"Boleias Ban"}', 'authenticated', 'authenticated'),
  ('e1000000-0000-4000-8000-000000000009', 'boleias-d2@test.invalid', '{"display_name":"Boleias D2"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'e1000000-0000-4000-8000-000000000006';

-- D2's group: D2 and G. BAN joins it at the end.
insert into public.fan_group (id, name, created_by, invite_code)
values ('e1000000-0000-4000-8000-0000000000a1', 'Grupo Boleias', 'e1000000-0000-4000-8000-000000000009', 'tboleias01');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('e1000000-0000-4000-8000-0000000000a1', 'e1000000-0000-4000-8000-000000000009', 'owner'),
  ('e1000000-0000-4000-8000-0000000000a1', 'e1000000-0000-4000-8000-000000000004', 'member');

-- D and F are friends; D and G are friends too (G blocks D later).
insert into public.friendship (requester_id, addressee_id, status, responded_at)
values
  ('e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000007', 'aceite', now()),
  ('e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000004', 'aceite', now());

select pg_temp.make_fixture('teste-acesso-boleias', now() + interval '3 days');
select pg_temp.expect('the test game exists',
  (select count(*)::integer from public.fixture where id = 'teste-acesso-boleias'), 1);

insert into t_ids (key, id) values ('r1', gen_random_uuid()), ('r2', gen_random_uuid());
-- R1: public, one way, 2 seats, 18,00 € fuel + 6,00 € tolls. R2: only for D2's group, 3 seats.
select pg_temp.make_ride(pg_temp.id('r1'), 'teste-acesso-boleias', 'e1000000-0000-4000-8000-000000000001', 2, 1800, 600);
select pg_temp.make_ride(pg_temp.id('r2'), 'teste-acesso-boleias', 'e1000000-0000-4000-8000-000000000009', 3, 1500, 0,
  false, 'e1000000-0000-4000-8000-0000000000a1', 'grupo');

-- BAN: two no-shows in the last 180 days (ride_outcome is only written by the settle_rides cron).
insert into public.ride_outcome (ride_id, profile_id, role, outcome)
values
  (pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000008', 'passenger', 'no_show'),
  (pg_temp.id('r2'), 'e1000000-0000-4000-8000-000000000008', 'passenger', 'no_show');

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Server-side rules on the ride row itself (the owner writes, as the edge function does).

select pg_temp.expect('the price is always fuel + tolls',
  pg_temp.refusal(format(
    'update public.ride set total_cents = 1 where id = %L', pg_temp.id('r1'))),
  'new row for relation "ride" violates check constraint "ride_total_is_fuel_plus_tolls"');
select pg_temp.expect('fuel cannot be negative',
  pg_temp.refusal(format(
    'update public.ride set fuel_cents = -600, toll_cents = 600, total_cents = 0 where id = %L', pg_temp.id('r1'))),
  'new row for relation "ride" violates check constraint "ride_fuel_cents_check"');
select pg_temp.expect('a car has between 1 and 7 free seats',
  pg_temp.refusal(format('update public.ride set seats_offered = 8 where id = %L', pg_temp.id('r1'))),
  'new row for relation "ride" violates check constraint "ride_seats_offered_check"');
select pg_temp.expect('a group-only ride needs a group',
  pg_temp.refusal(format('update public.ride set group_id = null where id = %L', pg_temp.id('r2'))),
  'new row for relation "ride" violates check constraint "ride_private_needs_group"');
select pg_temp.expect('one open ride per driver and game',
  split_part(pg_temp.refusal(format(
    'select pg_temp.make_ride(%L, %L, %L, 2, 1000, 0)',
    gen_random_uuid(), 'teste-acesso-boleias', 'e1000000-0000-4000-8000-000000000001')), ' "', 1),
  'duplicate key value violates unique constraint');
select pg_temp.expect('money columns are whole cents',
  (select string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' order by a.attname)
   from pg_attribute as a
   where a.attrelid = 'public.ride'::regclass and a.attname like '%cents'),
  'fuel_cents:integer,toll_cents:integer,total_cents:integer');

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Nobody reads or writes the ride tables directly: everything goes through the functions.

set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon: no direct access to ride', pg_temp.direct_access('ride'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon: no direct access to ride_passenger', pg_temp.direct_access('ride_passenger'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon: no direct access to ride_invite', pg_temp.direct_access('ride_invite'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon: no direct access to ride_outcome', pg_temp.direct_access('ride_outcome'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon cannot see the ride board',
  pg_temp.refusal('select * from public.ride_board(''teste-acesso-boleias'')'), 'permission denied for function ride_board');
select pg_temp.expect('anon cannot ask for a seat',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', pg_temp.id('r1'))),
  'permission denied for function request_ride_seat');
select pg_temp.expect('anon cannot answer a request',
  pg_temp.refusal(format('select public.answer_ride_request(%L, %L, true)', pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000002')),
  'permission denied for function answer_ride_request');
select pg_temp.expect('anon cannot cancel a ride',
  pg_temp.refusal(format('select public.cancel_ride(%L)', pg_temp.id('r1'))), 'permission denied for function cancel_ride');
select pg_temp.expect('anon cannot see who is in a car',
  pg_temp.refusal(format('select * from public.ride_people(%L)', pg_temp.id('r1'))), 'permission denied for function ride_people');
select pg_temp.expect('anon cannot read reputations',
  pg_temp.refusal('select * from public.ride_reputation(array[''e1000000-0000-4000-8000-000000000001''::uuid])'),
  'permission denied for function ride_reputation');

set local role authenticated;
select pg_temp.as_user('e1000000-0000-4000-8000-000000000001');
select pg_temp.expect('driver: no direct access to ride', pg_temp.direct_access('ride'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('driver: no direct access to ride_passenger', pg_temp.direct_access('ride_passenger'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('driver: no direct access to ride_invite', pg_temp.direct_access('ride_invite'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.as_user('e1000000-0000-4000-8000-000000000006');
select pg_temp.expect('admin: no direct access to ride', pg_temp.direct_access('ride'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('admin: no direct access to ride_outcome', pg_temp.direct_access('ride_outcome'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('nobody can change the price of a ride directly',
  pg_temp.refusal(format('update public.ride set total_cents = 0, fuel_cents = 0, toll_cents = 0 where id = %L', pg_temp.id('r1'))),
  'permission denied for table ride');

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. The board: public rides for everyone signed in, group rides only for the group.

select pg_temp.as_user('e1000000-0000-4000-8000-000000000007');
select pg_temp.expect('fresh account sees only the public ride',
  (select string_agg(origin_name || ':' || visibility, ',') from public.ride_board('teste-acesso-boleias')), 'Coimbra:publica');
select pg_temp.expect('the board shows the server price: total, now and when full',
  (select total_cents || '/' || share_now_cents || '/' || share_full_cents || '/' || (fuel_cents + toll_cents)
   from public.ride_board('teste-acesso-boleias') where id = pg_temp.id('r1')),
  '2400/2400/800/2400');
select pg_temp.as_user('e1000000-0000-4000-8000-000000000005');
select pg_temp.expect('outsider does not see the group ride',
  (select count(*)::integer from public.ride_board('teste-acesso-boleias') where id = pg_temp.id('r2')), 0);
select pg_temp.as_user('e1000000-0000-4000-8000-000000000006');
select pg_temp.expect('admin does not see the group ride either',
  (select count(*)::integer from public.ride_board('teste-acesso-boleias') where id = pg_temp.id('r2')), 0);
select pg_temp.as_user('e1000000-0000-4000-8000-000000000004');
select pg_temp.expect('group member sees both rides, with the group name on the private one',
  (select string_agg(coalesce(group_name, '-') || ':' || visibility, ',' order by visibility)
   from public.ride_board('teste-acesso-boleias')),
  'Grupo Boleias:grupo,-:publica');
select pg_temp.as_user('e1000000-0000-4000-8000-000000000009');
select pg_temp.expect('the driver sees their own group ride as theirs',
  (select is_mine from public.ride_board('teste-acesso-boleias') where id = pg_temp.id('r2')), true);

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Asking for a seat.

select pg_temp.as_user('e1000000-0000-4000-8000-000000000007');
select pg_temp.expect('a seat needs the rules accepted',
  pg_temp.refusal(format('select public.request_ride_seat(%L, false)', pg_temp.id('r1'))), 'rules_not_accepted');
select pg_temp.expect('an unknown ride is not found',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', gen_random_uuid())), 'ride_not_found');
select pg_temp.as_user('e1000000-0000-4000-8000-000000000001');
select pg_temp.expect('the driver cannot ask for a seat in their own car',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', pg_temp.id('r1'))), 'own_ride');
select pg_temp.as_user('e1000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider cannot ask for a seat in a group ride (looks like it does not exist)',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', pg_temp.id('r2'))), 'ride_not_found');
select pg_temp.as_user('e1000000-0000-4000-8000-000000000004');
select pg_temp.expect('a group member can ask for a seat in the group ride',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', pg_temp.id('r2'))), 'accepted');
select pg_temp.as_user('e1000000-0000-4000-8000-000000000008');
select pg_temp.expect('a suspended fan cannot ask for a seat',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', pg_temp.id('r1'))), 'suspended');
select pg_temp.expect('the suspension is visible in the reputation',
  (select faults || ':' || (banned_until > now())::text
   from public.ride_reputation(array['e1000000-0000-4000-8000-000000000008'::uuid])), '2:true');

select pg_temp.as_user('e1000000-0000-4000-8000-000000000002');
select public.request_ride_seat(pg_temp.id('r1'), true);
select pg_temp.as_user('e1000000-0000-4000-8000-000000000003');
select public.request_ride_seat(pg_temp.id('r1'), true);
select pg_temp.expect('asking twice keeps one request',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', pg_temp.id('r1'))), 'accepted');
select pg_temp.expect('a requester sees their status on the board',
  (select my_status from public.ride_board('teste-acesso-boleias') where id = pg_temp.id('r1')), 'requested');
select pg_temp.expect('a requester does not see who else is in the car',
  (select count(*)::integer from public.ride_people(pg_temp.id('r1'))), 0);

select pg_temp.as_user('e1000000-0000-4000-8000-000000000001');
select pg_temp.expect('the driver sees the two requests',
  (select string_agg(display_name || ':' || status, ',' order by display_name) from public.ride_people(pg_temp.id('r1'))),
  'Boleias D:driver,Boleias P:requested,Boleias Q:requested');
select pg_temp.expect('the driver is told there are requests waiting',
  (select pending from public.my_ride_alerts() where kind = 'pedidos' and ride_id = pg_temp.id('r1')), 2);

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Only the driver answers requests and manages the ride.

select pg_temp.as_user('e1000000-0000-4000-8000-000000000002');
select pg_temp.expect('a requester cannot accept someone else',
  pg_temp.refusal(format('select public.answer_ride_request(%L, %L, true)', pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000003')),
  'not_driver');
select pg_temp.expect('a requester cannot accept themselves',
  pg_temp.refusal(format('select public.answer_ride_request(%L, %L, true)', pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000002')),
  'not_driver');
select pg_temp.as_user('e1000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider cannot answer requests',
  pg_temp.refusal(format('select public.answer_ride_request(%L, %L, true)', pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000002')),
  'not_driver');
select pg_temp.as_user('e1000000-0000-4000-8000-000000000006');
select pg_temp.expect('an admin cannot answer requests',
  pg_temp.refusal(format('select public.answer_ride_request(%L, %L, true)', pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000002')),
  'not_driver');
select pg_temp.as_user('e1000000-0000-4000-8000-000000000009');
select pg_temp.expect('another driver cannot answer requests on a car that is not theirs',
  pg_temp.refusal(format('select public.answer_ride_request(%L, %L, true)', pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000002')),
  'not_driver');

select pg_temp.as_user('e1000000-0000-4000-8000-000000000001');
select pg_temp.expect('answering someone who did not ask fails',
  pg_temp.refusal(format('select public.answer_ride_request(%L, %L, true)', pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000005')),
  'no_request');
select public.answer_ride_request(pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000002', true);
select pg_temp.expect('accepting twice fails (the request is gone)',
  pg_temp.refusal(format('select public.answer_ride_request(%L, %L, true)', pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000002')),
  'no_request');

select pg_temp.as_user('e1000000-0000-4000-8000-000000000002');
select pg_temp.expect('an accepted passenger sees the driver and themselves, not pending requests',
  (select string_agg(display_name || ':' || status, ',' order by display_name) from public.ride_people(pg_temp.id('r1'))),
  'Boleias D:driver,Boleias P:accepted');
select pg_temp.expect('the passenger''s ride is in my rides',
  (select role from public.my_rides() where id = pg_temp.id('r1')), 'passenger');
select pg_temp.expect('the price per person drops when someone joins (server-side)',
  (select share_now_cents from public.ride_board('teste-acesso-boleias') where id = pg_temp.id('r1')), 1200);
select pg_temp.expect('a passenger cannot change the price',
  pg_temp.refusal(format('update public.ride set total_cents = 100, fuel_cents = 100, toll_cents = 0 where id = %L', pg_temp.id('r1'))),
  'permission denied for table ride');
select pg_temp.expect('a passenger cannot make themselves accepted directly',
  pg_temp.refusal(format(
    'update public.ride_passenger set status = %L where ride_id = %L', 'accepted', pg_temp.id('r1'))),
  'permission denied for table ride_passenger');
select pg_temp.expect('a passenger cannot change the seats',
  pg_temp.refusal(format('update public.ride set seats_offered = 7 where id = %L', pg_temp.id('r1'))),
  'permission denied for table ride');
select pg_temp.expect('a passenger cannot make the ride private',
  pg_temp.refusal(format('select public.set_ride_visibility(%L, false)', pg_temp.id('r1'))), 'not_driver');
select pg_temp.expect('a passenger cannot attach the ride to a group',
  pg_temp.refusal(format('select public.set_ride_group(%L, %L)', pg_temp.id('r1'), 'e1000000-0000-4000-8000-0000000000a1')),
  'not_member');
select pg_temp.expect('a passenger cannot open return seats',
  pg_temp.refusal(format('select public.set_ride_return_requests(%L, true)', pg_temp.id('r1'))), 'not_driver');
select public.cancel_ride(pg_temp.id('r1'));
select pg_temp.expect('a passenger cannot cancel the ride (nothing happens)',
  (select status from public.ride_board('teste-acesso-boleias') where id = pg_temp.id('r1')), 'open');
select pg_temp.expect('a passenger cannot invite people to the car',
  pg_temp.refusal(format('select public.invite_friend_to_ride(%L, %L)', pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000007')),
  'not_driver');

select pg_temp.as_user('e1000000-0000-4000-8000-000000000004');
select pg_temp.expect('a group member who is not the driver cannot attach someone''s ride to the group',
  pg_temp.refusal(format('select public.set_ride_group(%L, %L)', pg_temp.id('r1'), 'e1000000-0000-4000-8000-0000000000a1')),
  'not_driver');

select pg_temp.as_user('e1000000-0000-4000-8000-000000000001');
select pg_temp.expect('the driver cannot make a ride private without a group',
  pg_temp.refusal(format('select public.set_ride_visibility(%L, false)', pg_temp.id('r1'))), 'needs_group');
select pg_temp.expect('the driver cannot attach the ride to a group they are not in',
  pg_temp.refusal(format('select public.set_ride_group(%L, %L)', pg_temp.id('r1'), 'e1000000-0000-4000-8000-0000000000a1')),
  'not_member');
select pg_temp.expect('return seats need a round trip',
  pg_temp.refusal(format('select public.set_ride_return_requests(%L, true)', pg_temp.id('r1'))), 'not_round_trip');

-- Declining, and the seat count.
select public.answer_ride_request(pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000003', false);
select pg_temp.as_user('e1000000-0000-4000-8000-000000000003');
select pg_temp.expect('a declined fan is told so',
  (select kind from public.my_ride_alerts() where ride_id = pg_temp.id('r1')), 'recusado');
select pg_temp.expect('a declined fan does not see the car',
  (select count(*)::integer from public.ride_people(pg_temp.id('r1'))), 0);
select pg_temp.expect('a declined fan may ask again',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', pg_temp.id('r1'))), 'accepted');

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Invites go only from the driver to the driver's friends.

select pg_temp.as_user('e1000000-0000-4000-8000-000000000001');
select pg_temp.expect('the driver cannot invite a stranger',
  pg_temp.refusal(format('select public.invite_friend_to_ride(%L, %L)', pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000005')),
  'not_friends');
select public.invite_friend_to_ride(pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000007');

select pg_temp.as_user('e1000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider has no invites', (select count(*)::integer from public.my_ride_invites()), 0);
select pg_temp.expect('an outsider cannot decline someone else''s invite',
  pg_temp.refusal(format('select public.decline_ride_invite(%L)', pg_temp.id('r1'))), 'not_yours');
select pg_temp.expect('an outsider cannot accept someone else''s invite',
  pg_temp.refusal(format('select public.accept_ride_invite(%L)', pg_temp.id('r1'))), 'not_yours');

select pg_temp.as_user('e1000000-0000-4000-8000-000000000007');
select pg_temp.expect('the friend sees the invite, with the price after joining',
  (select driver_name || ':' || seats_left || ':' || share_cents from public.my_ride_invites() where ride_id = pg_temp.id('r1')),
  'Boleias D:1:800');
select public.accept_ride_invite(pg_temp.id('r1'));
select pg_temp.expect('accepting the invite gives the seat',
  (select my_status from public.ride_board('teste-acesso-boleias') where id = pg_temp.id('r1')), 'accepted');
select pg_temp.expect('the invite is used up', (select count(*)::integer from public.my_ride_invites()), 0);

-- The car is now full (P and F): nobody else gets in, by any door.
select pg_temp.as_user('e1000000-0000-4000-8000-000000000003');
select pg_temp.expect('no request into a full car',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', pg_temp.id('r1'))), 'ride_full');
select pg_temp.as_user('e1000000-0000-4000-8000-000000000001');
select pg_temp.expect('no invite into a full car',
  pg_temp.refusal(format('select public.invite_friend_to_ride(%L, %L)', pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000004')),
  'ride_full');
select pg_temp.expect('no accepting into a full car',
  pg_temp.refusal(format('select public.answer_ride_request(%L, %L, true)', pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000003')),
  'ride_full');
select pg_temp.expect('two passengers in a two-seat car',
  (select seats_taken || '/' || seats_offered from public.ride_board('teste-acesso-boleias') where id = pg_temp.id('r1')), '2/2');

-- A block ends the friendship, so no more invites between them.
select pg_temp.as_user('e1000000-0000-4000-8000-000000000004');
select public.block_user('e1000000-0000-4000-8000-000000000001');
select pg_temp.as_user('e1000000-0000-4000-8000-000000000001');
select public.leave_ride(pg_temp.id('r1'));
select pg_temp.expect('a driver leaving their own car changes nothing',
  (select seats_taken from public.ride_board('teste-acesso-boleias') where id = pg_temp.id('r1')), 2);

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Leaving and cancelling.

select pg_temp.as_user('e1000000-0000-4000-8000-000000000005');
select public.leave_ride(pg_temp.id('r1'));
select pg_temp.as_user('e1000000-0000-4000-8000-000000000007');
select public.leave_ride(pg_temp.id('r1'));
select pg_temp.expect('a passenger leaves only their own seat',
  (select seats_taken || ':' || coalesce(my_status, '-') from public.ride_board('teste-acesso-boleias') where id = pg_temp.id('r1')),
  '1:left');

select pg_temp.as_user('e1000000-0000-4000-8000-000000000001');
select pg_temp.expect('the driver cannot invite a friend who blocked them',
  pg_temp.refusal(format('select public.invite_friend_to_ride(%L, %L)', pg_temp.id('r1'), 'e1000000-0000-4000-8000-000000000004')),
  'not_friends');

select pg_temp.as_user('e1000000-0000-4000-8000-000000000009');
select public.cancel_ride(pg_temp.id('r1'));
select pg_temp.as_user('e1000000-0000-4000-8000-000000000006');
select public.cancel_ride(pg_temp.id('r1'));
select pg_temp.as_user('e1000000-0000-4000-8000-000000000001');
select pg_temp.expect('only the driver can cancel (others change nothing)',
  (select status from public.ride_board('teste-acesso-boleias') where id = pg_temp.id('r1')), 'open');
select public.cancel_ride(pg_temp.id('r1'));
select pg_temp.expect('the driver cancels: the ride leaves the board, the driver''s included',
  (select count(*)::integer from public.ride_board('teste-acesso-boleias') where id = pg_temp.id('r1')), 0);
select pg_temp.as_user('e1000000-0000-4000-8000-000000000002');
select pg_temp.expect('the passenger is told the ride was cancelled',
  (select kind from public.my_ride_alerts() where ride_id = pg_temp.id('r1')), 'cancelada');
select pg_temp.as_user('e1000000-0000-4000-8000-000000000005');
select pg_temp.expect('a cancelled ride leaves the board for others',
  (select count(*)::integer from public.ride_board('teste-acesso-boleias') where id = pg_temp.id('r1')), 0);
select pg_temp.expect('no requests into a cancelled ride',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', pg_temp.id('r1'))), 'ride_closed');

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. The cron jobs that settle rides and write outcomes are not callable by anyone in the app.

select pg_temp.expect('settle_rides is not callable',
  pg_temp.refusal('select public.settle_rides()'), 'permission denied for function settle_rides');
select pg_temp.expect('expire_ride_requests is not callable',
  pg_temp.refusal('select public.expire_ride_requests()'), 'permission denied for function expire_ride_requests');
select pg_temp.expect('delete_cancelled_rides is not callable',
  pg_temp.refusal('select public.delete_cancelled_rides()'), 'permission denied for function delete_cancelled_rides');
select pg_temp.expect('ride_ban_until is not callable directly',
  pg_temp.refusal('select public.ride_ban_until(''e1000000-0000-4000-8000-000000000008'')'),
  'permission denied for function ride_ban_until');
select pg_temp.expect('ride_role is not callable directly',
  pg_temp.refusal(format('select public.ride_role(%L, %L)', pg_temp.id('r2'), 'e1000000-0000-4000-8000-000000000004')),
  'permission denied for function ride_role');
select pg_temp.expect('in_ride is not callable directly',
  pg_temp.refusal(format('select public.in_ride(%L, %L)', pg_temp.id('r2'), 'e1000000-0000-4000-8000-000000000004')),
  'permission denied for function in_ride');
select pg_temp.expect('nobody writes outcomes to clear a ban',
  pg_temp.refusal('delete from public.ride_outcome'), 'permission denied for table ride_outcome');

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. KNOWN HOLE (fails until fixed): a suspended fan gets a seat through a group plan without the ban check.
-- request_ride_seat and request_return_seat refuse 'suspended'; join_plan_ride puts them straight in as 'accepted'.

reset role;
insert into public.fan_group_member (group_id, profile_id)
values ('e1000000-0000-4000-8000-0000000000a1', 'e1000000-0000-4000-8000-000000000008');
insert into t_ids (key, id) values ('plano', gen_random_uuid());
-- The ride for the group already made a plan by itself; this test builds its own.
delete from public.fixture_plan where group_id = 'e1000000-0000-4000-8000-0000000000a1' and fixture_id = 'teste-acesso-boleias';
insert into public.fixture_plan (id, group_id, fixture_id, created_by, ride_id)
values (pg_temp.id('plano'), 'e1000000-0000-4000-8000-0000000000a1', 'teste-acesso-boleias',
  'e1000000-0000-4000-8000-000000000009', pg_temp.id('r2'));
set local role authenticated;

select pg_temp.as_user('e1000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider cannot join a group plan''s car',
  pg_temp.refusal(format('select public.join_plan_ride(%L)', pg_temp.id('plano'))), 'plan_not_found');
select pg_temp.as_user('e1000000-0000-4000-8000-000000000008');
select pg_temp.expect('a suspended fan cannot get a seat through a group plan',
  pg_temp.refusal(format('select public.join_plan_ride(%L)', pg_temp.id('plano'))), 'suspended');

reset role;
select count(*) as checks_passed from expect_log;

rollback;
