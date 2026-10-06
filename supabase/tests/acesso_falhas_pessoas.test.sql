-- Known holes in people, groups and plans: each check states the CORRECT behaviour, so this file fails until the
-- hole is fixed. Unlike the other files, every check runs (one failure does not hide the next), and the file
-- ends by listing all that failed.
--
-- Runs inside a transaction that is always rolled back.
--
--   supabase db query --linked -f supabase/tests/acesso_falhas_pessoas.test.sql
--
-- People: B and C are friends, in group G, and share a car; X is a signed-in stranger to all of it;
-- O owns group G3 with member M and then deletes the account.

begin;

create temporary table expect_log (name text) on commit drop;
create temporary table fail_log (name text) on commit drop;
create temporary table t_ids (key text primary key, id uuid, txt text) on commit drop;
grant insert, select, update, delete on expect_log, fail_log, t_ids to authenticated, anon;

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

-- Like expect, but records the failure and carries on.
create function pg_temp.check(p_name text, p_ok boolean, p_got text)
returns void
language plpgsql
as $$
begin
  if p_ok then
    insert into expect_log values (p_name);
  else
    insert into fail_log values (p_name || ' (got ' || coalesce(p_got, 'null') || ')');
  end if;
end;
$$;

-- Runs a query that returns one value, and gives back that value as text, or 'refused: <message>'.
create function pg_temp.try(p_sql text)
returns text
language plpgsql
as $$
declare
  valor text;
  mensagem text;
begin
  execute p_sql into valor;
  return coalesce(valor, 'null');
exception when others then
  get stacked diagnostics mensagem = message_text;
  return 'refused: ' || mensagem;
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

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('ad000009-0000-4000-8000-0000000000b1', 'acesso-falhas-b@test.invalid', '{"display_name":"Falhas B"}', 'authenticated', 'authenticated'),
  ('ad000009-0000-4000-8000-0000000000c1', 'acesso-falhas-c@test.invalid', '{"display_name":"Falhas C"}', 'authenticated', 'authenticated'),
  ('ad000009-0000-4000-8000-0000000000e1', 'acesso-falhas-x@test.invalid', '{"display_name":"Falhas X"}', 'authenticated', 'authenticated'),
  ('ad000009-0000-4000-8000-0000000000a1', 'acesso-falhas-o@test.invalid', '{"display_name":"Falhas Dono"}', 'authenticated', 'authenticated'),
  ('ad000009-0000-4000-8000-0000000000a2', 'acesso-falhas-m@test.invalid', '{"display_name":"Falhas Membro"}', 'authenticated', 'authenticated');

insert into public.fan_group (id, name, created_by, invite_code)
values
  ('c0000009-0000-4000-8000-0000000000a1', 'Grupo Secreto', 'ad000009-0000-4000-8000-0000000000b1', 'acfalhas01'),
  ('c0000009-0000-4000-8000-0000000000a2', 'Grupo Falhas Dois', 'ad000009-0000-4000-8000-0000000000c1', 'acfalhas02'),
  ('c0000009-0000-4000-8000-0000000000a3', 'Grupo Falhas Tres', 'ad000009-0000-4000-8000-0000000000a1', 'acfalhas03');
insert into public.fan_group_member (group_id, profile_id, role, joined_at)
values
  ('c0000009-0000-4000-8000-0000000000a1', 'ad000009-0000-4000-8000-0000000000b1', 'owner', now()),
  ('c0000009-0000-4000-8000-0000000000a1', 'ad000009-0000-4000-8000-0000000000c1', 'member', now()),
  ('c0000009-0000-4000-8000-0000000000a2', 'ad000009-0000-4000-8000-0000000000c1', 'owner', now()),
  ('c0000009-0000-4000-8000-0000000000a3', 'ad000009-0000-4000-8000-0000000000a1', 'owner', now() - interval '2 days'),
  ('c0000009-0000-4000-8000-0000000000a3', 'ad000009-0000-4000-8000-0000000000a2', 'member', now() - interval '1 day');
insert into public.friendship (requester_id, addressee_id, status, responded_at)
values ('ad000009-0000-4000-8000-0000000000b1', 'ad000009-0000-4000-8000-0000000000c1', 'aceite', now());

-- B drives C to a game; B's group has a closed plan for that game where C goes; C's other group has a plan too.
insert into t_ids (key, id) values ('ride', gen_random_uuid()), ('p1', gen_random_uuid()), ('p2', gen_random_uuid());
insert into t_ids (key, txt)
select 'jogo', f.id from public.fixture as f where f.kickoff_at > now() + interval '2 days' order by f.kickoff_at limit 1;
insert into public.ride (
  id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
  total_cents
)
select
  pg_temp.id('ride'), f.id, 'ad000009-0000-4000-8000-0000000000b1', 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)',
  f.kickoff_at - interval '3 hours', 3, 'rapida', false, 100000, 3600, 0, 600, 1700, 1020, 0, 1020
from public.fixture as f where f.id = (select txt from t_ids where key = 'jogo');
insert into public.ride_passenger (ride_id, profile_id, status)
values (pg_temp.id('ride'), 'ad000009-0000-4000-8000-0000000000c1', 'accepted');
insert into public.fixture_plan (id, group_id, fixture_id, created_by, status, closed_reason, closed_at)
values
  (pg_temp.id('p1'), 'c0000009-0000-4000-8000-0000000000a1', (select txt from t_ids where key = 'jogo'),
   'ad000009-0000-4000-8000-0000000000b1', 'fechado', 'manual', now()),
  (pg_temp.id('p2'), 'c0000009-0000-4000-8000-0000000000a2', (select txt from t_ids where key = 'jogo'),
   'ad000009-0000-4000-8000-0000000000c1', 'aberto', null, null);
insert into public.fixture_plan_answer (plan_id, profile_id, answer)
values (pg_temp.id('p1'), 'ad000009-0000-4000-8000-0000000000c1', 'vou');

select pg_temp.expect('setup: the ride exists', (select count(*)::integer from public.ride where id = pg_temp.id('ride')), 1);

-- 1. Helper functions open to every signed-in account answer questions about other people.
--    X has nothing to do with B, C, their groups, car or plans.
set local role authenticated;
select pg_temp.as_user('ad000009-0000-4000-8000-0000000000e1');

insert into t_ids (key, txt) values ('r', pg_temp.try('select public.are_friends(''ad000009-0000-4000-8000-0000000000b1'', ''ad000009-0000-4000-8000-0000000000c1'')::text'));
select pg_temp.check('a stranger cannot learn that B and C are friends (are_friends)',
  (select txt from t_ids where key = 'r') <> 'true', (select txt from t_ids where key = 'r'));
delete from t_ids where key = 'r';

insert into t_ids (key, txt) values ('r', pg_temp.try('select public.trips_together(''ad000009-0000-4000-8000-0000000000b1'', ''ad000009-0000-4000-8000-0000000000c1'')::text'));
select pg_temp.check('a stranger cannot learn that B and C travel together (trips_together)',
  (select txt from t_ids where key = 'r') in ('0', 'null') or (select txt from t_ids where key = 'r') like 'refused%',
  (select txt from t_ids where key = 'r'));
delete from t_ids where key = 'r';

insert into t_ids (key, txt) values ('r', pg_temp.try('select public.is_group_member(''c0000009-0000-4000-8000-0000000000a1'', ''ad000009-0000-4000-8000-0000000000c1'')::text'));
select pg_temp.check('a stranger cannot learn that C is in B''s group (is_group_member)',
  (select txt from t_ids where key = 'r') <> 'true', (select txt from t_ids where key = 'r'));
delete from t_ids where key = 'r';

insert into t_ids (key, txt) values ('r', pg_temp.try('select public.is_group_folder_member(''c0000009-0000-4000-8000-0000000000a1'', ''ad000009-0000-4000-8000-0000000000c1'')::text'));
select pg_temp.check('a stranger cannot learn that C is in B''s group (is_group_folder_member)',
  (select txt from t_ids where key = 'r') <> 'true', (select txt from t_ids where key = 'r'));
delete from t_ids where key = 'r';

insert into t_ids (key, txt) values ('r', pg_temp.try(format('select public.can_see_fixture_plan(%L, %L)::text', pg_temp.id('p1'), 'ad000009-0000-4000-8000-0000000000c1')));
select pg_temp.check('a stranger cannot probe who is in a plan (can_see_fixture_plan)',
  (select txt from t_ids where key = 'r') <> 'true', (select txt from t_ids where key = 'r'));
delete from t_ids where key = 'r';

insert into t_ids (key, txt) values ('r', pg_temp.try(format('select public.closed_plan_elsewhere(%L, %L)', pg_temp.id('p2'), 'ad000009-0000-4000-8000-0000000000c1')));
select pg_temp.check('a stranger cannot learn the name of the group C is going with (closed_plan_elsewhere)',
  (select txt from t_ids where key = 'r') <> 'Grupo Secreto', (select txt from t_ids where key = 'r'));
delete from t_ids where key = 'r';

-- 2. The name rate limit (5 changes a week in set_display_name) is skipped by updating the column directly.
select public.set_display_name('Falhas X' || n) from generate_series(1, 5) as n;
insert into t_ids (key, txt) values ('r', pg_temp.try(
  'with u as (update public.profile set display_name = ''Falhas X6'' where id = ''ad000009-0000-4000-8000-0000000000e1'' returning 1) select count(*)::text from u'));
select pg_temp.check('the 6th name change in a week is refused, also when written directly',
  (select txt from t_ids where key = 'r') <> '1', (select txt from t_ids where key = 'r'));
delete from t_ids where key = 'r';

-- 3. Feedback without an account has no limit at all.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select public.send_feedback('erro', 'outro', 'Anonimo numero ' || n) from generate_series(1, 30) as n;
insert into t_ids (key, txt) values ('r', pg_temp.try('select public.send_feedback(''erro'', ''outro'', ''Anonimo numero 31'')::text'));
select pg_temp.check('anonymous feedback is limited (31 in a row from the same caller)',
  (select txt from t_ids where key = 'r') like 'refused%', (select left(txt, 9) from t_ids where key = 'r'));
delete from t_ids where key = 'r';

-- 4. When a group's owner deletes the account, nobody owns the group any more.
reset role;
delete from auth.users where id = 'ad000009-0000-4000-8000-0000000000a1';
select pg_temp.check('after the owner deletes the account, the oldest member owns the group (as in leave_group)',
  (select role from public.fan_group_member
   where group_id = 'c0000009-0000-4000-8000-0000000000a3' and profile_id = 'ad000009-0000-4000-8000-0000000000a2') = 'owner',
  (select role from public.fan_group_member
   where group_id = 'c0000009-0000-4000-8000-0000000000a3' and profile_id = 'ad000009-0000-4000-8000-0000000000a2'));

do $$
begin
  if exists (select 1 from fail_log) then
    raise exception 'FAILED % of % checks: %', (select count(*) from fail_log),
      (select count(*) from fail_log) + (select count(*) from expect_log),
      (select string_agg(name, ' | ') from fail_log);
  end if;
end;
$$;

select count(*) as checks_passed from expect_log;

rollback;
