-- Access tests for read RPCs that had none: group_trips, group_plans, my_trip_history, my_live_trips,
-- my_open_trip_sessions, trip_start_options, my_approved_place_photo_count, report_profile_photo,
-- nearest_municipality_name, and the AI spend ledger (ai_usage_ledger / ai_usage_since).
--
-- People: M is in group G, drives a ride today and one two days ago, has a house for today's game, and is in G's
-- accounts for both games; E was in G, its accounts and M's ride, and left all three; K is still in G (no photo);
-- X is an outsider.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_leituras.test.sql

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

-- How many rows a set-returning call gives the current role (or its refusal).
create function pg_temp.rows(p_sql text)
returns text
language plpgsql
as $$
declare
  n integer;
begin
  execute format('select count(*)::integer from (%s) as linhas', p_sql) into n;
  return n::text;
exception when others then
  return sqlerrm;
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

create function pg_temp.make_ride(p_id uuid, p_fixture text, p_driver uuid)
returns void
language sql
as $$
  insert into public.ride (
    id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
    distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
    total_cents, group_id, visibility
  )
  select p_id, f.id, p_driver, 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)', f.kickoff_at - interval '3 hours',
    3, 'rapida', false, 100000, 3600, 20000, 600, 1700, 2400, 600, 3000,
    'e9400000-0000-4000-8000-0000000000a1', 'grupo'
  from public.fixture as f
  where f.id = p_fixture;
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('e9400000-0000-4000-8000-000000000001', 'leit-m@test.invalid', '{"display_name":"Leituras M"}', 'authenticated', 'authenticated'),
  ('e9400000-0000-4000-8000-000000000002', 'leit-e@test.invalid', '{"display_name":"Leituras E"}', 'authenticated', 'authenticated'),
  ('e9400000-0000-4000-8000-000000000003', 'leit-k@test.invalid', '{"display_name":"Leituras K"}', 'authenticated', 'authenticated'),
  ('e9400000-0000-4000-8000-000000000004', 'leit-x@test.invalid', '{"display_name":"Leituras X"}', 'authenticated', 'authenticated');
update public.profile set avatar_path = 'e9400000-0000-4000-8000-000000000001/cara.jpg'
where id = 'e9400000-0000-4000-8000-000000000001';
update public.profile set avatar_path = 'e9400000-0000-4000-8000-000000000002/cara.jpg'
where id = 'e9400000-0000-4000-8000-000000000002';

insert into public.fan_group (id, name, created_by, invite_code)
values ('e9400000-0000-4000-8000-0000000000a1', 'Malta Leituras', 'e9400000-0000-4000-8000-000000000001', 'tleit00001');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('e9400000-0000-4000-8000-0000000000a1', 'e9400000-0000-4000-8000-000000000001', 'owner'),
  ('e9400000-0000-4000-8000-0000000000a1', 'e9400000-0000-4000-8000-000000000002', 'member'),
  ('e9400000-0000-4000-8000-0000000000a1', 'e9400000-0000-4000-8000-000000000003', 'member');

-- Today's game (kicks off in an hour: the ride is live), one two days ago, and one next week.
select pg_temp.make_fixture('teste-leituras-hoje', now() + interval '1 hour');
select pg_temp.make_fixture('teste-leituras-passado', now() - interval '2 days');
select pg_temp.make_fixture('teste-leituras-semana', now() + interval '6 days');

insert into t_ids (key, id)
values ('ride_hoje', gen_random_uuid()), ('ride_passado', gen_random_uuid()), ('casa', gen_random_uuid()),
  ('s_hoje', gen_random_uuid()), ('s_passado', gen_random_uuid()), ('despesa', gen_random_uuid());
select pg_temp.make_ride(pg_temp.id('ride_hoje'), 'teste-leituras-hoje', 'e9400000-0000-4000-8000-000000000001');
select pg_temp.make_ride(pg_temp.id('ride_passado'), 'teste-leituras-passado', 'e9400000-0000-4000-8000-000000000001');
insert into public.ride_passenger (ride_id, profile_id, status)
values (pg_temp.id('ride_hoje'), 'e9400000-0000-4000-8000-000000000002', 'left');
insert into public.stay_plan (id, fixture_id, profile_id, nights, commitment, spare_places, total_cents, group_id, visibility)
values (pg_temp.id('casa'), 'teste-leituras-hoje', 'e9400000-0000-4000-8000-000000000001', 1, 'certo', 2, 20000,
  'e9400000-0000-4000-8000-0000000000a1', 'grupo');

insert into public.trip_session (id, group_id, fixture_id, opened_by)
values
  (pg_temp.id('s_hoje'), 'e9400000-0000-4000-8000-0000000000a1', 'teste-leituras-hoje', 'e9400000-0000-4000-8000-000000000001'),
  (pg_temp.id('s_passado'), 'e9400000-0000-4000-8000-0000000000a1', 'teste-leituras-passado', 'e9400000-0000-4000-8000-000000000001');
insert into public.trip_session_member (session_id, profile_id)
values
  (pg_temp.id('s_hoje'), 'e9400000-0000-4000-8000-000000000001'),
  (pg_temp.id('s_hoje'), 'e9400000-0000-4000-8000-000000000002'),
  (pg_temp.id('s_passado'), 'e9400000-0000-4000-8000-000000000001'),
  (pg_temp.id('s_passado'), 'e9400000-0000-4000-8000-000000000002');
insert into public.trip_expense (id, session_id, payer_id, description, category, cents, created_by)
values (pg_temp.id('despesa'), pg_temp.id('s_passado'), 'e9400000-0000-4000-8000-000000000001', 'Bifanas', 'petiscos',
  1200, 'e9400000-0000-4000-8000-000000000001');
insert into public.trip_expense_share (expense_id, profile_id)
values (pg_temp.id('despesa'), 'e9400000-0000-4000-8000-000000000001');

-- E leaves: the group and both accounts.
delete from public.trip_session_member where profile_id = 'e9400000-0000-4000-8000-000000000002';
delete from public.fan_group_member where profile_id = 'e9400000-0000-4000-8000-000000000002';

-- A tasco photo of M approved, one waiting.
insert into public.place_photo (place_id, storage_path, status, submitted_by)
select p.id, 'teste-leituras/' || s.n || '.jpg', s.status, 'e9400000-0000-4000-8000-000000000001'
from (select id from public.place order by id limit 1) as p
cross join (values (1, 'approved'), (2, 'pending')) as s(n, status);

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Anonymous: none of these.

set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon: group_trips', pg_temp.rows('select * from public.group_trips(''e9400000-0000-4000-8000-0000000000a1'')'),
  'permission denied for function group_trips');
select pg_temp.expect('anon: group_plans', pg_temp.rows('select * from public.group_plans(''e9400000-0000-4000-8000-0000000000a1'')'),
  'permission denied for function group_plans');
select pg_temp.expect('anon: my_trip_history', pg_temp.rows('select * from public.my_trip_history()'),
  'permission denied for function my_trip_history');
select pg_temp.expect('anon: my_live_trips', pg_temp.rows('select * from public.my_live_trips()'),
  'permission denied for function my_live_trips');
select pg_temp.expect('anon: my_open_trip_sessions', pg_temp.rows('select * from public.my_open_trip_sessions()'),
  'permission denied for function my_open_trip_sessions');
select pg_temp.expect('anon: trip_start_options', pg_temp.rows('select * from public.trip_start_options(''teste-leituras-semana'')'),
  'permission denied for function trip_start_options');
select pg_temp.expect('anon: my_approved_place_photo_count', pg_temp.refusal('select public.my_approved_place_photo_count()'),
  'permission denied for function my_approved_place_photo_count');
select pg_temp.expect('anon: report_profile_photo',
  pg_temp.refusal('select public.report_profile_photo(''e9400000-0000-4000-8000-000000000001'')'),
  'permission denied for function report_profile_photo');
select pg_temp.expect('anon: nearest_municipality_name', pg_temp.refusal('select public.nearest_municipality_name(40.2, -8.42)'),
  'permission denied for function nearest_municipality_name');
select pg_temp.expect('anon: no ai_usage_ledger', pg_temp.refusal('select count(*) from public.ai_usage_ledger'),
  'permission denied for table ai_usage_ledger');

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. The member sees their things.

set local role authenticated;
select pg_temp.as_user('e9400000-0000-4000-8000-000000000001');
select pg_temp.expect('member: the group''s trips, one per game',
  pg_temp.rows('select * from public.group_trips(''e9400000-0000-4000-8000-0000000000a1'')'), '2');
select pg_temp.expect('member: the group''s plans still to come (a ride and a house)',
  pg_temp.rows('select * from public.group_plans(''e9400000-0000-4000-8000-0000000000a1'')'), '2');
select pg_temp.expect('member: history has the game that was played, with its expense',
  (select fixture_id || ':' || expenses || ':' || total_cents from public.my_trip_history()), 'teste-leituras-passado:1:1200');
select pg_temp.expect('member: today''s ride is live',
  (select string_agg(fixture_id || ':' || people, ',') from public.my_live_trips()), 'teste-leituras-hoje:1');
select pg_temp.expect('member: both accounts are open',
  pg_temp.rows('select * from public.my_open_trip_sessions()'), '2');
select pg_temp.expect('member: next week the group can open accounts',
  (select string_agg(kind || ':' || title, ',') from public.trip_start_options('teste-leituras-semana')), 'grupo:Malta Leituras');
select pg_temp.expect('member: one approved tasco photo (the one waiting does not count)',
  public.my_approved_place_photo_count(), 1);
select pg_temp.expect('authenticated: nearest_municipality_name is server-only',
  pg_temp.refusal('select public.nearest_municipality_name(40.2, -8.42)'),
  'permission denied for function nearest_municipality_name');
select pg_temp.expect('authenticated: no ai_usage_ledger', pg_temp.refusal('select count(*) from public.ai_usage_ledger'),
  'permission denied for table ai_usage_ledger');

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Who left, and who was never in, see nothing.

select pg_temp.as_user('e9400000-0000-4000-8000-000000000002');
select pg_temp.expect('ex-member: no group trips',
  pg_temp.rows('select * from public.group_trips(''e9400000-0000-4000-8000-0000000000a1'')'), '0');
select pg_temp.expect('ex-member: no group plans',
  pg_temp.rows('select * from public.group_plans(''e9400000-0000-4000-8000-0000000000a1'')'), '0');
select pg_temp.expect('ex-member: no history', pg_temp.rows('select * from public.my_trip_history()'), '0');
select pg_temp.expect('ex-passenger: no live ride', pg_temp.rows('select * from public.my_live_trips()'), '0');
select pg_temp.expect('ex-member: no open accounts', pg_temp.rows('select * from public.my_open_trip_sessions()'), '0');
select pg_temp.expect('ex-member: no group to start accounts with',
  pg_temp.rows('select * from public.trip_start_options(''teste-leituras-semana'')'), '0');

select pg_temp.as_user('e9400000-0000-4000-8000-000000000004');
select pg_temp.expect('outsider: no group trips',
  pg_temp.rows('select * from public.group_trips(''e9400000-0000-4000-8000-0000000000a1'')'), '0');
select pg_temp.expect('outsider: no group plans',
  pg_temp.rows('select * from public.group_plans(''e9400000-0000-4000-8000-0000000000a1'')'), '0');
select pg_temp.expect('outsider: no history', pg_temp.rows('select * from public.my_trip_history()'), '0');
select pg_temp.expect('outsider: no live ride', pg_temp.rows('select * from public.my_live_trips()'), '0');
select pg_temp.expect('outsider: no open accounts', pg_temp.rows('select * from public.my_open_trip_sessions()'), '0');
select pg_temp.expect('outsider: nothing to start accounts with',
  pg_temp.rows('select * from public.trip_start_options(''teste-leituras-semana'')'), '0');
select pg_temp.expect('outsider: only their own approved photos count', public.my_approved_place_photo_count(), 0);

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Reporting a profile photo.

select pg_temp.as_user('e9400000-0000-4000-8000-000000000001');
select pg_temp.expect('nobody reports their own photo',
  pg_temp.refusal('select public.report_profile_photo(''e9400000-0000-4000-8000-000000000001'')'), 'own_content');
select pg_temp.expect('someone without a photo cannot have it reported',
  pg_temp.refusal('select public.report_profile_photo(''e9400000-0000-4000-8000-000000000003'')'), 'no_photo');
select pg_temp.as_user('e9400000-0000-4000-8000-000000000004');
select pg_temp.expect('a profile the reporter cannot see is not found',
  pg_temp.refusal('select public.report_profile_photo(''e9400000-0000-4000-8000-000000000002'')'), 'not_found');
-- M drives an open ride, so anyone can see M's profile (and report its photo).
select pg_temp.expect('reporting a visible photo works',
  pg_temp.refusal('select public.report_profile_photo(''e9400000-0000-4000-8000-000000000001'', ''Foto ofensiva'')'), 'accepted');
select pg_temp.expect('reporting it again is not refused',
  pg_temp.refusal('select public.report_profile_photo(''e9400000-0000-4000-8000-000000000001'')'), 'accepted');
reset role;
select pg_temp.expect('a second report of the same photo is not a duplicate: one pending report',
  (select count(*)::integer || ':' || min(reason) from public.content_report
   where reporter_id = 'e9400000-0000-4000-8000-000000000004' and kind = 'profile_photo'
     and target_id = 'e9400000-0000-4000-8000-000000000001' and status = 'pendente'), '1:outro');
select pg_temp.expect('the report keeps a copy of what was reported',
  (select content_snapshot from public.content_report
   where reporter_id = 'e9400000-0000-4000-8000-000000000004' and kind = 'profile_photo'),
  'e9400000-0000-4000-8000-000000000001/cara.jpg');

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. AI spend: deleting what was generated does not give the month's budget back.

reset role;
create temporary table t_gasto (fase text primary key, entrada bigint, saida bigint, mensagens bigint) on commit drop;
insert into t_gasto
select 'antes', u.nudge_input_tokens, u.nudge_output_tokens, u.profile_model_messages
from public.ai_usage_since(date_trunc('month', now()), 'e9400000-0000-4000-8000-000000000001') as u;

insert into t_ids (key, id) values ('nudge', gen_random_uuid());
insert into public.nudge (id, profile_id, kind, local_date, facts, body, source, model, input_tokens, output_tokens)
values (pg_temp.id('nudge'), 'e9400000-0000-4000-8000-000000000001', 'estadio_novo', current_date, '{}', 'Estádio novo!',
  'model', 'teste', 1000, 200);
insert into t_gasto
select 'depois', u.nudge_input_tokens, u.nudge_output_tokens, u.profile_model_messages
from public.ai_usage_since(date_trunc('month', now()), 'e9400000-0000-4000-8000-000000000001') as u;
select pg_temp.expect('a generated nudge adds to the month''s spend',
  (select (d.entrada - a.entrada) || '/' || (d.saida - a.saida) || '/' || (d.mensagens - a.mensagens)
   from t_gasto as a, t_gasto as d where a.fase = 'antes' and d.fase = 'depois'), '1000/200/1');

delete from public.nudge where id = pg_temp.id('nudge');
select pg_temp.expect('the nudge is gone', (select count(*)::integer from public.nudge where id = pg_temp.id('nudge')), 0);
select pg_temp.expect('deleting it does not lower the spend nor the person''s count',
  (select u.nudge_input_tokens || '/' || u.nudge_output_tokens || '/' || u.profile_model_messages
   from public.ai_usage_since(date_trunc('month', now()), 'e9400000-0000-4000-8000-000000000001') as u),
  (select entrada || '/' || saida || '/' || mensagens from t_gasto where fase = 'depois'));

reset role;
select count(*) as checks_passed from expect_log;

rollback;
