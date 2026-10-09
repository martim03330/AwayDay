-- Tests for taking a bed in the plan's house without asking (join_plan_stay) and who may do it (can_share_house).
--
-- People: O owns the house and group G; A, C and D are in G with a clean record; B is in G with two no-shows in rides
-- (no house without asking for now); H owns a house but is not in G; X is an outsider.
--
-- Plans of G, one per game: "ok" (house of O, 2 spare beds, locked), "aberta" (house not locked yet), "cancelado",
-- "alheia" (the locked house is H's, who is not in the plan) and "acabou" (the game already kicked off).
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_planos_casa_entrar.test.sql

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
  select p_id, f.competition_id, f.stage, f.home_club_id, f.away_club_id, f.venue_id, p_kickoff
  from public.fixture as f order by f.id limit 1;
$$;

-- A plan of G for a game, with a house (of p_owner, p_spare beds), locked or not.
create function pg_temp.make_plan(p_key text, p_fixture text, p_owner uuid, p_spare integer, p_locked boolean)
returns void
language plpgsql
as $$
begin
  insert into t_ids (key, id) values (p_key, gen_random_uuid()), (p_key || '_casa', gen_random_uuid());
  insert into public.stay_plan (id, fixture_id, profile_id, nights, commitment, spare_places, total_cents, visibility)
  values (pg_temp.id(p_key || '_casa'), p_fixture, p_owner, 1, 'certo', p_spare, 20000, 'publica');
  insert into public.fixture_plan (id, group_id, fixture_id, created_by, stay_plan_id, stay_locked_at)
  values (pg_temp.id(p_key), 'e9300000-0000-4000-8000-0000000000a1', p_fixture, 'e9300000-0000-4000-8000-000000000001',
    pg_temp.id(p_key || '_casa'), case when p_locked then now() end);
end;
$$;

create function pg_temp.beds(p_key text)
returns integer
language sql
as $$
  select count(*)::integer from public.stay_place where plan_id = pg_temp.id(p_key || '_casa') and status = 'aceite';
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('e9300000-0000-4000-8000-000000000001', 'cama-o@test.invalid', '{"display_name":"Cama O"}', 'authenticated', 'authenticated'),
  ('e9300000-0000-4000-8000-000000000002', 'cama-a@test.invalid', '{"display_name":"Cama A"}', 'authenticated', 'authenticated'),
  ('e9300000-0000-4000-8000-000000000003', 'cama-b@test.invalid', '{"display_name":"Cama B"}', 'authenticated', 'authenticated'),
  ('e9300000-0000-4000-8000-000000000004', 'cama-c@test.invalid', '{"display_name":"Cama C"}', 'authenticated', 'authenticated'),
  ('e9300000-0000-4000-8000-000000000005', 'cama-d@test.invalid', '{"display_name":"Cama D"}', 'authenticated', 'authenticated'),
  ('e9300000-0000-4000-8000-000000000006', 'cama-h@test.invalid', '{"display_name":"Cama H"}', 'authenticated', 'authenticated'),
  ('e9300000-0000-4000-8000-000000000007', 'cama-x@test.invalid', '{"display_name":"Cama X"}', 'authenticated', 'authenticated');

insert into public.fan_group (id, name, created_by, invite_code)
values ('e9300000-0000-4000-8000-0000000000a1', 'Malta Cama', 'e9300000-0000-4000-8000-000000000001', 'tcamaj0001');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('e9300000-0000-4000-8000-0000000000a1', 'e9300000-0000-4000-8000-000000000001', 'owner'),
  ('e9300000-0000-4000-8000-0000000000a1', 'e9300000-0000-4000-8000-000000000002', 'member'),
  ('e9300000-0000-4000-8000-0000000000a1', 'e9300000-0000-4000-8000-000000000003', 'member'),
  ('e9300000-0000-4000-8000-0000000000a1', 'e9300000-0000-4000-8000-000000000004', 'member'),
  ('e9300000-0000-4000-8000-0000000000a1', 'e9300000-0000-4000-8000-000000000005', 'member');

select pg_temp.make_fixture('teste-cama-ok', now() + interval '6 days');
select pg_temp.make_fixture('teste-cama-aberta', now() + interval '6 days');
select pg_temp.make_fixture('teste-cama-cancelado', now() + interval '6 days');
select pg_temp.make_fixture('teste-cama-alheia', now() + interval '6 days');
select pg_temp.make_fixture('teste-cama-acabou', now() - interval '1 hour');

select pg_temp.make_plan('ok', 'teste-cama-ok', 'e9300000-0000-4000-8000-000000000001', 2, true);
select pg_temp.make_plan('aberta', 'teste-cama-aberta', 'e9300000-0000-4000-8000-000000000001', 2, false);
select pg_temp.make_plan('cancelado', 'teste-cama-cancelado', 'e9300000-0000-4000-8000-000000000001', 2, true);
update public.fixture_plan set status = 'cancelado' where id = pg_temp.id('cancelado');
select pg_temp.make_plan('alheia', 'teste-cama-alheia', 'e9300000-0000-4000-8000-000000000006', 2, true);
select pg_temp.make_plan('acabou', 'teste-cama-acabou', 'e9300000-0000-4000-8000-000000000001', 2, true);

-- A already said "talvez" to the plan: taking a bed turns it into "vou".
insert into public.fixture_plan_answer (plan_id, profile_id, answer)
values (pg_temp.id('ok'), 'e9300000-0000-4000-8000-000000000002', 'talvez');

-- B missed two rides as a passenger in the last months.
insert into t_ids (key, id) values ('r1', gen_random_uuid()), ('r2', gen_random_uuid());
insert into public.ride (
  id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
  total_cents, visibility
)
select r.id, r.fixture_id, 'e9300000-0000-4000-8000-000000000001', 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)',
  now() + interval '6 days' - interval '3 hours', 3, 'rapida', false, 100000, 3600, 20000, 600, 1700, 2400, 600, 3000,
  'publica'
from (values (pg_temp.id('r1'), 'teste-cama-ok'), (pg_temp.id('r2'), 'teste-cama-aberta')) as r(id, fixture_id);
insert into public.ride_outcome (ride_id, profile_id, role, outcome, created_at)
values
  (pg_temp.id('r1'), 'e9300000-0000-4000-8000-000000000003', 'passenger', 'no_show', now() - interval '10 days'),
  (pg_temp.id('r2'), 'e9300000-0000-4000-8000-000000000003', 'passenger', 'no_show', now() - interval '5 days');

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Who may share a house.

set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon cannot ask who may share a house',
  pg_temp.refusal('select public.can_share_house(''e9300000-0000-4000-8000-000000000002'')'),
  'permission denied for function can_share_house');
select pg_temp.expect('anon cannot take a bed',
  pg_temp.refusal(format('select public.join_plan_stay(%L)', pg_temp.id('ok'))),
  'permission denied for function join_plan_stay');

set local role authenticated;
select pg_temp.as_user('e9300000-0000-4000-8000-000000000002');
select pg_temp.expect('nobody can ask whether someone else may share a house (it would tell who is suspended)',
  pg_temp.refusal('select public.can_share_house(''e9300000-0000-4000-8000-000000000003'')'),
  'permission denied for function can_share_house');
select pg_temp.expect('a clean record may share a house',
  public.i_can_share_house(), true);
select pg_temp.as_user('e9300000-0000-4000-8000-000000000003');
select pg_temp.expect('two no-shows in the last months may not',
  public.i_can_share_house(), false);
select pg_temp.as_user('e9300000-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. One refusal per rule.

select pg_temp.as_user('e9300000-0000-4000-8000-000000000007');
select pg_temp.expect('an outsider does not find the plan',
  pg_temp.refusal(format('select public.join_plan_stay(%L)', pg_temp.id('ok'))), 'plan_not_found');
select pg_temp.as_user('e9300000-0000-4000-8000-000000000002');
select pg_temp.expect('an unknown plan is not found',
  pg_temp.refusal(format('select public.join_plan_stay(%L)', gen_random_uuid())), 'plan_not_found');
select pg_temp.expect('a cancelled plan is closed',
  pg_temp.refusal(format('select public.join_plan_stay(%L)', pg_temp.id('cancelado'))), 'plan_closed');
select pg_temp.expect('a house not locked yet takes no one without asking',
  pg_temp.refusal(format('select public.join_plan_stay(%L)', pg_temp.id('aberta'))), 'stay_not_locked');
select pg_temp.expect('the house of someone outside the plan takes no one without asking',
  pg_temp.refusal(format('select public.join_plan_stay(%L)', pg_temp.id('alheia'))), 'owner_not_in_plan');
select pg_temp.expect('after kickoff the plan does not change',
  pg_temp.refusal(format('select public.join_plan_stay(%L)', pg_temp.id('acabou'))), 'fixture_over');
reset role;
select pg_temp.expect('a refused call leaves no bed behind',
  pg_temp.beds('alheia') + pg_temp.beds('acabou') + pg_temp.beds('aberta') + pg_temp.beds('cancelado'), 0);
set local role authenticated;

select pg_temp.as_user('e9300000-0000-4000-8000-000000000003');
select pg_temp.expect('someone who missed rides needs history first',
  pg_temp.refusal(format('select public.join_plan_stay(%L)', pg_temp.id('ok'))), 'needs_history');

select pg_temp.as_user('e9300000-0000-4000-8000-000000000001');
select pg_temp.expect('the owner does not take a bed in their own house',
  pg_temp.refusal(format('select public.join_plan_stay(%L)', pg_temp.id('ok'))), 'own_house');

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Taking a bed, twice, and filling the house.

select pg_temp.as_user('e9300000-0000-4000-8000-000000000002');
select pg_temp.expect('A takes a bed',
  pg_temp.refusal(format('select public.join_plan_stay(%L)', pg_temp.id('ok'))), 'accepted');
select pg_temp.expect('taking it again is harmless',
  pg_temp.refusal(format('select public.join_plan_stay(%L)', pg_temp.id('ok'))), 'accepted');
reset role;
select pg_temp.expect('A has one bed, accepted',
  (select count(*)::integer || ':' || min(status) from public.stay_place
   where plan_id = pg_temp.id('ok_casa') and profile_id = 'e9300000-0000-4000-8000-000000000002'), '1:aceite');
select pg_temp.expect('A''s answer became "vou"',
  (select answer from public.fixture_plan_answer
   where plan_id = pg_temp.id('ok') and profile_id = 'e9300000-0000-4000-8000-000000000002'), 'vou');

set local role authenticated;
select pg_temp.as_user('e9300000-0000-4000-8000-000000000004');
select pg_temp.expect('C takes the last spare bed',
  pg_temp.refusal(format('select public.join_plan_stay(%L)', pg_temp.id('ok'))), 'accepted');
select pg_temp.as_user('e9300000-0000-4000-8000-000000000005');
select pg_temp.expect('with every spare bed taken the house is full',
  pg_temp.refusal(format('select public.join_plan_stay(%L)', pg_temp.id('ok'))), 'house_full');
select pg_temp.as_user('e9300000-0000-4000-8000-000000000002');
select pg_temp.expect('who already has a bed still gets through when the house is full',
  pg_temp.refusal(format('select public.join_plan_stay(%L)', pg_temp.id('ok'))), 'accepted');
reset role;
select pg_temp.expect('exactly the spare beds are taken, no more',
  pg_temp.beds('ok'), 2);
select pg_temp.expect('D got no answer written',
  (select count(*)::integer from public.fixture_plan_answer
   where plan_id = pg_temp.id('ok') and profile_id = 'e9300000-0000-4000-8000-000000000005'), 0);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
