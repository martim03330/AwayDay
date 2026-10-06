-- Access tests for seats: a car is never overbooked, by any of the ways in (request, invite, group plan, seat home).
--
-- People: D drives a one-seat car for the group plan of D's group (D, Q, G); P and F (D's friend) want the seat;
-- D2 drives a two-seat round trip on matchday with Q in it; P and G ask for seats home; V is D2's friend.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_boleia_lugares.test.sql

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
  ('e4000000-0000-4000-8000-000000000001', 'lugares-d@test.invalid', '{"display_name":"Lugares D"}', 'authenticated', 'authenticated'),
  ('e4000000-0000-4000-8000-000000000002', 'lugares-p@test.invalid', '{"display_name":"Lugares P"}', 'authenticated', 'authenticated'),
  ('e4000000-0000-4000-8000-000000000003', 'lugares-q@test.invalid', '{"display_name":"Lugares Q"}', 'authenticated', 'authenticated'),
  ('e4000000-0000-4000-8000-000000000004', 'lugares-f@test.invalid', '{"display_name":"Lugares F"}', 'authenticated', 'authenticated'),
  ('e4000000-0000-4000-8000-000000000005', 'lugares-g@test.invalid', '{"display_name":"Lugares G"}', 'authenticated', 'authenticated'),
  ('e4000000-0000-4000-8000-000000000006', 'lugares-v@test.invalid', '{"display_name":"Lugares V"}', 'authenticated', 'authenticated'),
  ('e4000000-0000-4000-8000-000000000007', 'lugares-d2@test.invalid', '{"display_name":"Lugares D2"}', 'authenticated', 'authenticated');

-- D's group (D, Q, G) plans the game with D's car.
insert into public.fan_group (id, name, created_by, invite_code)
values ('e4000000-0000-4000-8000-0000000000a1', 'Grupo Lugares', 'e4000000-0000-4000-8000-000000000001', 'tlugares01');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('e4000000-0000-4000-8000-0000000000a1', 'e4000000-0000-4000-8000-000000000001', 'owner'),
  ('e4000000-0000-4000-8000-0000000000a1', 'e4000000-0000-4000-8000-000000000003', 'member'),
  ('e4000000-0000-4000-8000-0000000000a1', 'e4000000-0000-4000-8000-000000000005', 'member');
-- D is friends with F; D2 is friends with V.
insert into public.friendship (requester_id, addressee_id, status, responded_at)
values
  ('e4000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000004', 'aceite', now()),
  ('e4000000-0000-4000-8000-000000000007', 'e4000000-0000-4000-8000-000000000006', 'aceite', now());

select pg_temp.make_fixture('teste-acesso-lugares', now() + interval '3 days');
select pg_temp.make_fixture('teste-acesso-lugares-hoje', now() - interval '1 hour');
create temporary table t_loc (lat double precision, lon double precision) on commit drop;
grant select on t_loc to authenticated;
insert into t_loc
select v.latitude + 0.01, v.longitude
from public.fixture as f join public.venue as v on v.id = f.venue_id
where f.id = 'teste-acesso-lugares-hoje';

insert into t_ids (key, id) values ('r', gen_random_uuid()), ('hoje', gen_random_uuid()), ('plano', gen_random_uuid());
-- R: one free seat, a week-day ride for the group's plan.
select pg_temp.make_ride(pg_temp.id('r'), 'teste-acesso-lugares', 'e4000000-0000-4000-8000-000000000001', 1, 900, 0);
insert into public.fixture_plan (id, group_id, fixture_id, created_by, ride_id)
values (pg_temp.id('plano'), 'e4000000-0000-4000-8000-0000000000a1', 'teste-acesso-lugares',
  'e4000000-0000-4000-8000-000000000001', pg_temp.id('r'));

set local role authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. One seat, many doors: the second person never gets in.

select pg_temp.as_user('e4000000-0000-4000-8000-000000000001');
select public.invite_friend_to_ride(pg_temp.id('r'), 'e4000000-0000-4000-8000-000000000004');
select pg_temp.as_user('e4000000-0000-4000-8000-000000000002');
select public.request_ride_seat(pg_temp.id('r'), true);
select pg_temp.as_user('e4000000-0000-4000-8000-000000000001');
select public.answer_ride_request(pg_temp.id('r'), 'e4000000-0000-4000-8000-000000000002', true);

select pg_temp.as_user('e4000000-0000-4000-8000-000000000004');
select pg_temp.expect('an invite made before the car filled up cannot be used',
  pg_temp.refusal(format('select public.accept_ride_invite(%L)', pg_temp.id('r'))), 'ride_full');
select pg_temp.as_user('e4000000-0000-4000-8000-000000000003');
select pg_temp.expect('the group''s plan cannot squeeze in another person',
  pg_temp.refusal(format('select public.join_plan_ride(%L)', pg_temp.id('plano'))), 'ride_full');
select pg_temp.expect('a request into the full car is refused',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', pg_temp.id('r'))), 'ride_full');
select pg_temp.as_user('e4000000-0000-4000-8000-000000000001');
select pg_temp.expect('the driver cannot invite into a full car',
  pg_temp.refusal(format('select public.invite_friend_to_ride(%L, %L)', pg_temp.id('r'), 'e4000000-0000-4000-8000-000000000004')),
  'ride_full');
select pg_temp.expect('the board says the car is full',
  (select seats_taken || '/' || seats_offered from public.ride_board('teste-acesso-lugares') where id = pg_temp.id('r')), '1/1');

reset role;
select pg_temp.expect('a full car closes the group plan',
  (select status || ':' || closed_reason from public.fixture_plan where id = pg_temp.id('plano')), 'fechado:carro_cheio');
select pg_temp.expect('one accepted passenger in a one-seat car',
  (select count(*)::integer from public.ride_passenger where ride_id = pg_temp.id('r') and status = 'accepted'), 1);
set local role authenticated;

-- When the passenger leaves, the seat is free again and the next one gets it.
select pg_temp.as_user('e4000000-0000-4000-8000-000000000002');
select public.leave_ride(pg_temp.id('r'));
select pg_temp.as_user('e4000000-0000-4000-8000-000000000004');
select pg_temp.expect('the freed seat can be taken with the invite',
  pg_temp.refusal(format('select public.accept_ride_invite(%L)', pg_temp.id('r'))), 'accepted');
select pg_temp.as_user('e4000000-0000-4000-8000-000000000002');
select pg_temp.expect('the one who left cannot take it back while it is taken',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', pg_temp.id('r'))), 'ride_full');

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. The way back: people going home take seats too.

reset role;
-- HOJE: today's game started an hour ago; D2's car (2 seats) took Q there, and V has a seat home.
select pg_temp.make_ride(pg_temp.id('hoje'), 'teste-acesso-lugares-hoje', 'e4000000-0000-4000-8000-000000000007', 2, 2000, 0, true);
update public.ride set accepts_return_requests = true where id = pg_temp.id('hoje');
insert into public.ride_passenger (ride_id, profile_id, status)
values (pg_temp.id('hoje'), 'e4000000-0000-4000-8000-000000000003', 'accepted');
set local role authenticated;

select pg_temp.as_user('e4000000-0000-4000-8000-000000000002');
select public.request_return_seat(pg_temp.id('hoje'), (select lat from t_loc), (select lon from t_loc), true);
select pg_temp.as_user('e4000000-0000-4000-8000-000000000005');
select public.request_return_seat(pg_temp.id('hoje'), (select lat from t_loc), (select lon from t_loc), true);
select pg_temp.as_user('e4000000-0000-4000-8000-000000000007');
select public.answer_return_request(pg_temp.id('hoje'), 'e4000000-0000-4000-8000-000000000002', true);
select pg_temp.expect('the driver cannot accept more people home than seats',
  pg_temp.refusal(format('select public.answer_return_request(%L, %L, true)', pg_temp.id('hoje'), 'e4000000-0000-4000-8000-000000000005')),
  'ride_full');
select pg_temp.expect('declining still works when full',
  pg_temp.refusal(format('select public.answer_return_request(%L, %L, false)', pg_temp.id('hoje'), 'e4000000-0000-4000-8000-000000000005')),
  'accepted');
select pg_temp.expect('the driver sees one seat home taken',
  (select string_agg(display_name || ':' || status, ',') from public.ride_return_people(pg_temp.id('hoje'))), 'Lugares P:accepted');
select pg_temp.expect('requests for the way there are closed on matchday',
  pg_temp.refusal(format('select public.answer_ride_request(%L, %L, true)', pg_temp.id('hoje'), 'e4000000-0000-4000-8000-000000000005')),
  'ride_closed');

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. KNOWN HOLE (fails until fixed): accept_ride_invite only counts the seats of the way there and has no time
-- limit. An invite still pending on matchday lets a third person into a two-seat car already full on the way back
-- (Q there and back, P home). invite_friend_to_ride has the same blind spot.

reset role;
insert into public.ride_invite (ride_id, profile_id, invited_by, created_at)
values (pg_temp.id('hoje'), 'e4000000-0000-4000-8000-000000000006', 'e4000000-0000-4000-8000-000000000007', now() - interval '1 day');
set local role authenticated;

select pg_temp.as_user('e4000000-0000-4000-8000-000000000006');
select pg_temp.expect('a pending invite cannot overfill a car that is full on the way back',
  pg_temp.refusal(format('select public.accept_ride_invite(%L)', pg_temp.id('hoje'))) <> 'accepted', true);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
