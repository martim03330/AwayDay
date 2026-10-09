-- Access tests for the reference data behind ride prices and parking: toll_rate, parking_spot, venue_parking.
--
-- People: A is a fan, ADM is an admin, D drives to a known car park; and anon (no account).
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_estacionamento_portagens.test.sql

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
  ('e8000000-0000-4000-8000-000000000001', 'parque-a@test.invalid', '{"display_name":"Parque A"}', 'authenticated', 'authenticated'),
  ('e8000000-0000-4000-8000-000000000002', 'parque-adm@test.invalid', '{"display_name":"Parque Adm"}', 'authenticated', 'authenticated'),
  ('e8000000-0000-4000-8000-000000000003', 'parque-d@test.invalid', '{"display_name":"Parque D"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'e8000000-0000-4000-8000-000000000002';

-- Reference data: no column of these tables can point at a person.
select pg_temp.expect('toll rates, car parks and stadium parking notes hold no personal data',
  (select count(*)::integer from pg_constraint as c
   where c.contype = 'f' and c.confrelid = 'public.profile'::regclass
     and c.conrelid in ('public.toll_rate'::regclass, 'public.parking_spot'::regclass, 'public.venue_parking'::regclass)), 0);
select pg_temp.expect('toll prices are whole positive cents with an https source',
  (select bool_and(reference_cents > 0 and reference_m > 0 and source_url like 'https://%') from public.toll_rate), true);
select pg_temp.expect('the toll price column is an integer',
  (select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'toll_rate' and column_name = 'reference_cents'), 'integer');
select pg_temp.expect('there is a default toll rate for motorways without their own',
  (select count(*)::integer from public.toll_rate where motorway = 'default'), 1);
select pg_temp.expect('every car park says where its information came from',
  (select bool_and(jsonb_array_length(sources) > 0) from public.parking_spot), true);

-- A ride that leaves the car in a known car park.
select pg_temp.make_fixture('teste-acesso-parque', now() + interval '3 days');
insert into t_ids (key, id) values ('r', gen_random_uuid()), ('parque', gen_random_uuid());
insert into public.parking_spot (id, venue_id, name, kind, location, distance_m, sources, confidence, checked_on)
select pg_temp.id('parque'), f.venue_id, 'Parque de teste', 'parque_publico', 'SRID=4326;POINT(-8.6 41.16)', 400,
  '["https://exemplo.pt"]'::jsonb, 'high', current_date
from public.fixture as f where f.id = 'teste-acesso-parque';
select pg_temp.make_ride(pg_temp.id('r'), 'teste-acesso-parque', 'e8000000-0000-4000-8000-000000000003', 3, 1000, 0);
update public.ride set parking_spot_id = pg_temp.id('parque') where id = pg_temp.id('r');

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Everyone reads, nobody in the app writes.

set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon reads toll rates but cannot write them', pg_temp.direct_access('toll_rate'),
  'select:allowed insert:denied update:denied delete:denied');
select pg_temp.expect('anon reads car parks but cannot write them', pg_temp.direct_access('parking_spot'),
  'select:allowed insert:denied update:denied delete:denied');
select pg_temp.expect('anon reads stadium parking notes but cannot write them', pg_temp.direct_access('venue_parking'),
  'select:allowed insert:denied update:denied delete:denied');
select pg_temp.expect('anon sees the toll rates', (select count(*)::integer > 0 from public.toll_rate), true);
select pg_temp.expect('anon sees the car parks', (select count(*)::integer > 0 from public.parking_spot), true);

set local role authenticated;
select pg_temp.as_user('e8000000-0000-4000-8000-000000000001');
select pg_temp.expect('a fan reads toll rates but cannot write them', pg_temp.direct_access('toll_rate'),
  'select:allowed insert:denied update:denied delete:denied');
select pg_temp.expect('a fan reads car parks but cannot write them', pg_temp.direct_access('parking_spot'),
  'select:allowed insert:denied update:denied delete:denied');
select pg_temp.expect('a fan reads stadium parking notes but cannot write them', pg_temp.direct_access('venue_parking'),
  'select:allowed insert:denied update:denied delete:denied');
select pg_temp.expect('a fan cannot lower the toll prices',
  pg_temp.refusal('update public.toll_rate set reference_cents = 1'), 'permission denied for table toll_rate');
select pg_temp.expect('a fan cannot add a car park',
  pg_temp.refusal(format('insert into public.parking_spot (venue_id, name, kind, sources, confidence, checked_on) values (%L, %L, %L, %L, %L, current_date)',
    'dragao', 'Parque falso', 'rua', '["https://x.pt"]', 'high')),
  'permission denied for table parking_spot');

select pg_temp.as_user('e8000000-0000-4000-8000-000000000002');
select pg_temp.expect('an admin reads toll rates but cannot write them from the app', pg_temp.direct_access('toll_rate'),
  'select:allowed insert:denied update:denied delete:denied');
select pg_temp.expect('an admin cannot write car parks from the app', pg_temp.direct_access('parking_spot'),
  'select:allowed insert:denied update:denied delete:denied');
select pg_temp.expect('an admin cannot write stadium parking notes from the app', pg_temp.direct_access('venue_parking'),
  'select:allowed insert:denied update:denied delete:denied');

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. The car park of a ride is shown on the board (it is a public place, not anybody's location).

select pg_temp.as_user('e8000000-0000-4000-8000-000000000001');
select pg_temp.expect('the board shows where the car will be parked',
  (select parking_name || ':' || parking_distance_m from public.ride_board('teste-acesso-parque') where id = pg_temp.id('r')),
  'Parque de teste:400');

reset role;
select count(*) as checks_passed from expect_log;

rollback;
