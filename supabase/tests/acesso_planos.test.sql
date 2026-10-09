-- Access tests for game plans: fixture_plan, fixture_plan_answer, fixture_plan_group, fixture_plan_house_vote.
-- (One invite per game per group is in one_invite.test.sql.)
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_planos.test.sql
--
-- People: O creates the plan in group G1; M is in G1 (drives a car, and owns G3); H is in G1 and offers a house
-- only to G1; S is in G2, where the plan is shared; X is an outsider; D is an admin.

begin;

create temporary table expect_log (name text) on commit drop;
create temporary table t_ids (key text primary key, id uuid, txt text) on commit drop;
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

create function pg_temp.jogo()
returns text
language sql
as $$
  select txt from t_ids where key = 'jogo';
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

-- How many of the plan's summaries I get (0 when I can't see it).
create function pg_temp.sees_plan()
returns integer
language sql
as $$
  select count(*)::integer from public.fixture_plan_summaries(array[pg_temp.id('p1')]);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('ad000007-0000-4000-8000-0000000000a1', 'acesso-planos-o@test.invalid', '{"display_name":"Plano Dono"}', 'authenticated', 'authenticated'),
  ('ad000007-0000-4000-8000-0000000000b1', 'acesso-planos-m@test.invalid', '{"display_name":"Plano Membro"}', 'authenticated', 'authenticated'),
  ('ad000007-0000-4000-8000-0000000000c1', 'acesso-planos-h@test.invalid', '{"display_name":"Plano Casa"}', 'authenticated', 'authenticated'),
  ('ad000007-0000-4000-8000-000000000051', 'acesso-planos-s@test.invalid', '{"display_name":"Plano Outro Grupo"}', 'authenticated', 'authenticated'),
  ('ad000007-0000-4000-8000-0000000000e1', 'acesso-planos-x@test.invalid', '{"display_name":"Plano Fora"}', 'authenticated', 'authenticated'),
  ('ad000007-0000-4000-8000-0000000000d1', 'acesso-planos-d@test.invalid', '{"display_name":"Plano Admin"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'ad000007-0000-4000-8000-0000000000d1';

insert into public.fan_group (id, name, created_by, invite_code)
values
  ('c0000007-0000-4000-8000-0000000000a1', 'Grupo Plano Um', 'ad000007-0000-4000-8000-0000000000a1', 'acplanos01'),
  ('c0000007-0000-4000-8000-0000000000a2', 'Grupo Plano Dois', 'ad000007-0000-4000-8000-000000000051', 'acplanos02'),
  ('c0000007-0000-4000-8000-0000000000a3', 'Grupo Plano Tres', 'ad000007-0000-4000-8000-0000000000b1', 'acplanos03');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('c0000007-0000-4000-8000-0000000000a1', 'ad000007-0000-4000-8000-0000000000a1', 'owner'),
  ('c0000007-0000-4000-8000-0000000000a1', 'ad000007-0000-4000-8000-0000000000b1', 'member'),
  ('c0000007-0000-4000-8000-0000000000a1', 'ad000007-0000-4000-8000-0000000000c1', 'member'),
  ('c0000007-0000-4000-8000-0000000000a2', 'ad000007-0000-4000-8000-000000000051', 'owner'),
  ('c0000007-0000-4000-8000-0000000000a2', 'ad000007-0000-4000-8000-0000000000a1', 'member'),
  ('c0000007-0000-4000-8000-0000000000a3', 'ad000007-0000-4000-8000-0000000000b1', 'owner');

-- A game still to be played, one already played.
insert into t_ids (key, txt)
select 'jogo', f.id from public.fixture as f where f.kickoff_at > now() + interval '2 days' order by f.kickoff_at limit 1;
insert into t_ids (key, txt)
select 'passado', f.id from public.fixture as f where f.kickoff_at < now() - interval '1 day' order by f.kickoff_at desc limit 1;
select pg_temp.expect('there are games', (select count(*)::integer from t_ids where txt is not null), 2);

-- M drives to that game; H offers a house only to G1; X offers a public house nobody in the plan is part of.
insert into t_ids (key, id) values ('ride', gen_random_uuid()), ('casa', gen_random_uuid()), ('casa_x', gen_random_uuid());
insert into public.ride (
  id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
  total_cents
)
select
  pg_temp.id('ride'), f.id, 'ad000007-0000-4000-8000-0000000000b1', 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)',
  f.kickoff_at - interval '3 hours', 3, 'rapida', false, 100000, 3600, 0, 600, 1700, 1020, 0, 1020
from public.fixture as f where f.id = pg_temp.jogo();
insert into public.stay_plan (id, fixture_id, profile_id, nights, commitment, spare_places, total_cents, group_id, visibility)
values
  (pg_temp.id('casa'), pg_temp.jogo(), 'ad000007-0000-4000-8000-0000000000c1', 1, 'certo', 3, 12000,
   'c0000007-0000-4000-8000-0000000000a1', 'grupo'),
  (pg_temp.id('casa_x'), pg_temp.jogo(), 'ad000007-0000-4000-8000-0000000000e1', 1, 'certo', 3, 9000, null, 'publica');

-- 1. Anon.
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon cannot read plans', pg_temp.refusal('select count(*) from public.fixture_plan'), 'permission denied for table fixture_plan');
select pg_temp.expect('anon cannot read answers', pg_temp.refusal('select count(*) from public.fixture_plan_answer'), 'permission denied for table fixture_plan_answer');
select pg_temp.expect('anon cannot read shares', pg_temp.refusal('select count(*) from public.fixture_plan_group'), 'permission denied for table fixture_plan_group');
select pg_temp.expect('anon cannot read house votes', pg_temp.refusal('select count(*) from public.fixture_plan_house_vote'), 'permission denied for table fixture_plan_house_vote');
select pg_temp.expect('anon cannot invite to a game',
  pg_temp.refusal(format('select public.invite_group_to_fixture(%L, %L)', 'c0000007-0000-4000-8000-0000000000a1', pg_temp.jogo())),
  'permission denied for function invite_group_to_fixture');
select pg_temp.expect('anon cannot read summaries',
  pg_temp.refusal('select count(*) from public.fixture_plan_summaries(array[gen_random_uuid()])'), 'permission denied for function fixture_plan_summaries');
select pg_temp.expect('anon cannot answer',
  pg_temp.refusal(format('select public.answer_fixture_plan(%L, %L)', gen_random_uuid(), 'vou')), 'permission denied for function answer_fixture_plan');

-- 2. Creating a plan.
set local role authenticated;
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000e1');
select pg_temp.expect('an outsider cannot invite a group',
  pg_temp.refusal(format('select public.invite_group_to_fixture(%L, %L)', 'c0000007-0000-4000-8000-0000000000a1', pg_temp.jogo())), 'not_member');
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000a1');
select pg_temp.expect('plans are not written directly',
  pg_temp.refusal(format('insert into public.fixture_plan (group_id, fixture_id, created_by) values (%L, %L, %L)',
    'c0000007-0000-4000-8000-0000000000a1', pg_temp.jogo(), 'ad000007-0000-4000-8000-0000000000a1')),
  'permission denied for table fixture_plan');
select pg_temp.expect('a game that does not exist is refused',
  pg_temp.refusal(format('select public.invite_group_to_fixture(%L, %L)', 'c0000007-0000-4000-8000-0000000000a1', 'nao-existe')), 'fixture_not_found');
select pg_temp.expect('a game already played is refused',
  pg_temp.refusal(format('select public.invite_group_to_fixture(%L, %L)', 'c0000007-0000-4000-8000-0000000000a1', (select txt from t_ids where key = 'passado'))),
  'fixture_over');
update t_ids set id = public.invite_group_to_fixture('c0000007-0000-4000-8000-0000000000a1', pg_temp.jogo()) where key = 'jogo';
insert into t_ids (key, id) select 'p1', id from t_ids where key = 'jogo';
select pg_temp.expect('the creator is going',
  (select going || ':' || my_answer || ':' || is_mine from public.fixture_plan_summaries(array[pg_temp.id('p1')])), '1:vou:true');

-- 3. Who sees the plan.
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000b1');
select pg_temp.expect('a member sees it', pg_temp.sees_plan(), 1);
select pg_temp.expect('a member finds it in the group',
  (select count(*)::integer from public.group_fixture_plans('c0000007-0000-4000-8000-0000000000a1') as p where p = pg_temp.id('p1')), 1);
select pg_temp.as_user('ad000007-0000-4000-8000-000000000051');
select pg_temp.expect('the other group does not see it yet', pg_temp.sees_plan(), 0);
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000e1');
select pg_temp.expect('X does not see it', pg_temp.sees_plan(), 0);
select pg_temp.expect('X does not see who goes', (select count(*)::integer from public.fixture_plan_people(pg_temp.id('p1'))), 0);
select pg_temp.expect('X does not see the houses', (select count(*)::integer from public.fixture_plan_houses(pg_temp.id('p1'))), 0);
select pg_temp.expect('X does not list G1''s plans',
  (select count(*)::integer from public.group_fixture_plans('c0000007-0000-4000-8000-0000000000a1')), 0);
select pg_temp.expect('X cannot answer', pg_temp.refusal(format('select public.answer_fixture_plan(%L, %L)', pg_temp.id('p1'), 'vou')), 'plan_not_found');
select pg_temp.expect('X cannot vote a house', pg_temp.refusal(format('select public.vote_fixture_plan_house(%L, %L)', pg_temp.id('p1'), pg_temp.id('casa'))), 'plan_not_found');
select pg_temp.expect('X cannot close it', pg_temp.refusal(format('select public.set_fixture_plan_status(%L, %L)', pg_temp.id('p1'), 'fechado')), 'plan_not_found');
select pg_temp.expect('X cannot attach a ride', pg_temp.refusal(format('select public.set_fixture_plan_ride(%L, %L)', pg_temp.id('p1'), pg_temp.id('ride'))), 'plan_not_found');
select pg_temp.expect('X cannot attach their own house', pg_temp.refusal(format('select public.set_fixture_plan_stay(%L, %L)', pg_temp.id('p1'), pg_temp.id('casa_x'))), 'plan_not_found');
select pg_temp.expect('X cannot lock the house', pg_temp.refusal(format('select public.set_plan_stay_locked(%L, true)', pg_temp.id('p1'))), 'plan_not_found');
select pg_temp.expect('X cannot share it', pg_temp.refusal(format('select public.share_fixture_plan(%L, %L)', pg_temp.id('p1'), 'c0000007-0000-4000-8000-0000000000a2')), 'plan_not_found');
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000d1');
select pg_temp.expect('the admin does not see it', pg_temp.sees_plan(), 0);
select pg_temp.expect('the admin cannot answer', pg_temp.refusal(format('select public.answer_fixture_plan(%L, %L)', pg_temp.id('p1'), 'vou')), 'plan_not_found');

-- 4. Answering.
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000b1');
select pg_temp.expect('answers are not written directly',
  pg_temp.refusal(format('insert into public.fixture_plan_answer (plan_id, profile_id, answer) values (%L, %L, %L)',
    pg_temp.id('p1'), 'ad000007-0000-4000-8000-0000000000e1', 'vou')),
  'permission denied for table fixture_plan_answer');
select pg_temp.expect('only vou or talvez', pg_temp.refusal(format('select public.answer_fixture_plan(%L, %L)', pg_temp.id('p1'), 'sim')), 'bad_answer');
select public.answer_fixture_plan(pg_temp.id('p1'), 'talvez');
select pg_temp.expect('M is a maybe', (select going || ':' || maybe || ':' || my_answer from public.fixture_plan_summaries(array[pg_temp.id('p1')])), '1:1:talvez');
select public.answer_fixture_plan(pg_temp.id('p1'), null);
select pg_temp.expect('no answer removes it', (select maybe from public.fixture_plan_summaries(array[pg_temp.id('p1')])), 0);
select public.answer_fixture_plan(pg_temp.id('p1'), 'vou');
select pg_temp.expect('a member sees who goes',
  (select string_agg(display_name || ':' || is_me, ',' order by display_name) from public.fixture_plan_people(pg_temp.id('p1'))),
  'Plano Dono:false,Plano Membro:true');

-- 5. Only the creator manages the plan; a driver or host may attach their own car or house.
select pg_temp.expect('a member cannot close it', pg_temp.refusal(format('select public.set_fixture_plan_status(%L, %L)', pg_temp.id('p1'), 'fechado')), 'not_owner');
select pg_temp.expect('a member cannot share it', pg_temp.refusal(format('select public.share_fixture_plan(%L, %L)', pg_temp.id('p1'), 'c0000007-0000-4000-8000-0000000000a3')), 'not_owner');
select pg_temp.expect('a member cannot lock the house', pg_temp.refusal(format('select public.set_plan_stay_locked(%L, true)', pg_temp.id('p1'))), 'not_owner');
select pg_temp.expect('a member cannot attach someone else''s house',
  pg_temp.refusal(format('select public.set_fixture_plan_stay(%L, %L)', pg_temp.id('p1'), pg_temp.id('casa'))), 'not_owner');
select pg_temp.expect('a ride that does not exist is refused',
  pg_temp.refusal(format('select public.set_fixture_plan_ride(%L, %L)', pg_temp.id('p1'), gen_random_uuid())), 'ride_not_found');
select public.set_fixture_plan_ride(pg_temp.id('p1'), pg_temp.id('ride'));
select pg_temp.expect('the driver attached their car', (select ride_driver_name from public.fixture_plan_summaries(array[pg_temp.id('p1')])), 'Plano Membro');
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000c1');
select pg_temp.expect('another member cannot take the car off',
  pg_temp.refusal(format('select public.set_fixture_plan_ride(%L)', pg_temp.id('p1'))), 'not_owner');
select pg_temp.expect('the house from another game is refused',
  pg_temp.refusal(format('select public.set_fixture_plan_stay(%L, %L)', pg_temp.id('p1'), gen_random_uuid())), 'stay_not_found');

-- 6. Sharing with another group.
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000a1');
select pg_temp.expect('fixture_plan_group is not written directly',
  pg_temp.refusal(format('insert into public.fixture_plan_group (plan_id, group_id) values (%L, %L)', pg_temp.id('p1'), 'c0000007-0000-4000-8000-0000000000a3')),
  'permission denied for table fixture_plan_group');
select pg_temp.expect('not with the plan''s own group',
  pg_temp.refusal(format('select public.share_fixture_plan(%L, %L)', pg_temp.id('p1'), 'c0000007-0000-4000-8000-0000000000a1')), 'same_group');
select pg_temp.expect('not with a group O is not in',
  pg_temp.refusal(format('select public.share_fixture_plan(%L, %L)', pg_temp.id('p1'), 'c0000007-0000-4000-8000-0000000000a3')), 'not_member');
select public.share_fixture_plan(pg_temp.id('p1'), 'c0000007-0000-4000-8000-0000000000a2');
select pg_temp.as_user('ad000007-0000-4000-8000-000000000051');
select pg_temp.expect('S now sees the plan through G2', pg_temp.sees_plan(), 1);
select pg_temp.expect('S finds it in G2',
  (select count(*)::integer from public.group_fixture_plans('c0000007-0000-4000-8000-0000000000a2') as p where p = pg_temp.id('p1')), 1);
select pg_temp.expect('S does not see it listed under G1',
  (select count(*)::integer from public.group_fixture_plans('c0000007-0000-4000-8000-0000000000a1')), 0);
select public.answer_fixture_plan(pg_temp.id('p1'), 'vou');
select pg_temp.expect('S cannot see G1''s private house', (select count(*)::integer from public.fixture_plan_houses(pg_temp.id('p1')) where id = pg_temp.id('casa')), 0);

-- 7. Houses and votes.
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000b1');
select pg_temp.expect('votes are not written directly',
  pg_temp.refusal(format('insert into public.fixture_plan_house_vote (plan_id, profile_id, stay_plan_id) values (%L, %L, %L)',
    pg_temp.id('p1'), 'ad000007-0000-4000-8000-0000000000c1', pg_temp.id('casa'))),
  'permission denied for table fixture_plan_house_vote');
select pg_temp.expect('a house unrelated to the plan cannot be voted',
  pg_temp.refusal(format('select public.vote_fixture_plan_house(%L, %L)', pg_temp.id('p1'), pg_temp.id('casa_x'))), 'stay_not_found');
select public.vote_fixture_plan_house(pg_temp.id('p1'), pg_temp.id('casa'));
select pg_temp.expect('M sees G1''s house with M''s vote',
  (select votes || ':' || my_vote from public.fixture_plan_houses(pg_temp.id('p1')) where id = pg_temp.id('casa')), '1:true');
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000a1');
select pg_temp.expect('locking without a house is refused',
  pg_temp.refusal(format('select public.set_plan_stay_locked(%L, true)', pg_temp.id('p1'))), 'stay_not_found');
select public.set_fixture_plan_stay(pg_temp.id('p1'), pg_temp.id('casa'));
select public.set_plan_stay_locked(pg_temp.id('p1'), true);
select pg_temp.as_user('ad000007-0000-4000-8000-000000000051');
select pg_temp.expect('once it is the plan''s house, S sees it',
  (select chosen::text || ':' || locked::text from public.fixture_plan_houses(pg_temp.id('p1'))), 'true:true');

-- 8. Conflicts: going in a closed plan blocks going with another group, without telling outsiders.
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000b1');
insert into t_ids (key, id) values ('p3', public.invite_group_to_fixture('c0000007-0000-4000-8000-0000000000a3', pg_temp.jogo()));
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000a1');
select pg_temp.expect('a made-up status is refused', pg_temp.refusal(format('select public.set_fixture_plan_status(%L, %L)', pg_temp.id('p1'), 'feito')), 'bad_status');
select public.set_fixture_plan_status(pg_temp.id('p1'), 'fechado');
select pg_temp.expect('answers close with the plan',
  pg_temp.refusal(format('select public.answer_fixture_plan(%L, %L)', pg_temp.id('p1'), 'talvez')), 'plan_closed');
select pg_temp.expect('a closed plan is not shared',
  pg_temp.refusal(format('select public.share_fixture_plan(%L, %L)', pg_temp.id('p1'), 'c0000007-0000-4000-8000-0000000000a2')), 'plan_closed');
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000b1');
select pg_temp.expect('M sees the conflict in G3''s plan',
  (select other_group from public.my_plan_conflicts(array[pg_temp.id('p3')])), 'Grupo Plano Um');
select pg_temp.expect('M can no longer say vou to G3''s plan',
  pg_temp.refusal(format('select public.answer_fixture_plan(%L, %L)', pg_temp.id('p3'), 'vou')), 'already_going');
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000e1');
select pg_temp.expect('X sees no conflicts of anyone', (select count(*)::integer from public.my_plan_conflicts(array[pg_temp.id('p1'), pg_temp.id('p3')])), 0);

-- 9. Removed from the group, out of the plan.
select pg_temp.as_user('ad000007-0000-4000-8000-000000000051');
select public.leave_group('c0000007-0000-4000-8000-0000000000a2');
select pg_temp.expect('S, out of G2, no longer sees the plan', pg_temp.sees_plan(), 0);
select pg_temp.expect('S no longer sees who goes', (select count(*)::integer from public.fixture_plan_people(pg_temp.id('p1'))), 0);
select pg_temp.expect('S no longer sees the house', (select count(*)::integer from public.fixture_plan_houses(pg_temp.id('p1'))), 0);

-- 10. Cancelling.
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000a1');
select public.set_fixture_plan_status(pg_temp.id('p1'), 'cancelado');
select pg_temp.expect('a cancelled plan cannot be reopened',
  pg_temp.refusal(format('select public.set_fixture_plan_status(%L, %L)', pg_temp.id('p1'), 'aberto')), 'plan_closed');
select pg_temp.expect('a cancelled plan leaves the group''s list',
  (select count(*)::integer from public.group_fixture_plans('c0000007-0000-4000-8000-0000000000a1')), 0);
select pg_temp.expect('a cancelled plan takes no ride',
  pg_temp.refusal(format('select public.set_fixture_plan_ride(%L)', pg_temp.id('p1'))), 'plan_closed');

-- 11. 30 plans a day.
reset role;
insert into public.rate_limit_hit (profile_id, bucket)
select 'ad000007-0000-4000-8000-0000000000a1', 'fixture-plan' from generate_series(1, 30);
set local role authenticated;
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000a1');
select pg_temp.expect('31st plan of the day refused',
  pg_temp.refusal(format('select public.invite_group_to_fixture(%L, %L)', 'c0000007-0000-4000-8000-0000000000a1', pg_temp.jogo())), 'rate_limited');

-- 9. Security review 2026-10-08: a plan cannot be used to take over a stranger's car or house. X makes a group of
-- their own, invites it to the game and tries to attach M's car (M is not in X's group) and to join it.
reset role;
insert into public.fan_group (id, name, created_by, invite_code)
values ('c0000007-0000-4000-8000-0000000000a4', 'Grupo Plano Intruso', 'ad000007-0000-4000-8000-0000000000e1', 'acplanos04');
insert into public.fan_group_member (group_id, profile_id, role)
values ('c0000007-0000-4000-8000-0000000000a4', 'ad000007-0000-4000-8000-0000000000e1', 'owner');
delete from public.rate_limit_hit where profile_id = 'ad000007-0000-4000-8000-0000000000e1';
set local role authenticated;
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000e1');
insert into t_ids (key, id) values ('px', public.invite_group_to_fixture('c0000007-0000-4000-8000-0000000000a4', pg_temp.jogo()));
select pg_temp.expect('a plan creator cannot attach the car of someone outside the plan',
  pg_temp.refusal(format('select public.set_fixture_plan_ride(%L, %L)', pg_temp.id('px'), pg_temp.id('ride'))), 'driver_not_in_plan');
select pg_temp.expect('so there is no car to join without asking',
  pg_temp.refusal(format('select public.join_plan_ride(%L)', pg_temp.id('px'))), 'ride_not_found');
select pg_temp.expect('nor a stranger''s house (H only offers it to G1)',
  pg_temp.refusal(format('select public.set_fixture_plan_stay(%L, %L)', pg_temp.id('px'), pg_temp.id('casa'))), 'owner_not_in_plan');
reset role;
select pg_temp.expect('X is no passenger of M''s car',
  (select count(*)::integer from public.ride_passenger where ride_id = pg_temp.id('ride') and profile_id = 'ad000007-0000-4000-8000-0000000000e1'), 0);
select pg_temp.expect('and X got into no trip accounts of that car',
  (select count(*)::integer from public.trip_session_member as m join public.trip_session as t on t.id = m.session_id
   where t.ride_id = pg_temp.id('ride') and m.profile_id = 'ad000007-0000-4000-8000-0000000000e1'), 0);

-- 10. Once the game kicks off the plan is a record: nobody answers, closes or reopens it any more; leaving still works.
reset role;
update public.fixture set kickoff_at = now() - interval '1 hour' where id = pg_temp.jogo();
set local role authenticated;
select pg_temp.as_user('ad000007-0000-4000-8000-0000000000e1');
select pg_temp.expect('after kick-off nobody answers a plan',
  pg_temp.refusal(format('select public.answer_fixture_plan(%L, %L)', pg_temp.id('px'), 'talvez')), 'fixture_over');
select pg_temp.expect('after kick-off the plan cannot be closed or reopened',
  pg_temp.refusal(format('select public.set_fixture_plan_status(%L, %L)', pg_temp.id('px'), 'fechado')), 'fixture_over');
select pg_temp.expect('after kick-off taking back one''s answer still works',
  pg_temp.refusal(format('select public.answer_fixture_plan(%L, null)', pg_temp.id('px'))), 'accepted');
reset role;
select set_config('request.jwt.claims', '', true);
select pg_temp.expect('server jobs can still change it (no person behind them)',
  pg_temp.refusal(format('update public.fixture_plan set status = %L where id = %L', 'fechado', pg_temp.id('px'))), 'accepted');

reset role;
select count(*) as checks_passed from expect_log;

rollback;
