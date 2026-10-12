-- A cancelled ride disappears from the ride board for everyone, its driver included, and the group of a plan that had
-- it is told in its chat (2026-10-09).
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_boleia_cancelada.test.sql

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
  ('ad00000b-0000-4000-8000-0000000000a1', 'boleia-cancelada-a@test.invalid', '{"display_name":"Cancela A"}', 'authenticated', 'authenticated'),
  ('ad00000b-0000-4000-8000-0000000000b1', 'boleia-cancelada-b@test.invalid', '{"display_name":"Cancela B"}', 'authenticated', 'authenticated');

insert into public.fan_group (id, name, created_by, invite_code)
values ('c000000b-0000-4000-8000-0000000000a1', 'Grupo Cancela', 'ad00000b-0000-4000-8000-0000000000a1', 'accancel01');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('c000000b-0000-4000-8000-0000000000a1', 'ad00000b-0000-4000-8000-0000000000a1', 'owner'),
  ('c000000b-0000-4000-8000-0000000000a1', 'ad00000b-0000-4000-8000-0000000000b1', 'member');

create temporary table t_ids (key text primary key, id uuid, txt text) on commit drop;
grant insert, select on t_ids to authenticated;
insert into t_ids (key, txt)
select 'jogo', f.id from public.fixture as f where f.kickoff_at > now() + interval '2 days' order by f.kickoff_at limit 1;
insert into t_ids (key, id) values ('ride', gen_random_uuid());
insert into public.ride (
  id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
  total_cents, group_id, visibility
)
select (select id from t_ids where key = 'ride'), f.id, 'ad00000b-0000-4000-8000-0000000000b1', 'Coimbra',
  'SRID=4326;POINT(-8.42 40.2)', f.kickoff_at - interval '3 hours', 3, 'rapida', false, 100000, 3600, 0, 600, 1700,
  1020, 0, 1020, 'c000000b-0000-4000-8000-0000000000a1', 'grupo'
from public.fixture as f where f.id = (select txt from t_ids where key = 'jogo');
-- The ride for the group already made a plan by itself; this test builds its own.
delete from public.fixture_plan
where group_id = 'c000000b-0000-4000-8000-0000000000a1' and fixture_id = (select txt from t_ids where key = 'jogo');

set local role authenticated;
select pg_temp.as_user('ad00000b-0000-4000-8000-0000000000a1');
insert into t_ids (key, id)
values ('plano', public.invite_group_to_fixture('c000000b-0000-4000-8000-0000000000a1', (select txt from t_ids where key = 'jogo')));
select pg_temp.as_user('ad00000b-0000-4000-8000-0000000000b1');
select public.set_fixture_plan_ride((select id from t_ids where key = 'plano'), (select id from t_ids where key = 'ride'));
select pg_temp.expect('before: the driver sees the ride on the board',
  (select count(*)::integer from public.ride_board((select txt from t_ids where key = 'jogo')) where id = (select id from t_ids where key = 'ride')), 1);

select public.cancel_ride((select id from t_ids where key = 'ride'));
select pg_temp.expect('after cancelling, the driver no longer sees it',
  (select count(*)::integer from public.ride_board((select txt from t_ids where key = 'jogo')) where id = (select id from t_ids where key = 'ride')), 0);
select pg_temp.as_user('ad00000b-0000-4000-8000-0000000000a1');
select pg_temp.expect('nor does the rest of the group',
  (select count(*)::integer from public.ride_board((select txt from t_ids where key = 'jogo')) where id = (select id from t_ids where key = 'ride')), 0);

reset role;
select pg_temp.expect('the plan''s group is told in its chat',
  (select count(*)::integer from public.group_message
   where group_id = 'c000000b-0000-4000-8000-0000000000a1' and kind = 'aviso'
     and body like 'Cancela B cancelou a boleia deste plano.%'), 1);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
