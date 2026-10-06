-- Tests for where people leave from (migration 20261006110703_profile_home.sql): only the owner sees or changes it.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/profile_home.test.sql

begin;

create temporary table expect_log (name text) on commit drop;
grant insert, select on expect_log to authenticated;

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

select pg_temp.expect('308 concelhos', (select count(*)::integer from public.municipality), 308);
select pg_temp.expect('18 districts plus the islands', (select count(distinct district)::integer from public.municipality), 20);
select pg_temp.expect('every concelho is in Portugal',
  (select count(*)::integer from public.municipality
   where latitude not between 32 and 42.2 or longitude not between -31.5 and -6.1), 0);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('a0000000-0000-4000-8000-0000000000a1', 'home-a@test.invalid', '{"display_name":"Casa A"}', 'authenticated', 'authenticated'),
  ('b0000000-0000-4000-8000-0000000000b1', 'home-b@test.invalid', '{"display_name":"Casa B"}', 'authenticated', 'authenticated');

insert into public.profile_home (profile_id, municipality_id, usual_transport)
values ('b0000000-0000-4000-8000-0000000000b1', '1106', 'driver');

-- From here on, as A through the API role: RLS applies.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

select pg_temp.expect('A cannot see B''s concelho', (select count(*)::integer from public.profile_home), 0);

insert into public.profile_home (profile_id, municipality_id) values ('a0000000-0000-4000-8000-0000000000a1', '0603');
select pg_temp.expect('A sees their own', (select municipality_id from public.profile_home), '0603');

update public.profile_home set usual_transport = 'passenger';
select pg_temp.expect('A changes only their own',
  (select count(*)::integer from public.profile_home where usual_transport = 'passenger'), 1);

do $$
begin
  insert into public.profile_home (profile_id, municipality_id) values ('b0000000-0000-4000-8000-0000000000b1', '0603');
  raise exception 'FAILED A wrote B''s home';
exception when insufficient_privilege or unique_violation then
  insert into expect_log values ('A cannot write B''s home');
end;
$$;

do $$
begin
  update public.profile_home set usual_transport = 'bicicleta';
  raise exception 'FAILED an unknown way of going was accepted';
exception when check_violation then
  insert into expect_log values ('only the three ways of going');
end;
$$;

reset role;
select pg_temp.expect('B''s row was not touched',
  (select municipality_id || ':' || usual_transport from public.profile_home
   where profile_id = 'b0000000-0000-4000-8000-0000000000b1'), '1106:driver');

select count(*) as checks_passed from expect_log;

rollback;
