-- Access tests for the functions behind rides, trips and houses: who may run them, how they are built, and the
-- price arithmetic they share.
--
-- People: A and B went to a game together; C is a third person.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_boleias_funcoes.test.sql

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

-- Runs a query that returns one integer, or null when it is refused.
create function pg_temp.try_int(p_sql text)
returns integer
language plpgsql
as $$
declare
  valor integer;
begin
  execute p_sql into valor;
  return valor;
exception when others then
  return null;
end;
$$;

-- Every function that reads or writes the ride, trip and house tables.
create temporary table t_funcs on commit drop as
select p.oid, p.proname, p.prosecdef, p.proconfig, p.provolatile, p.prosrc
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and p.prosrc ~ '(public\.(ride|trip_|stay_|toll_rate|parking_spot|venue_parking))'
  or (n.nspname = 'public' and p.proname in ('ride_share_cents', 'ride_return_share_cents', 'stay_share_cents',
    'ride_requests_close_at', 'ride_return_opens_at', 'ride_return_closes_at', 'ride_chat_closes_at'));
grant select on t_funcs to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('e9000000-0000-4000-8000-000000000001', 'funcoes-a@test.invalid', '{"display_name":"Funcoes A"}', 'authenticated', 'authenticated'),
  ('e9000000-0000-4000-8000-000000000002', 'funcoes-b@test.invalid', '{"display_name":"Funcoes B"}', 'authenticated', 'authenticated'),
  ('e9000000-0000-4000-8000-000000000003', 'funcoes-c@test.invalid', '{"display_name":"Funcoes C"}', 'authenticated', 'authenticated');

-- A and B went to a game together.
select pg_temp.make_fixture('teste-acesso-funcoes', now() - interval '5 days');
insert into t_ids (key, id) values ('s', gen_random_uuid());
insert into public.trip_session (id, fixture_id, opened_by, name)
values (pg_temp.id('s'), 'teste-acesso-funcoes', 'e9000000-0000-4000-8000-000000000001', 'Juntos');
insert into public.trip_session_member (session_id, profile_id)
values
  (pg_temp.id('s'), 'e9000000-0000-4000-8000-000000000001'),
  (pg_temp.id('s'), 'e9000000-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. How the functions are built.

select pg_temp.expect('there are functions to check', (select count(*)::integer > 50 from t_funcs), true);
select pg_temp.expect('every security definer function pins its search_path',
  (select string_agg(proname, ',') from t_funcs
   where prosecdef and not coalesce(array_to_string(proconfig, ','), '') like '%search_path=%'), null);
select pg_temp.expect('anon can only run the pure price and time arithmetic',
  (select string_agg(distinct proname, ',' order by proname) from t_funcs where has_function_privilege('anon', oid, 'execute')),
  'ride_return_closes_at,ride_return_opens_at,ride_return_share_cents,ride_share_cents,stay_share_cents');
select pg_temp.expect('the cron jobs, triggers and inner helpers are not callable from the app',
  (select string_agg(distinct proname, ',' order by proname) from t_funcs
   where has_function_privilege('authenticated', oid, 'execute')
     and proname in ('settle_rides', 'expire_ride_requests', 'delete_cancelled_rides', 'delete_old_stay_plans',
       'sync_ride_trip_expense', 'ensure_plan_session', 'close_plans_with_full_ride', 'close_plans_after_passenger_change',
       'ride_session_id', 'ride_return_people_count', 'stay_people_count', 'trip_session_people', 'in_ride', 'ride_role',
       'ride_ban_until', 'have_crossed_paths', 'can_see_profile', 'apply_user_block', 'notify_ride_change',
       'notify_ride_invite', 'notify_ride_message', 'notify_trip_expense_shares', 'notify_trip_settlement',
       'link_ride_to_open_plan', 'link_stay_to_open_plan')),
  null);

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. The price arithmetic (it decides what people pay): always whole cents, rounded up, never divides by zero.

set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('24,00 € by 3 is 8,00 €', public.ride_share_cents(2400, 3), 800);
select pg_temp.expect('10,00 € by 3 rounds up to 3,34 €', public.ride_share_cents(1000, 3), 334);
select pg_temp.expect('1 cent by 2 rounds up to 1 cent', public.ride_share_cents(1, 2), 1);
select pg_temp.expect('a free ride costs nothing', public.ride_share_cents(0, 4), 0);
select pg_temp.expect('nobody in the car counts as the driver alone', public.ride_share_cents(1000, 0), 1000);
select pg_temp.expect('the way home is half the trip, split and rounded up', public.ride_return_share_cents(4000, 3), 667);
select pg_temp.expect('half of an odd total rounds up before splitting', public.ride_return_share_cents(4001, 1), 2001);
select pg_temp.expect('a house of 100,01 € for two is 50,01 € each', public.stay_share_cents(10001, 2), 5001);
select pg_temp.expect('the ride price result is an integer',
  pg_typeof(public.ride_share_cents(1000, 3))::text, 'integer');

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. KNOWN HOLES (fail until fixed).
--    a) trips_together(p_one, p_other) is executable by any signed-in account with any two people, so a third person
--       can learn how many games two others went to together. Only trip_companions uses it (with auth.uid()).
--    b) An old overload set_stay_plan(p_fixture_id, p_kind, p_cents_per_person, ...) is still there and executable;
--       it writes columns that no longer exist.

set local role authenticated;
select pg_temp.as_user('e9000000-0000-4000-8000-000000000001');
select pg_temp.expect('A sees B among the companions of that game',
  (select display_name || ':' || trips_together from public.trip_companions('teste-acesso-funcoes')), 'Funcoes B:1');
select pg_temp.as_user('e9000000-0000-4000-8000-000000000003');
select pg_temp.expect('C cannot find out how many trips A and B made together',
  coalesce(pg_temp.try_int(
    'select public.trips_together(''e9000000-0000-4000-8000-000000000001'', ''e9000000-0000-4000-8000-000000000002'')'), 0),
  0);
select pg_temp.expect('only one set_stay_plan is left',
  (select count(*)::integer from t_funcs where proname = 'set_stay_plan'), 1);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
