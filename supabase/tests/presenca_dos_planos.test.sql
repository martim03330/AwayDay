-- «Vou a este jogo» follows the plan and the car (20261027140000_plans_and_rides_mark_going), and a plan that closes
-- says so in the group's chat, without a push (20261027141000_plan_closed_notice).
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/presenca_dos_planos.test.sql
--
-- People: O invites group G and drives the car (1 seat); M answers the plan and takes the seat; A had already been to
-- the game ('attended', forced here); X is an outsider.

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

/** The attendance status of a person for the game under test (null: none). */
create function pg_temp.presenca(p_profile_id uuid)
returns text
language sql
as $$
  select a.status from public.fixture_attendance as a where a.profile_id = p_profile_id and a.fixture_id = pg_temp.jogo();
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('ad000027-0000-4000-8000-0000000000a1', 'presenca-planos-o@test.invalid', '{"display_name":"Rui Dono"}', 'authenticated', 'authenticated'),
  ('ad000027-0000-4000-8000-0000000000b1', 'presenca-planos-m@test.invalid', '{"display_name":"Presenca Membro"}', 'authenticated', 'authenticated'),
  ('ad000027-0000-4000-8000-0000000000c1', 'presenca-planos-a@test.invalid', '{"display_name":"Presenca Foi"}', 'authenticated', 'authenticated'),
  ('ad000027-0000-4000-8000-0000000000e1', 'presenca-planos-x@test.invalid', '{"display_name":"Presenca Fora"}', 'authenticated', 'authenticated');

insert into public.fan_group (id, name, created_by, invite_code)
values ('c0000027-0000-4000-8000-0000000000a1', 'Grupo Presenca', 'ad000027-0000-4000-8000-0000000000a1', 'prplanos01');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('c0000027-0000-4000-8000-0000000000a1', 'ad000027-0000-4000-8000-0000000000a1', 'owner'),
  ('c0000027-0000-4000-8000-0000000000a1', 'ad000027-0000-4000-8000-0000000000b1', 'member'),
  ('c0000027-0000-4000-8000-0000000000a1', 'ad000027-0000-4000-8000-0000000000c1', 'member');

insert into t_ids (key, txt)
select 'jogo', f.id from public.fixture as f where f.kickoff_at > now() + interval '2 days' order by f.kickoff_at limit 1;
insert into t_ids (key, txt)
select 'passado', f.id from public.fixture as f where f.kickoff_at < now() - interval '1 day' order by f.kickoff_at desc limit 1;
select pg_temp.expect('there are games', (select count(*)::integer from t_ids where txt is not null), 2);

-- 0. Clients cannot mark anybody as going through the helper; a game already played is never marked.
set local role authenticated;
select pg_temp.as_user('ad000027-0000-4000-8000-0000000000e1');
select pg_temp.expect('the helper is not for clients',
  pg_temp.refusal(format('select public.mark_going_to_fixture(%L, %L)', 'ad000027-0000-4000-8000-0000000000e1', pg_temp.jogo())),
  'permission denied for function mark_going_to_fixture');
reset role;
select set_config('request.jwt.claims', '', true);
select public.mark_going_to_fixture('ad000027-0000-4000-8000-0000000000e1', (select txt from t_ids where key = 'passado'));
select pg_temp.expect('a game already played is not marked',
  (select count(*)::integer from public.fixture_attendance
   where profile_id = 'ad000027-0000-4000-8000-0000000000e1' and fixture_id = (select txt from t_ids where key = 'passado')), 0);

-- 1. A «vou» in the plan marks the game; a «não vou» takes back only a 'going'.
set local role authenticated;
select pg_temp.as_user('ad000027-0000-4000-8000-0000000000a1');
insert into t_ids (key, id) values ('plano', public.invite_group_to_fixture('c0000027-0000-4000-8000-0000000000a1', pg_temp.jogo()));
select pg_temp.expect('who invited is going', pg_temp.presenca('ad000027-0000-4000-8000-0000000000a1'), 'going');

select pg_temp.as_user('ad000027-0000-4000-8000-0000000000b1');
select pg_temp.expect('no attendance before answering', pg_temp.presenca('ad000027-0000-4000-8000-0000000000b1'), null::text);
select public.answer_fixture_plan(pg_temp.id('plano'), 'vou');
select pg_temp.expect('«vou» marks the game', pg_temp.presenca('ad000027-0000-4000-8000-0000000000b1'), 'going');
select public.answer_fixture_plan(pg_temp.id('plano'), 'nao');
select pg_temp.expect('«não vou» unmarks it', pg_temp.presenca('ad000027-0000-4000-8000-0000000000b1'), null::text);
select public.answer_fixture_plan(pg_temp.id('plano'), 'vou');
select pg_temp.expect('«vou» again marks it again', pg_temp.presenca('ad000027-0000-4000-8000-0000000000b1'), 'going');
select public.answer_fixture_plan(pg_temp.id('plano'), null);
select pg_temp.expect('taking back the answer keeps the game marked', pg_temp.presenca('ad000027-0000-4000-8000-0000000000b1'), 'going');

-- 'attended' is never touched (forced here: on a game still to come it only comes from a stamp).
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.fixture_attendance (profile_id, fixture_id, status)
values ('ad000027-0000-4000-8000-0000000000c1', pg_temp.jogo(), 'attended');
set local role authenticated;
select pg_temp.as_user('ad000027-0000-4000-8000-0000000000c1');
select public.answer_fixture_plan(pg_temp.id('plano'), 'vou');
select pg_temp.expect('«vou» does not downgrade attended', pg_temp.presenca('ad000027-0000-4000-8000-0000000000c1'), 'attended');
select public.answer_fixture_plan(pg_temp.id('plano'), 'nao');
select pg_temp.expect('«não vou» does not remove attended', pg_temp.presenca('ad000027-0000-4000-8000-0000000000c1'), 'attended');

-- 2. The car: offering it marks the driver; a seat accepted marks the passenger; leaving keeps it.
reset role;
select set_config('request.jwt.claims', '', true);
delete from public.fixture_attendance where profile_id in ('ad000027-0000-4000-8000-0000000000a1', 'ad000027-0000-4000-8000-0000000000b1');
insert into t_ids (key, id) values ('ride', gen_random_uuid());
insert into public.ride (
  id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
  total_cents
)
select
  pg_temp.id('ride'), f.id, 'ad000027-0000-4000-8000-0000000000a1', 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)',
  f.kickoff_at - interval '3 hours', 1, 'rapida', false, 100000, 3600, 0, 600, 1700, 1020, 0, 1020
from public.fixture as f where f.id = pg_temp.jogo();
select pg_temp.expect('offering a car marks the driver', pg_temp.presenca('ad000027-0000-4000-8000-0000000000a1'), 'going');

update public.fixture_plan set ride_id = pg_temp.id('ride') where id = pg_temp.id('plano');
insert into public.ride_passenger (ride_id, profile_id, status)
values (pg_temp.id('ride'), 'ad000027-0000-4000-8000-0000000000b1', 'requested');
select pg_temp.expect('a request alone does not mark the game', pg_temp.presenca('ad000027-0000-4000-8000-0000000000b1'), null::text);
select pg_temp.expect('no notice while the plan is open',
  (select count(*)::integer from public.group_message where plan_id = pg_temp.id('plano') and kind = 'aviso'), 0);
update public.ride_passenger set status = 'accepted'
where ride_id = pg_temp.id('ride') and profile_id = 'ad000027-0000-4000-8000-0000000000b1';
select pg_temp.expect('a seat accepted marks the passenger', pg_temp.presenca('ad000027-0000-4000-8000-0000000000b1'), 'going');

-- 3. The car is full: the plan closes by itself and the group is told, as the driver, quietly.
select pg_temp.expect('the full car closed the plan',
  (select status || ':' || closed_reason from public.fixture_plan where id = pg_temp.id('plano')), 'fechado:carro_cheio');
select pg_temp.expect('the group got one notice from the driver',
  (select count(*)::integer from public.group_message
   where group_id = 'c0000027-0000-4000-8000-0000000000a1' and plan_id = pg_temp.id('plano') and kind = 'aviso'
     and profile_id = 'ad000027-0000-4000-8000-0000000000a1' and body like 'Plano % fechado: Rui Dono já tem o carro cheio.'), 1);
select pg_temp.expect('the quiet flag does not stay on', coalesce(current_setting('awayday.quiet_notice', true), ''), '');

update public.ride_passenger set status = 'left'
where ride_id = pg_temp.id('ride') and profile_id = 'ad000027-0000-4000-8000-0000000000b1';
select pg_temp.expect('leaving the car keeps the game marked', pg_temp.presenca('ad000027-0000-4000-8000-0000000000b1'), 'going');

-- 4. Closed by hand: the group is told who closed it.
update public.fixture_plan set status = 'aberto', closed_reason = null, closed_at = null where id = pg_temp.id('plano');
set local role authenticated;
select pg_temp.as_user('ad000027-0000-4000-8000-0000000000a1');
select public.set_fixture_plan_status(pg_temp.id('plano'), 'fechado');
reset role;
select pg_temp.expect('closing by hand tells the group',
  (select count(*)::integer from public.group_message
   where plan_id = pg_temp.id('plano') and kind = 'aviso' and body like 'Rui Dono fechou o plano %.'), 1);
select pg_temp.expect('a plan reopened does not say anything',
  (select count(*)::integer from public.group_message where plan_id = pg_temp.id('plano') and kind = 'aviso'), 2);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
