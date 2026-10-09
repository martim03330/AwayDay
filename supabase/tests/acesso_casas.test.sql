-- Access tests for shared houses: stay_plan, stay_place.
--
-- People: H offers a public house for a game abroad; H2 offers a house only for their group (with G); P, Q and R ask
-- for places; O is an outsider; ADM is an admin; BAN has two faults.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_casas.test.sql

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

-- A game abroad (a house is only offered where people need to sleep over).
create function pg_temp.make_fixture_abroad(p_id text, p_kickoff timestamptz)
returns void
language sql
as $$
  insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at)
  select p_id, f.competition_id, f.stage, f.home_club_id, f.away_club_id, v.id, p_kickoff
  from public.fixture as f
  cross join lateral (
    select v.id from public.venue as v where v.country <> 'Portugal' order by v.id limit 1
  ) as v
  order by f.id
  limit 1;
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('e7000000-0000-4000-8000-000000000001', 'casas-h@test.invalid', '{"display_name":"Casas H"}', 'authenticated', 'authenticated'),
  ('e7000000-0000-4000-8000-000000000002', 'casas-h2@test.invalid', '{"display_name":"Casas H2"}', 'authenticated', 'authenticated'),
  ('e7000000-0000-4000-8000-000000000003', 'casas-p@test.invalid', '{"display_name":"Casas P"}', 'authenticated', 'authenticated'),
  ('e7000000-0000-4000-8000-000000000004', 'casas-q@test.invalid', '{"display_name":"Casas Q"}', 'authenticated', 'authenticated'),
  ('e7000000-0000-4000-8000-000000000005', 'casas-g@test.invalid', '{"display_name":"Casas G"}', 'authenticated', 'authenticated'),
  ('e7000000-0000-4000-8000-000000000006', 'casas-o@test.invalid', '{"display_name":"Casas O"}', 'authenticated', 'authenticated'),
  ('e7000000-0000-4000-8000-000000000007', 'casas-adm@test.invalid', '{"display_name":"Casas Adm"}', 'authenticated', 'authenticated'),
  ('e7000000-0000-4000-8000-000000000008', 'casas-ban@test.invalid', '{"display_name":"Casas Ban"}', 'authenticated', 'authenticated'),
  ('e7000000-0000-4000-8000-000000000009', 'casas-r@test.invalid', '{"display_name":"Casas R"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'e7000000-0000-4000-8000-000000000007';

-- H2's group: H2 and G.
insert into public.fan_group (id, name, created_by, invite_code)
values ('e7000000-0000-4000-8000-0000000000a1', 'Grupo Casas', 'e7000000-0000-4000-8000-000000000002', 'tcasas0001');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('e7000000-0000-4000-8000-0000000000a1', 'e7000000-0000-4000-8000-000000000002', 'owner'),
  ('e7000000-0000-4000-8000-0000000000a1', 'e7000000-0000-4000-8000-000000000005', 'member');

select pg_temp.make_fixture_abroad('teste-acesso-casas', now() + interval '10 days');
select pg_temp.make_fixture_abroad('teste-acesso-casas-longe', now() + interval '200 days');
select pg_temp.make_fixture('teste-acesso-casas-pt', now() + interval '10 days');
select pg_temp.expect('the game abroad needs a place to sleep',
  (select v.country <> 'Portugal' from public.fixture as f join public.venue as v on v.id = f.venue_id
   where f.id = 'teste-acesso-casas'), true);

-- BAN has two no-shows (in two rides on the Portuguese game).
insert into t_ids (key, id) values ('r1', gen_random_uuid()), ('r2', gen_random_uuid());
select pg_temp.make_ride(pg_temp.id('r1'), 'teste-acesso-casas-pt', 'e7000000-0000-4000-8000-000000000001', 3, 1000, 0);
select pg_temp.make_ride(pg_temp.id('r2'), 'teste-acesso-casas-pt', 'e7000000-0000-4000-8000-000000000002', 3, 1000, 0);
insert into public.ride_outcome (ride_id, profile_id, role, outcome)
values
  (pg_temp.id('r1'), 'e7000000-0000-4000-8000-000000000008', 'passenger', 'no_show'),
  (pg_temp.id('r2'), 'e7000000-0000-4000-8000-000000000008', 'passenger', 'late_cancel');

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. No direct access.

set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon: no direct access to stay_plan', pg_temp.direct_access('stay_plan'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon: no direct access to stay_place', pg_temp.direct_access('stay_place'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon cannot list houses',
  pg_temp.refusal('select * from public.fixture_stay_plans(''teste-acesso-casas'')'),
  'permission denied for function fixture_stay_plans');
select pg_temp.expect('anon cannot offer a house',
  pg_temp.refusal('select public.set_stay_plan(p_fixture_id => ''teste-acesso-casas'', p_nights => 2::smallint, p_total_cents => 30000, p_spare_places => 2::smallint, p_commitment => ''certo'')'),
  'permission denied for function set_stay_plan');
select pg_temp.expect('anon cannot ask for a place',
  pg_temp.refusal(format('select public.request_stay_place(%L)', gen_random_uuid())), 'permission denied for function request_stay_place');

set local role authenticated;
select pg_temp.as_user('e7000000-0000-4000-8000-000000000001');
select pg_temp.expect('host: no direct access to stay_plan', pg_temp.direct_access('stay_plan'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('host: no direct access to stay_place', pg_temp.direct_access('stay_place'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.as_user('e7000000-0000-4000-8000-000000000007');
select pg_temp.expect('admin: no direct access to stay_plan', pg_temp.direct_access('stay_plan'),
  'select:denied insert:denied update:denied delete:denied');

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Offering a house: whole cents, sane limits, validated on the server.

create function pg_temp.offer(p_fixture text, p_nights integer, p_total integer, p_spare integer, p_commitment text,
  p_note text default null, p_url text default null)
returns text
language sql
as $$
  select pg_temp.refusal(format(
    'select public.set_stay_plan(p_fixture_id => %L, p_nights => %s::smallint, p_total_cents => %s, p_spare_places => %s::smallint, p_commitment => %L, p_note => %L, p_listing_url => %L)',
    p_fixture, p_nights, p_total, p_spare, p_commitment, p_note, p_url));
$$;

select pg_temp.as_user('e7000000-0000-4000-8000-000000000001');
select pg_temp.expect('no house for a game at home', pg_temp.offer('teste-acesso-casas-pt', 2, 30000, 2, 'certo'), 'stay_not_needed');
select pg_temp.expect('at least one night', pg_temp.offer('teste-acesso-casas', 0, 30000, 2, 'certo'), 'bad_stay');
select pg_temp.expect('at most 14 nights', pg_temp.offer('teste-acesso-casas', 15, 30000, 2, 'certo'), 'bad_stay');
select pg_temp.expect('at least 10 €', pg_temp.offer('teste-acesso-casas', 2, 999, 2, 'certo'), 'bad_stay');
select pg_temp.expect('at most 10 000 €', pg_temp.offer('teste-acesso-casas', 2, 1000001, 2, 'certo'), 'bad_stay');
select pg_temp.expect('at least one spare place', pg_temp.offer('teste-acesso-casas', 2, 30000, 0, 'certo'), 'bad_stay');
select pg_temp.expect('a known commitment', pg_temp.offer('teste-acesso-casas', 2, 30000, 2, 'talvez'), 'bad_stay');
select pg_temp.expect('only https links', pg_temp.offer('teste-acesso-casas', 2, 30000, 2, 'certo', null, 'http://casa.example'), 'bad_stay');
select pg_temp.expect('a short note', pg_temp.offer('teste-acesso-casas', 2, 30000, 2, 'certo', repeat('x', 201)), 'bad_stay');
select pg_temp.expect('not too far ahead', pg_temp.offer('teste-acesso-casas-longe', 2, 30000, 2, 'certo'), 'outside_window');
select pg_temp.expect('the price is whole cents',
  pg_temp.refusal('select public.set_stay_plan(p_fixture_id => ''teste-acesso-casas'', p_nights => 2::smallint, p_total_cents => ''300.5'', p_spare_places => 2::smallint, p_commitment => ''certo'')'),
  'invalid input syntax for type integer: "300.5"');
select pg_temp.as_user('e7000000-0000-4000-8000-000000000008');
select pg_temp.expect('a suspended fan cannot offer a house', pg_temp.offer('teste-acesso-casas', 2, 30000, 2, 'certo'), 'needs_history');

select pg_temp.as_user('e7000000-0000-4000-8000-000000000001');
select pg_temp.expect('a house link must be Airbnb or Booking (no look-alike payment pages)',
  pg_temp.refusal('select public.set_stay_plan(p_fixture_id => ''teste-acesso-casas'', p_nights => 2::smallint, p_total_cents => 30000, p_spare_places => 2::smallint, p_commitment => ''certo'', p_listing_url => ''https://airbnb-pt-reserva.example/1'')'),
  'new row for relation "stay_plan" violates check constraint "stay_plan_listing_url_check"');
insert into t_ids (key, id) values ('casa', public.set_stay_plan(p_fixture_id => 'teste-acesso-casas', p_nights => 2::smallint,
  p_total_cents => 30000, p_spare_places => 2::smallint, p_commitment => 'certo', p_listing_url => 'https://www.airbnb.pt/rooms/1'));
select pg_temp.expect('the host cannot change the price directly',
  pg_temp.refusal(format('update public.stay_plan set total_cents = 1 where id = %L', pg_temp.id('casa'))),
  'permission denied for table stay_plan');

select pg_temp.as_user('e7000000-0000-4000-8000-000000000002');
insert into t_ids (key, id) values ('privada', public.set_stay_plan(p_fixture_id => 'teste-acesso-casas', p_nights => 1::smallint,
  p_total_cents => 10001, p_spare_places => 1::smallint, p_commitment => 'se_houver'));
select pg_temp.expect('a house cannot be private without a group',
  pg_temp.refusal(format('select public.set_stay_visibility(%L, false)', pg_temp.id('privada'))), 'needs_group');
select pg_temp.expect('a host cannot give someone else''s house to a group',
  pg_temp.refusal(format('select public.set_stay_group(%L, %L)', pg_temp.id('casa'), 'e7000000-0000-4000-8000-0000000000a1')),
  'not_owner');
select public.set_stay_group(pg_temp.id('privada'), 'e7000000-0000-4000-8000-0000000000a1');
select public.set_stay_visibility(pg_temp.id('privada'), false);

select pg_temp.as_user('e7000000-0000-4000-8000-000000000003');
select pg_temp.expect('someone else cannot make the house private',
  pg_temp.refusal(format('select public.set_stay_visibility(%L, false)', pg_temp.id('casa'))), 'not_owner');
select pg_temp.expect('someone else cannot mark the house as booked',
  pg_temp.refusal(format('select public.mark_stay_house(%L, true)', pg_temp.id('casa'))), 'not_owner');
select pg_temp.expect('someone outside the group cannot give the house to it',
  pg_temp.refusal(format('select public.set_stay_group(%L, %L)', pg_temp.id('casa'), 'e7000000-0000-4000-8000-0000000000a1')),
  'not_member');

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Who sees which house, and the share worked out on the server.

select pg_temp.as_user('e7000000-0000-4000-8000-000000000006');
select pg_temp.expect('an outsider sees only the public house, with the share now and when full',
  (select string_agg(display_name || ':' || share_now_cents || ':' || share_full_cents || ':' || pending, ',')
   from public.fixture_stay_plans('teste-acesso-casas')),
  'Casas H:30000:10000:0');
select pg_temp.as_user('e7000000-0000-4000-8000-000000000007');
select pg_temp.expect('an admin does not see the private house either',
  (select count(*)::integer from public.fixture_stay_plans('teste-acesso-casas') where id = pg_temp.id('privada')), 0);
select pg_temp.as_user('e7000000-0000-4000-8000-000000000005');
select pg_temp.expect('a group member sees both, and the group''s name on the private one',
  (select string_agg(display_name || ':' || coalesce(group_name, '-') || ':' || share_now_cents, ',' order by display_name)
   from public.fixture_stay_plans('teste-acesso-casas')),
  'Casas H:-:30000,Casas H2:Grupo Casas:10001');

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Asking for a place; only the host answers.

select pg_temp.as_user('e7000000-0000-4000-8000-000000000001');
select pg_temp.expect('the host cannot ask for a place in their own house',
  pg_temp.refusal(format('select public.request_stay_place(%L)', pg_temp.id('casa'))), 'own_house');
select pg_temp.as_user('e7000000-0000-4000-8000-000000000006');
select pg_temp.expect('an unknown house is not found',
  pg_temp.refusal(format('select public.request_stay_place(%L)', gen_random_uuid())), 'house_not_found');
select pg_temp.expect('an outsider cannot ask for a place in a private house',
  pg_temp.refusal(format('select public.request_stay_place(%L)', pg_temp.id('privada'))), 'house_not_found');
select pg_temp.as_user('e7000000-0000-4000-8000-000000000008');
select pg_temp.expect('a suspended fan cannot ask for a place',
  pg_temp.refusal(format('select public.request_stay_place(%L)', pg_temp.id('casa'))), 'needs_history');

select pg_temp.as_user('e7000000-0000-4000-8000-000000000003');
select public.request_stay_place(pg_temp.id('casa'));
select pg_temp.expect('the requester sees only their own request',
  (select string_agg(display_name || ':' || status, ',') from public.stay_place_people(pg_temp.id('casa'))), 'Casas P:pedido');
select pg_temp.as_user('e7000000-0000-4000-8000-000000000004');
select public.request_stay_place(pg_temp.id('casa'));
select pg_temp.as_user('e7000000-0000-4000-8000-000000000006');
select pg_temp.expect('an outsider sees nobody while nobody is accepted',
  (select count(*)::integer from public.stay_place_people(pg_temp.id('casa'))), 0);
select pg_temp.as_user('e7000000-0000-4000-8000-000000000001');
select pg_temp.expect('the host sees both requests and the count',
  (select string_agg(display_name || ':' || status, ',' order by display_name) from public.stay_place_people(pg_temp.id('casa')))
  || '/' || (select pending from public.fixture_stay_plans('teste-acesso-casas') where id = pg_temp.id('casa')),
  'Casas P:pedido,Casas Q:pedido/2');

select pg_temp.as_user('e7000000-0000-4000-8000-000000000003');
select pg_temp.expect('a requester cannot accept themselves',
  pg_temp.refusal(format('select public.answer_stay_place(%L, %L, true)', pg_temp.id('casa'), 'e7000000-0000-4000-8000-000000000003')),
  'not_owner');
select pg_temp.as_user('e7000000-0000-4000-8000-000000000006');
select pg_temp.expect('an outsider cannot answer',
  pg_temp.refusal(format('select public.answer_stay_place(%L, %L, true)', pg_temp.id('casa'), 'e7000000-0000-4000-8000-000000000003')),
  'not_owner');
select pg_temp.as_user('e7000000-0000-4000-8000-000000000007');
select pg_temp.expect('an admin cannot answer',
  pg_temp.refusal(format('select public.answer_stay_place(%L, %L, true)', pg_temp.id('casa'), 'e7000000-0000-4000-8000-000000000003')),
  'not_owner');
select pg_temp.as_user('e7000000-0000-4000-8000-000000000002');
select pg_temp.expect('another host cannot answer',
  pg_temp.refusal(format('select public.answer_stay_place(%L, %L, true)', pg_temp.id('casa'), 'e7000000-0000-4000-8000-000000000003')),
  'not_owner');

select pg_temp.as_user('e7000000-0000-4000-8000-000000000001');
select pg_temp.expect('answering someone who did not ask fails',
  pg_temp.refusal(format('select public.answer_stay_place(%L, %L, true)', pg_temp.id('casa'), 'e7000000-0000-4000-8000-000000000006')),
  'request_not_found');
select public.answer_stay_place(pg_temp.id('casa'), 'e7000000-0000-4000-8000-000000000003', true);
select public.answer_stay_place(pg_temp.id('casa'), 'e7000000-0000-4000-8000-000000000004', true);

-- Two spare places, two taken.
select pg_temp.as_user('e7000000-0000-4000-8000-000000000009');
select pg_temp.expect('a full house takes no more requests',
  pg_temp.refusal(format('select public.request_stay_place(%L)', pg_temp.id('casa'))), 'house_full');
select pg_temp.expect('the share for three people, from the server',
  (select taken || ':' || share_now_cents from public.fixture_stay_plans('teste-acesso-casas') where id = pg_temp.id('casa')),
  '2:10000');
select pg_temp.expect('who is in a public house is shown to people looking at it',
  (select string_agg(display_name, ',' order by display_name) from public.stay_place_people(pg_temp.id('casa'))), 'Casas P,Casas Q');

select pg_temp.as_user('e7000000-0000-4000-8000-000000000004');
select public.leave_stay_place(pg_temp.id('casa'));
select pg_temp.as_user('e7000000-0000-4000-8000-000000000006');
select pg_temp.expect('someone with no place cannot leave one',
  pg_temp.refusal(format('select public.leave_stay_place(%L)', pg_temp.id('casa'))), 'request_not_found');
select pg_temp.as_user('e7000000-0000-4000-8000-000000000001');
select public.mark_stay_house(pg_temp.id('casa'), true);
select pg_temp.as_user('e7000000-0000-4000-8000-000000000009');
select pg_temp.expect('a booked house takes no more requests even with a free place',
  pg_temp.refusal(format('select public.request_stay_place(%L)', pg_temp.id('casa'))), 'house_full');

select pg_temp.as_user('e7000000-0000-4000-8000-000000000003');
select public.remove_stay_plan('teste-acesso-casas');
select pg_temp.expect('removing "my house" never removes someone else''s',
  (select count(*)::integer from public.fixture_stay_plans('teste-acesso-casas') where id = pg_temp.id('casa')), 1);
select pg_temp.as_user('e7000000-0000-4000-8000-000000000001');
select public.remove_stay_plan('teste-acesso-casas');
select pg_temp.expect('the host removes their house',
  (select count(*)::integer from public.fixture_stay_plans('teste-acesso-casas') where id = pg_temp.id('casa')), 0);
select pg_temp.expect('internal helpers are not callable',
  pg_temp.refusal('select public.delete_old_stay_plans()'), 'permission denied for function delete_old_stay_plans');

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. KNOWN HOLE (fails until fixed): stay_place_people has no visibility check, so anyone signed in who has the id of
-- a group-only house sees the names of the people staying there (fixture_stay_plans hides the house itself).

select pg_temp.as_user('e7000000-0000-4000-8000-000000000005');
select public.request_stay_place(pg_temp.id('privada'));
select pg_temp.as_user('e7000000-0000-4000-8000-000000000002');
select public.answer_stay_place(pg_temp.id('privada'), 'e7000000-0000-4000-8000-000000000005', true);
select pg_temp.as_user('e7000000-0000-4000-8000-000000000006');
select pg_temp.expect('an outsider does not see who stays in a group-only house',
  (select count(*)::integer from public.stay_place_people(pg_temp.id('privada'))), 0);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
