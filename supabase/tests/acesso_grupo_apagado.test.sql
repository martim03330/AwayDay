-- A group can always be deleted, even when one of its rides was only for the group (2026-10-09): the last person
-- leaving used to fail on ride_private_needs_group. Open rides of the group are cancelled; none stays private.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_grupo_apagado.test.sql

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
  ('ad00000a-0000-4000-8000-0000000000a1', 'grupo-apagado-a@test.invalid', '{"display_name":"Apagado A"}', 'authenticated', 'authenticated'),
  ('ad00000a-0000-4000-8000-0000000000b1', 'grupo-apagado-b@test.invalid', '{"display_name":"Apagado B"}', 'authenticated', 'authenticated');

insert into public.fan_group (id, name, created_by, invite_code)
values ('c000000a-0000-4000-8000-0000000000a1', 'Grupo Apagado', 'ad00000a-0000-4000-8000-0000000000a1', 'acapagad01');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('c000000a-0000-4000-8000-0000000000a1', 'ad00000a-0000-4000-8000-0000000000a1', 'owner'),
  ('c000000a-0000-4000-8000-0000000000a1', 'ad00000a-0000-4000-8000-0000000000b1', 'member');

-- B offers a ride only for the group, to a game still to come, and an old one; then B leaves the group.
insert into public.ride (
  id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
  total_cents, group_id, visibility
)
select gen_random_uuid(), f.id, 'ad00000a-0000-4000-8000-0000000000b1', 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)',
  f.kickoff_at - interval '3 hours', 3, 'rapida', false, 100000, 3600, 0, 600, 1700, 1020, 0, 1020,
  'c000000a-0000-4000-8000-0000000000a1', 'grupo'
from public.fixture as f
where f.kickoff_at > now() + interval '1 day'
order by f.kickoff_at
limit 1;
delete from public.fan_group_member
where group_id = 'c000000a-0000-4000-8000-0000000000a1' and profile_id = 'ad00000a-0000-4000-8000-0000000000b1';

set local role authenticated;
select pg_temp.as_user('ad00000a-0000-4000-8000-0000000000a1');
select pg_temp.expect('the last person can leave a group that had a private ride',
  pg_temp.refusal('select public.leave_group(''c000000a-0000-4000-8000-0000000000a1'')'), 'accepted');

reset role;
select pg_temp.expect('the group is gone',
  (select count(*)::integer from public.fan_group where id = 'c000000a-0000-4000-8000-0000000000a1'), 0);
select pg_temp.expect('its open ride was cancelled (no group left to go with)',
  (select string_agg(status || '/' || visibility, ',') from public.ride where driver_id = 'ad00000a-0000-4000-8000-0000000000b1'),
  'cancelled/publica');

reset role;
select count(*) as checks_passed from expect_log;

rollback;
