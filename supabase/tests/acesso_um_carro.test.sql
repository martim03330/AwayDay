-- One car per person per game (2026-10-09): a driver cannot ask for a seat in another ride of the same game, and
-- someone with a seat or a pending request cannot offer a ride for that game. Leaving first frees them.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_um_carro.test.sql

begin;

create temporary table expect_log (name text) on commit drop;
grant insert, select on expect_log to authenticated, anon;

create function pg_temp.expect(p_name text, p_actual anyelement, p_expected anyelement)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAILED %: got %, expected %', p_name, p_actual, p_expected;
  end if;
  insert into expect_log (name) values (p_name);
end;
$$;

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

create function pg_temp.as_user(p_id text)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('ad00000c-0000-4000-8000-0000000000a1', 'um-carro-a@test.invalid', '{"display_name":"Carro A"}', 'authenticated', 'authenticated'),
  ('ad00000c-0000-4000-8000-0000000000b1', 'um-carro-b@test.invalid', '{"display_name":"Carro B"}', 'authenticated', 'authenticated'),
  ('ad00000c-0000-4000-8000-0000000000c1', 'um-carro-c@test.invalid', '{"display_name":"Carro C"}', 'authenticated', 'authenticated');

create temporary table t_ids (key text primary key, id uuid, txt text) on commit drop;
grant insert, select on t_ids to authenticated;
insert into t_ids (key, txt)
select 'jogo', f.id from public.fixture as f where f.kickoff_at > now() + interval '2 days' order by f.kickoff_at limit 1;
insert into t_ids (key, id) values ('carro_a', gen_random_uuid()), ('carro_b', gen_random_uuid()), ('carro_c', gen_random_uuid());

-- A and B both drive to the same game.
insert into public.ride (
  id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
  total_cents
)
select (select id from t_ids where key = 'carro_a'), f.id, 'ad00000c-0000-4000-8000-0000000000a1', 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)',
  f.kickoff_at - interval '3 hours', 3, 'rapida', false, 100000, 3600, 0, 600, 1700, 1020, 0, 1020
from public.fixture as f where f.id = (select txt from t_ids where key = 'jogo');
insert into public.ride (
  id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
  total_cents
)
select (select id from t_ids where key = 'carro_b'), f.id, 'ad00000c-0000-4000-8000-0000000000b1', 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)',
  f.kickoff_at - interval '3 hours', 3, 'rapida', false, 100000, 3600, 0, 600, 1700, 1020, 0, 1020
from public.fixture as f where f.id = (select txt from t_ids where key = 'jogo');

set local role authenticated;
select pg_temp.as_user('ad00000c-0000-4000-8000-0000000000b1');
select pg_temp.expect('a driver cannot ask for a seat in another car of the same game',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', (select id from t_ids where key = 'carro_a'))),
  'already_offering');

-- C asks for a seat in A's car: then C cannot offer a ride to that game.
select pg_temp.as_user('ad00000c-0000-4000-8000-0000000000c1');
select pg_temp.expect('a fan with no car of their own can ask for a seat',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', (select id from t_ids where key = 'carro_a'))),
  'accepted');
reset role;
select pg_temp.expect('someone with a pending request cannot offer a ride to that game',
  pg_temp.refusal($$insert into public.ride (
  id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
  total_cents
) select (select id from t_ids where key = 'carro_c'), f.id, 'ad00000c-0000-4000-8000-0000000000c1', 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)',
  f.kickoff_at - interval '3 hours', 3, 'rapida', false, 100000, 3600, 0, 600, 1700, 1020, 0, 1020
  from public.fixture as f where f.id = (select txt from t_ids where key = 'jogo')$$),
  'already_going');

-- B cancels the car: B is free to ask for a seat.
set local role authenticated;
select pg_temp.as_user('ad00000c-0000-4000-8000-0000000000b1');
select public.cancel_ride((select id from t_ids where key = 'carro_b'));
select pg_temp.expect('after cancelling, the former driver can ask for a seat',
  pg_temp.refusal(format('select public.request_ride_seat(%L, true)', (select id from t_ids where key = 'carro_a'))),
  'accepted');

reset role;
select count(*) as checks_passed from expect_log;

rollback;
