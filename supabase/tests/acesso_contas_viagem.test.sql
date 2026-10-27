-- Access tests for trip accounts: trip_session, trip_session_member, trip_expense, trip_expense_share, trip_settlement.
--
-- People: A, B, C and M are a group with shared accounts; N is A's friend; D drives P (and Q for a while) with the
-- car's accounts; O is an outsider; ADM is an admin.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_contas_viagem.test.sql

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
  ('e5000000-0000-4000-8000-000000000001', 'contas-a@test.invalid', '{"display_name":"Contas A"}', 'authenticated', 'authenticated'),
  ('e5000000-0000-4000-8000-000000000002', 'contas-b@test.invalid', '{"display_name":"Contas B"}', 'authenticated', 'authenticated'),
  ('e5000000-0000-4000-8000-000000000003', 'contas-c@test.invalid', '{"display_name":"Contas C"}', 'authenticated', 'authenticated'),
  ('e5000000-0000-4000-8000-000000000004', 'contas-m@test.invalid', '{"display_name":"Contas M"}', 'authenticated', 'authenticated'),
  ('e5000000-0000-4000-8000-000000000005', 'contas-o@test.invalid', '{"display_name":"Contas O"}', 'authenticated', 'authenticated'),
  ('e5000000-0000-4000-8000-000000000006', 'contas-adm@test.invalid', '{"display_name":"Contas Adm"}', 'authenticated', 'authenticated'),
  ('e5000000-0000-4000-8000-000000000007', 'contas-d@test.invalid', '{"display_name":"Contas D"}', 'authenticated', 'authenticated'),
  ('e5000000-0000-4000-8000-000000000008', 'contas-p@test.invalid', '{"display_name":"Contas P"}', 'authenticated', 'authenticated'),
  ('e5000000-0000-4000-8000-000000000009', 'contas-n@test.invalid', '{"display_name":"Contas N"}', 'authenticated', 'authenticated'),
  ('e5000000-0000-4000-8000-000000000010', 'contas-q@test.invalid', '{"display_name":"Contas Q"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'e5000000-0000-4000-8000-000000000006';

-- The group: A, B, C, M. N is A's friend. O is nobody's.
insert into public.fan_group (id, name, created_by, invite_code)
values ('e5000000-0000-4000-8000-0000000000a1', 'Grupo Contas', 'e5000000-0000-4000-8000-000000000001', 'tcontas001');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('e5000000-0000-4000-8000-0000000000a1', 'e5000000-0000-4000-8000-000000000001', 'owner'),
  ('e5000000-0000-4000-8000-0000000000a1', 'e5000000-0000-4000-8000-000000000002', 'member'),
  ('e5000000-0000-4000-8000-0000000000a1', 'e5000000-0000-4000-8000-000000000003', 'member'),
  ('e5000000-0000-4000-8000-0000000000a1', 'e5000000-0000-4000-8000-000000000004', 'member');
insert into public.friendship (requester_id, addressee_id, status, responded_at)
values ('e5000000-0000-4000-8000-000000000001', 'e5000000-0000-4000-8000-000000000009', 'aceite', now());

select pg_temp.make_fixture('teste-acesso-contas', now() + interval '1 day');
insert into t_ids (key, id) values ('ride', gen_random_uuid());
-- D drives P; 30,01 € (an odd number of cents on purpose).
select pg_temp.make_ride(pg_temp.id('ride'), 'teste-acesso-contas', 'e5000000-0000-4000-8000-000000000007', 3, 2401, 600);
insert into public.ride_passenger (ride_id, profile_id, status)
values (pg_temp.id('ride'), 'e5000000-0000-4000-8000-000000000008', 'accepted');

select pg_temp.expect('every money column in the trip tables is a whole number of cents',
  (select string_agg(table_name || '.' || column_name || ':' || data_type, ',' order by table_name, column_name)
   from information_schema.columns
   where table_schema = 'public' and table_name like 'trip%' and column_name like '%cents%'),
  'trip_expense.cents:integer,trip_settlement.cents:integer');

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Nobody touches the trip tables directly.

set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon: no direct access to trip_session', pg_temp.direct_access('trip_session'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon: no direct access to trip_session_member', pg_temp.direct_access('trip_session_member'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon: no direct access to trip_expense', pg_temp.direct_access('trip_expense'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon: no direct access to trip_expense_share', pg_temp.direct_access('trip_expense_share'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon: no direct access to trip_settlement', pg_temp.direct_access('trip_settlement'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon cannot open a trip',
  pg_temp.refusal('select public.start_trip_session(''teste-acesso-contas'')'), 'permission denied for function start_trip_session');
select pg_temp.expect('anon cannot read balances',
  pg_temp.refusal(format('select * from public.trip_balances(%L)', gen_random_uuid())), 'permission denied for function trip_balances');
select pg_temp.expect('anon cannot add expenses',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, 100)', gen_random_uuid(), 'Cerveja', 'cerveja')),
  'permission denied for function add_trip_expense');
select pg_temp.expect('anon cannot record payments',
  pg_temp.refusal(format('select public.add_trip_settlement(%L, %L, 100)', gen_random_uuid(), gen_random_uuid())),
  'permission denied for function add_trip_settlement');

set local role authenticated;
select pg_temp.as_user('e5000000-0000-4000-8000-000000000001');
select pg_temp.expect('member: no direct access to trip_session', pg_temp.direct_access('trip_session'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('member: no direct access to trip_session_member', pg_temp.direct_access('trip_session_member'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('member: no direct access to trip_expense', pg_temp.direct_access('trip_expense'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('member: no direct access to trip_expense_share', pg_temp.direct_access('trip_expense_share'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('member: no direct access to trip_settlement', pg_temp.direct_access('trip_settlement'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.as_user('e5000000-0000-4000-8000-000000000006');
select pg_temp.expect('admin: no direct access to trip_expense', pg_temp.direct_access('trip_expense'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('admin: no direct access to trip_settlement', pg_temp.direct_access('trip_settlement'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('the internal helpers are not callable',
  pg_temp.refusal(format('select public.sync_ride_trip_expense(%L)', gen_random_uuid())),
  'permission denied for function sync_ride_trip_expense');
select pg_temp.expect('the list of people of a session is not callable directly',
  pg_temp.refusal(format('select * from public.trip_session_people(%L)', gen_random_uuid())),
  'permission denied for function trip_session_people');

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Opening accounts.

select pg_temp.as_user('e5000000-0000-4000-8000-000000000001');
select pg_temp.expect('an unknown game is refused',
  pg_temp.refusal('select public.start_trip_session(''nao-existe'')'), 'fixture_not_found');
insert into t_ids (key, id) values ('s1', public.start_trip_session('teste-acesso-contas', '   '));
select pg_temp.expect('a loose session starts with only who opened it, with a default name',
  (select name || ':' || people || ':' || origin from public.my_trip_accounts('teste-acesso-contas') where session_id = pg_temp.id('s1')),
  'Contas da viagem:1:avulso');

select pg_temp.as_user('e5000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider cannot open the group''s accounts',
  pg_temp.refusal(format('select public.open_trip_session(%L, %L)', 'e5000000-0000-4000-8000-0000000000a1', 'teste-acesso-contas')),
  'not_member');
select pg_temp.as_user('e5000000-0000-4000-8000-000000000001');
insert into t_ids (key, id) values ('s2', public.open_trip_session('e5000000-0000-4000-8000-0000000000a1', 'teste-acesso-contas'));
select pg_temp.as_user('e5000000-0000-4000-8000-000000000002');
select pg_temp.expect('opening again gives the same session',
  public.open_trip_session('e5000000-0000-4000-8000-0000000000a1', 'teste-acesso-contas'), pg_temp.id('s2'));
select pg_temp.expect('the whole group is in the group''s accounts',
  (select string_agg(display_name, ',' order by display_name) from public.trip_people(pg_temp.id('s2'))),
  'Contas A,Contas B,Contas C,Contas M');
select pg_temp.expect('a group member finds the session of the game',
  (select count(*)::integer from public.trip_session_of('e5000000-0000-4000-8000-0000000000a1', 'teste-acesso-contas')), 1);
select pg_temp.expect('B is not in A''s loose session',
  (select count(*)::integer from public.trip_people(pg_temp.id('s1'))), 0);

select pg_temp.as_user('e5000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider does not find the group''s session',
  (select count(*)::integer from public.trip_session_of('e5000000-0000-4000-8000-0000000000a1', 'teste-acesso-contas')), 0);
select pg_temp.expect('an outsider sees nobody in the session',
  (select count(*)::integer from public.trip_people(pg_temp.id('s2'))), 0);
select pg_temp.expect('an outsider gets no session card',
  (select count(*)::integer from public.trip_session_cards(array[pg_temp.id('s1'), pg_temp.id('s2')])), 0);
select pg_temp.expect('an outsider has no accounts for the game',
  (select count(*)::integer from public.my_trip_accounts('teste-acesso-contas')), 0);
select pg_temp.as_user('e5000000-0000-4000-8000-000000000006');
select pg_temp.expect('an admin sees nobody in the session either',
  (select count(*)::integer from public.trip_people(pg_temp.id('s2'))), 0);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Expenses: whole cents, only between people of the trip.

select pg_temp.as_user('e5000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider cannot add an expense',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, 1000)', pg_temp.id('s2'), 'Cervejas', 'cerveja')), 'not_member');
select pg_temp.expect('an unknown session is refused',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, 1000)', gen_random_uuid(), 'Cervejas', 'cerveja')),
  'session_not_found');

select pg_temp.as_user('e5000000-0000-4000-8000-000000000001');
select pg_temp.expect('the payer must be in the trip',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, 1000, %L)', pg_temp.id('s2'), 'Cervejas', 'cerveja',
    'e5000000-0000-4000-8000-000000000005')), 'payer_not_member');
select pg_temp.expect('everyone sharing must be in the trip',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, 1000, null, array[%L, %L]::uuid[])', pg_temp.id('s2'),
    'Cervejas', 'cerveja', 'e5000000-0000-4000-8000-000000000001', 'e5000000-0000-4000-8000-000000000005')),
  'participant_not_member');
select pg_temp.expect('someone must share the expense',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, 1000, null, %L::uuid[])', pg_temp.id('s2'),
    'Cervejas', 'cerveja', '{}')), 'no_participants');
select pg_temp.expect('zero cents refused',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, 0)', pg_temp.id('s2'), 'Cervejas', 'cerveja')), 'bad_expense');
select pg_temp.expect('negative cents refused',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, -500)', pg_temp.id('s2'), 'Cervejas', 'cerveja')), 'bad_expense');
select pg_temp.expect('over 10 000 € refused',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, 1000001)', pg_temp.id('s2'), 'Cervejas', 'cerveja')), 'bad_expense');
select pg_temp.expect('fractions of a cent do not exist',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, %L)', pg_temp.id('s2'), 'Cervejas', 'cerveja', '10.50')),
  'invalid input syntax for type integer: "10.50"');
select pg_temp.expect('a one-letter description refused',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, 100)', pg_temp.id('s2'), ' x ', 'cerveja')), 'bad_expense');
select pg_temp.expect('an unknown category refused',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, 100)', pg_temp.id('s2'), 'Gasolina', 'gasolina')), 'bad_expense');

-- A pays 10,00 € of beer for A, B and C; B pays 45,00 € of tickets for everyone.
insert into t_ids (key, id) values ('cervejas', public.add_trip_expense(pg_temp.id('s2'), '  Cervejas  ', 'cerveja', 1000, null,
  array['e5000000-0000-4000-8000-000000000001', 'e5000000-0000-4000-8000-000000000002', 'e5000000-0000-4000-8000-000000000003']::uuid[]));
select pg_temp.as_user('e5000000-0000-4000-8000-000000000002');
insert into t_ids (key, id) values ('bilhetes', public.add_trip_expense(pg_temp.id('s2'), 'Bilhetes', 'bilhetes', 4500));

select pg_temp.as_user('e5000000-0000-4000-8000-000000000004');
select pg_temp.expect('a member sees all expenses, and which ones they are in',
  (select string_agg(description || ':' || cents || ':' || participants || ':' || i_am_in || ':' || mine, ',' order by description)
   from public.trip_expenses(pg_temp.id('s2'))),
  'Bilhetes:4500:4:true:false,Cervejas:1000:3:false:false');
select pg_temp.expect('a member who neither paid nor wrote it cannot remove it',
  pg_temp.refusal(format('select public.remove_trip_expense(%L)', pg_temp.id('cervejas'))), 'not_yours');
select pg_temp.as_user('e5000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider sees no expenses', (select count(*)::integer from public.trip_expenses(pg_temp.id('s2'))), 0);
select pg_temp.expect('an outsider cannot remove an expense',
  pg_temp.refusal(format('select public.remove_trip_expense(%L)', pg_temp.id('cervejas'))), 'not_yours');
select pg_temp.as_user('e5000000-0000-4000-8000-000000000006');
select pg_temp.expect('an admin sees no expenses', (select count(*)::integer from public.trip_expenses(pg_temp.id('s2'))), 0);

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Balances: computed on the server, the leftover cent goes to one person, and they always add up to zero.
-- Who gets the leftover cent depends on the expense's id (md5 of expense and person, see
-- acesso_contas_centimos.test.sql), so these checks hold whoever gets it.

select pg_temp.as_user('e5000000-0000-4000-8000-000000000003');
select pg_temp.expect('what each one paid',
  (select string_agg(display_name || ':' || paid_cents, ',' order by display_name) from public.trip_balances(pg_temp.id('s2'))),
  'Contas A:1000,Contas B:4500,Contas C:0,Contas M:0');
select pg_temp.expect('what each one owes: 10,00 € / 3 = 3,34 + 3,33 + 3,33 for A, B and C, plus 45,00 € / 4 = 11,25 € for all',
  (select string_agg((owed_cents - 1125)::text, ',' order by owed_cents) from public.trip_balances(pg_temp.id('s2'))
   where display_name <> 'Contas M')
  || ' M:' || (select owed_cents from public.trip_balances(pg_temp.id('s2')) where display_name = 'Contas M'),
  '333,333,334 M:1125');
select pg_temp.expect('each balance is what one paid minus what one owes',
  (select count(*)::integer from public.trip_balances(pg_temp.id('s2')) where balance_cents <> paid_cents - owed_cents), 0);
select pg_temp.expect('the balances add up to zero', (select sum(balance_cents)::integer from public.trip_balances(pg_temp.id('s2'))), 0);
select pg_temp.expect('what is owed adds up to what was spent',
  (select sum(owed_cents)::integer || '/' || sum(paid_cents)::integer from public.trip_balances(pg_temp.id('s2'))), '5500/5500');
select pg_temp.as_user('e5000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider sees no balances', (select count(*)::integer from public.trip_balances(pg_temp.id('s2'))), 0);
select pg_temp.as_user('e5000000-0000-4000-8000-000000000006');
select pg_temp.expect('an admin sees no balances', (select count(*)::integer from public.trip_balances(pg_temp.id('s2'))), 0);

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Payments between people.

select pg_temp.as_user('e5000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider cannot record a payment',
  pg_temp.refusal(format('select public.add_trip_settlement(%L, %L, 100)', pg_temp.id('s2'), 'e5000000-0000-4000-8000-000000000002')),
  'not_member');
select pg_temp.as_user('e5000000-0000-4000-8000-000000000001');
select pg_temp.expect('nobody records a payment between two other people',
  pg_temp.refusal(format('select public.add_trip_settlement(%L, %L, 100, %L)', pg_temp.id('s2'),
    'e5000000-0000-4000-8000-000000000003', 'e5000000-0000-4000-8000-000000000002')), 'not_yours');
select pg_temp.expect('nobody pays themselves',
  pg_temp.refusal(format('select public.add_trip_settlement(%L, %L, 100)', pg_temp.id('s2'), 'e5000000-0000-4000-8000-000000000001')),
  'bad_settlement');
select pg_temp.expect('nobody pays someone outside the trip',
  pg_temp.refusal(format('select public.add_trip_settlement(%L, %L, 100)', pg_temp.id('s2'), 'e5000000-0000-4000-8000-000000000005')),
  'not_in_trip');
select pg_temp.expect('nobody charges the others for something they did not pay nor share',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, 1000, %L, array[%L, %L]::uuid[])', pg_temp.id('s2'),
    'Jantar', 'refeicao', 'e5000000-0000-4000-8000-000000000002', 'e5000000-0000-4000-8000-000000000002', 'e5000000-0000-4000-8000-000000000003')), 'not_involved');
select pg_temp.expect('a payment of zero is refused',
  pg_temp.refusal(format('select public.add_trip_settlement(%L, %L, 0)', pg_temp.id('s2'), 'e5000000-0000-4000-8000-000000000002')),
  'bad_settlement');
select pg_temp.expect('a negative payment is refused',
  pg_temp.refusal(format('select public.add_trip_settlement(%L, %L, -459)', pg_temp.id('s2'), 'e5000000-0000-4000-8000-000000000002')),
  'bad_settlement');

-- What the payer records counts before it is confirmed, so it is capped at what they owe.
select pg_temp.expect('the payer cannot record more than they owe',
  pg_temp.refusal(format('select public.add_trip_settlement(%L, %L, %s)', pg_temp.id('s2'), 'e5000000-0000-4000-8000-000000000002',
    (select 1 - b.balance_cents from public.trip_balances(pg_temp.id('s2')) as b where b.profile_id = 'e5000000-0000-4000-8000-000000000001'))), 'more_than_owed');
select pg_temp.as_user('e5000000-0000-4000-8000-000000000002');
select pg_temp.expect('someone who owes nothing cannot record a payment',
  pg_temp.refusal(format('select public.add_trip_settlement(%L, %L, 100)', pg_temp.id('s2'), 'e5000000-0000-4000-8000-000000000001')), 'nothing_owed');
select pg_temp.as_user('e5000000-0000-4000-8000-000000000001');

-- A says "I paid B" (waits for B); B says "C paid me" (confirmed at once).
-- A pays exactly what A owes (4,58 € or 4,59 €, depending on who got the beers' leftover cent).
insert into t_ids (key, id) values ('pagou_a', public.add_trip_settlement(pg_temp.id('s2'), 'e5000000-0000-4000-8000-000000000002',
  (select -b.balance_cents from public.trip_balances(pg_temp.id('s2')) as b where b.profile_id = 'e5000000-0000-4000-8000-000000000001')));
select pg_temp.expect('the payer cannot confirm their own payment',
  pg_temp.refusal(format('select public.confirm_trip_settlement(%L)', pg_temp.id('pagou_a'))), 'not_yours');
select pg_temp.as_user('e5000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider cannot confirm',
  pg_temp.refusal(format('select public.confirm_trip_settlement(%L)', pg_temp.id('pagou_a'))), 'not_yours');
select pg_temp.expect('an outsider cannot remove a payment',
  pg_temp.refusal(format('select public.remove_trip_settlement(%L)', pg_temp.id('pagou_a'))), 'not_yours');
select pg_temp.expect('an outsider sees no payments', (select count(*)::integer from public.trip_settlements(pg_temp.id('s2'))), 0);
select pg_temp.as_user('e5000000-0000-4000-8000-000000000004');
select pg_temp.expect('a member not in the payment cannot confirm it',
  pg_temp.refusal(format('select public.confirm_trip_settlement(%L)', pg_temp.id('pagou_a'))), 'not_yours');
select pg_temp.expect('a member not in the payment cannot remove it',
  pg_temp.refusal(format('select public.remove_trip_settlement(%L)', pg_temp.id('pagou_a'))), 'not_yours');
select pg_temp.as_user('e5000000-0000-4000-8000-000000000002');
select public.confirm_trip_settlement(pg_temp.id('pagou_a'));
select pg_temp.expect('a payment is confirmed only once',
  pg_temp.refusal(format('select public.confirm_trip_settlement(%L)', pg_temp.id('pagou_a'))), 'not_yours');
-- The receiver may take back a confirmation only within 10 minutes (acesso_pagamento_desfazer.test.sql covers the
-- window itself): past it, a confirmed payment stays.
reset role;
update public.trip_settlement set confirmed_at = now() - interval '11 minutes' where id = pg_temp.id('pagou_a');
set local role authenticated;
select pg_temp.expect('the receiver cannot undo a payment they confirmed more than 10 minutes ago',
  pg_temp.refusal(format('select public.remove_trip_settlement(%L)', pg_temp.id('pagou_a'))), 'confirmed_settlement');
insert into t_ids (key, id) values ('recebeu_b', public.add_trip_settlement(pg_temp.id('s2'), 'e5000000-0000-4000-8000-000000000002',
  (select -b.balance_cents from public.trip_balances(pg_temp.id('s2')) as b where b.profile_id = 'e5000000-0000-4000-8000-000000000003'),
  'e5000000-0000-4000-8000-000000000003'));

select pg_temp.as_user('e5000000-0000-4000-8000-000000000004');
select pg_temp.expect('every member sees the payments, both confirmed',
  (select string_agg(from_name || '>' || to_name || ':' || confirmed || ':' || mine, ',' order by cents)
   from public.trip_settlements(pg_temp.id('s2'))),
  'Contas A>Contas B:true:false,Contas C>Contas B:true:false');
select pg_temp.expect('the payments are what A and C owed (4,58 € or 4,59 €; 14,58 € or 14,59 €)',
  (select (min(cents) in (458, 459)) and (max(cents) in (1458, 1459)) from public.trip_settlements(pg_temp.id('s2'))), true);
select pg_temp.expect('after paying, only M still owes B',
  (select string_agg(display_name || ':' || balance_cents, ',' order by display_name) from public.trip_balances(pg_temp.id('s2'))),
  'Contas A:0,Contas B:1125,Contas C:0,Contas M:-1125');
select pg_temp.expect('still zero in total', (select sum(balance_cents)::integer from public.trip_balances(pg_temp.id('s2'))), 0);
select pg_temp.expect('my balance on the accounts list is the server''s',
  (select my_balance_cents from public.my_trip_accounts('teste-acesso-contas') where session_id = pg_temp.id('s2')), -1125);

-- Duplicated people share once; an odd amount still adds up.
select pg_temp.as_user('e5000000-0000-4000-8000-000000000001');
insert into t_ids (key, id) values ('petiscos', public.add_trip_expense(pg_temp.id('s2'), 'Petiscos', 'petiscos', 301, null,
  array['e5000000-0000-4000-8000-000000000001', 'e5000000-0000-4000-8000-000000000001', 'e5000000-0000-4000-8000-000000000002']::uuid[]));
select pg_temp.expect('a person named twice shares once',
  (select participants from public.trip_expenses(pg_temp.id('s2')) where id = pg_temp.id('petiscos')), 2);
reset role;
select pg_temp.expect('only the people chosen share the expense',
  (select count(*)::integer from public.trip_expense_share where expense_id = pg_temp.id('petiscos')), 2);
set local role authenticated;
select pg_temp.as_user('e5000000-0000-4000-8000-000000000001');
select pg_temp.expect('after the snacks (3,01 € by two): A +1,50 € or +1,51 €, B owed the rest, and still zero',
  (select string_agg(display_name || ':' || balance_cents, ',' order by display_name) from public.trip_balances(pg_temp.id('s2')))
  || '=' || (select sum(balance_cents) from public.trip_balances(pg_temp.id('s2'))) in (
    'Contas A:150,Contas B:975,Contas C:0,Contas M:-1125=0', 'Contas A:151,Contas B:974,Contas C:0,Contas M:-1125=0'),
  true);
select public.remove_trip_expense(pg_temp.id('petiscos'));

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. People in the accounts.

select pg_temp.as_user('e5000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider cannot add themselves',
  pg_temp.refusal(format('select public.add_trip_person(%L, %L)', pg_temp.id('s2'), 'e5000000-0000-4000-8000-000000000005')),
  'not_member');
select pg_temp.expect('an outsider gets no list of people to add',
  (select count(*)::integer from public.trip_people_to_add(pg_temp.id('s2'))), 0);
select pg_temp.expect('an outsider cannot remove anyone',
  pg_temp.refusal(format('select public.remove_trip_person(%L, %L)', pg_temp.id('s2'), 'e5000000-0000-4000-8000-000000000004')),
  'not_member');
select pg_temp.expect('an outsider cannot rename',
  pg_temp.refusal(format('select public.rename_trip_session(%L, %L)', pg_temp.id('s2'), 'Roubada')), 'not_member');
select pg_temp.expect('an outsider cannot delete the session',
  pg_temp.refusal(format('select public.remove_trip_session(%L)', pg_temp.id('s1'))), 'not_member');

select pg_temp.as_user('e5000000-0000-4000-8000-000000000001');
select pg_temp.expect('a stranger cannot be added',
  pg_temp.refusal(format('select public.add_trip_person(%L, %L)', pg_temp.id('s2'), 'e5000000-0000-4000-8000-000000000005')),
  'cannot_add');
select pg_temp.expect('a friend can be added',
  pg_temp.refusal(format('select public.add_trip_person(%L, %L)', pg_temp.id('s2'), 'e5000000-0000-4000-8000-000000000009')),
  'accepted');
select pg_temp.expect('someone with money in the accounts cannot be removed',
  pg_temp.refusal(format('select public.remove_trip_person(%L, %L)', pg_temp.id('s2'), 'e5000000-0000-4000-8000-000000000003')),
  'has_money');
select pg_temp.expect('a session with money cannot be deleted',
  pg_temp.refusal(format('select public.remove_trip_session(%L)', pg_temp.id('s2'))), 'has_money');
select pg_temp.expect('a name must have 2 to 60 letters',
  pg_temp.refusal(format('select public.rename_trip_session(%L, %L)', pg_temp.id('s2'), ' x ')), 'bad_name');
select public.rename_trip_session(pg_temp.id('s2'), '  Ida ao jogo  ');
select pg_temp.as_user('e5000000-0000-4000-8000-000000000002');
select pg_temp.expect('the new name is for everyone',
  (select name from public.my_trip_accounts('teste-acesso-contas') where session_id = pg_temp.id('s2')), 'Ida ao jogo');
select pg_temp.expect('only who opened the accounts takes someone else out',
  pg_temp.refusal(format('select public.remove_trip_person(%L, %L)', pg_temp.id('s2'), 'e5000000-0000-4000-8000-000000000009')),
  'not_session_owner');
select pg_temp.expect('only who opened the accounts deletes them',
  pg_temp.refusal(format('select public.remove_trip_session(%L)', pg_temp.id('s2'))), 'not_session_owner');
select pg_temp.as_user('e5000000-0000-4000-8000-000000000001');
select public.remove_trip_person(pg_temp.id('s2'), 'e5000000-0000-4000-8000-000000000009');
select pg_temp.as_user('e5000000-0000-4000-8000-000000000009');
select pg_temp.expect('someone taken out no longer sees the accounts',
  (select count(*)::integer from public.trip_expenses(pg_temp.id('s2'))), 0);

select pg_temp.as_user('e5000000-0000-4000-8000-000000000001');
select pg_temp.expect('the last person cannot leave a session',
  pg_temp.refusal(format('select public.remove_trip_person(%L, %L)', pg_temp.id('s1'), 'e5000000-0000-4000-8000-000000000001')),
  'last_person');
select public.remove_trip_session(pg_temp.id('s1'));
select pg_temp.expect('an empty session can be deleted by its people',
  (select count(*)::integer from public.my_trip_accounts('teste-acesso-contas')), 1);

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. The ride's accounts: the car's cost comes from the ride (server), split between who is in the car.

select pg_temp.as_user('e5000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider cannot open the car''s accounts',
  pg_temp.refusal(format('select public.open_ride_trip_session(%L)', pg_temp.id('ride'))), 'not_in_ride');
select pg_temp.expect('an unknown ride is not found',
  pg_temp.refusal(format('select public.open_ride_trip_session(%L)', gen_random_uuid())), 'ride_not_found');
select pg_temp.as_user('e5000000-0000-4000-8000-000000000008');
insert into t_ids (key, id) values ('s3', public.open_ride_trip_session(pg_temp.id('ride')));
select pg_temp.expect('the car''s accounts hold the ride''s total, paid by the driver, split by two',
  (select description || ':' || cents || ':' || payer_name || ':' || participants || ':' || source || ':' || mine
   from public.trip_expenses(pg_temp.id('s3'))),
  'Boleia de Contas D:3001:Contas D:2:boleia:false');
select pg_temp.expect('30,01 € between two: the driver is owed 15,00 € or 15,01 €, the passenger owes it',
  (select string_agg(display_name || ':' || balance_cents, ',' order by display_name) from public.trip_balances(pg_temp.id('s3')))
  in ('Contas D:1500,Contas P:-1500', 'Contas D:1501,Contas P:-1501'), true);
insert into t_ids (key, id) select 'boleia', id from public.trip_expenses(pg_temp.id('s3'));
select pg_temp.expect('the passenger finds the car''s accounts',
  (select total_cents from public.ride_trip_session(pg_temp.id('ride'))), 3001);

select pg_temp.as_user('e5000000-0000-4000-8000-000000000007');
select pg_temp.expect('not even the driver removes the car''s expense',
  pg_temp.refusal(format('select public.remove_trip_expense(%L)', pg_temp.id('boleia'))), 'ride_expense');
select pg_temp.as_user('e5000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider does not find the car''s accounts',
  (select count(*)::integer from public.ride_trip_session(pg_temp.id('ride'))), 0);

-- A third person gets in: the car's expense follows on its own.
select pg_temp.as_user('e5000000-0000-4000-8000-000000000010');
select public.request_ride_seat(pg_temp.id('ride'), true);
select pg_temp.as_user('e5000000-0000-4000-8000-000000000007');
select public.answer_ride_request(pg_temp.id('ride'), 'e5000000-0000-4000-8000-000000000010', true);
select pg_temp.expect('three in the car: 30,01 € = 10,01 + 10,00 + 10,00',
  (select string_agg(display_name, ',' order by display_name) || ' ' || string_agg(owed_cents::text, ',' order by owed_cents)
   from public.trip_balances(pg_temp.id('s3'))),
  'Contas D,Contas P,Contas Q 1000,1000,1001');
select pg_temp.as_user('e5000000-0000-4000-8000-000000000010');
select public.leave_ride(pg_temp.id('ride'));
select pg_temp.as_user('e5000000-0000-4000-8000-000000000007');
select pg_temp.expect('who leaves the car leaves its expense',
  (select string_agg(display_name, ',' order by display_name) || ' ' || string_agg(owed_cents::text, ',' order by owed_cents)
   from public.trip_balances(pg_temp.id('s3')) where owed_cents > 0),
  'Contas D,Contas P 1500,1501');
select pg_temp.expect('the car''s accounts add up to zero', (select sum(balance_cents)::integer from public.trip_balances(pg_temp.id('s3'))), 0);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
