-- Access tests for gamification tables: mission, weekly_challenge, season_division, season_closing (and season, read
-- by everyone). The ranking functions themselves are in ranking.test.sql; this file covers who can read and write the
-- tables and the jobs that fill them.
--
-- Rules checked: missions and challenges are a catalogue only the server writes; next week's challenges are visible,
-- later ones are not; each person sees only their own division; season closing is server-only.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_missoes.test.sql
--
-- People: P has a division, Q has another, A is an admin, N is a fresh account.

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
  insert into expect_log values (p_name);
end;
$$;

-- Runs a statement and returns 'accepted', or the error message when it is refused.
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

-- Runs a statement and returns how many rows it touched (RLS silently skips rows it hides).
create function pg_temp.affected(p_sql text)
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Counts rows of a query as the current role, or returns -1 when the role may not run it at all.
create function pg_temp.visible(p_sql text)
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  execute 'select count(*)::integer from (' || p_sql || ') as q' into n;
  return n;
exception when insufficient_privilege then
  return -1;
end;
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

insert into auth.users (id, email, raw_user_meta_data, aud, role)
select
  ('e7000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  'acesso-missoes-' || n || '@test.invalid',
  json_build_object('display_name', 'Missoes ' || n),
  'authenticated', 'authenticated'
from generate_series(1, 4) as n;
-- 01 = P, 02 = Q, 03 = A (admin), 04 = N.
update public.profile set is_admin = true where id = 'e7000000-0000-4000-8000-000000000003';

insert into public.season_division (profile_id, season_id, division)
values
  ('e7000000-0000-4000-8000-000000000001', public.current_season_id(), 3),
  ('e7000000-0000-4000-8000-000000000002', public.current_season_id(), 1);

-- A challenge three weeks ahead (beyond what is shown), using any weekly mission.
create temporary table t_week (this_week date, far_week date) on commit drop;
grant select on t_week to authenticated, anon;
insert into t_week values (
  date_trunc('week', now() at time zone 'Europe/Lisbon')::date,
  date_trunc('week', now() at time zone 'Europe/Lisbon')::date + 21);
insert into public.weekly_challenge (week_start, slot, mission_id)
select (select far_week from t_week), 1, m.id from public.mission as m where m.kind = 'weekly' and m.active order by m.id limit 1
on conflict do nothing;

select pg_temp.expect('RLS on the four tables',
  (select count(*)::integer from pg_class
   where oid in ('public.mission'::regclass, 'public.weekly_challenge'::regclass, 'public.season_division'::regclass,
     'public.season_closing'::regclass)
     and relrowsecurity), 4);
select pg_temp.expect('no client role writes any of them',
  (select coalesce(string_agg(t || ':' || r, ','), '')
   from unnest(array['mission', 'weekly_challenge', 'season_division', 'season_closing', 'season']) as t,
     unnest(array['anon', 'authenticated']) as r
   where has_table_privilege(r, 'public.' || t, 'insert, update, delete, truncate')),
  '');
select pg_temp.expect('season_closing is not readable by anyone',
  has_table_privilege('anon', 'public.season_closing', 'select') or has_table_privilege('authenticated', 'public.season_closing', 'select'),
  false);
select pg_temp.expect('the season jobs are not callable by clients',
  (select coalesce(string_agg(f, ','), '')
   from unnest(array['public.close_finished_seasons()', 'public.plan_weekly_challenges()']) as f,
     unnest(array['anon', 'authenticated']) as r
   where has_function_privilege(r, f, 'execute')),
  '');
select pg_temp.expect('the jobs are scheduled daily',
  (select string_agg(jobname || ' ' || active, ',' order by jobname) from cron.job
   where jobname in ('close-finished-seasons', 'plan-weekly-challenges')),
  'close-finished-seasons true,plan-weekly-challenges true');
select pg_temp.expect('the setup has a far challenge', (select count(*)::integer from public.weekly_challenge where week_start = (select far_week from t_week)) >= 1, true);

-- 1. Without an account: only the season.
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon reads the seasons', pg_temp.visible('select * from public.season') > 0, true);
select pg_temp.expect('anon cannot read missions', pg_temp.visible('select * from public.mission'), -1);
select pg_temp.expect('anon cannot read challenges', pg_temp.visible('select * from public.weekly_challenge'), -1);
select pg_temp.expect('anon cannot read divisions', pg_temp.visible('select * from public.season_division'), -1);
select pg_temp.expect('anon cannot read closings', pg_temp.visible('select * from public.season_closing'), -1);
select pg_temp.expect('anon has no missions', pg_temp.refusal('select public.my_missions()'), 'permission denied for function my_missions');
select pg_temp.expect('anon cannot close a season',
  pg_temp.refusal('select public.close_finished_seasons()'), 'permission denied for function close_finished_seasons');

-- 2. Signed in.
set local role authenticated;
select pg_temp.as_user('e7000000-0000-4000-8000-000000000001');
select pg_temp.expect('P reads the missions', pg_temp.visible('select * from public.mission') > 0, true);
select pg_temp.expect('P cannot add a mission',
  pg_temp.refusal('insert into public.mission (id, kind, family, tier, metric, target, xp, title, description, badge, icon) values (''tz-batota'', ''achievement'', ''x'', 1, ''review'', 1, 5000, ''Batota'', ''Batota'', ''Batota'', ''star'')'),
  'permission denied for table mission');
select pg_temp.expect('P cannot make a mission easier',
  pg_temp.refusal('update public.mission set target = 1'), 'permission denied for table mission');
select pg_temp.expect('P sees no challenge beyond next week',
  pg_temp.visible('select * from public.weekly_challenge where week_start > (select this_week + 7 from t_week)'), 0);
select pg_temp.expect('P cannot pick the challenges',
  pg_temp.refusal('delete from public.weekly_challenge'), 'permission denied for table weekly_challenge');
select pg_temp.expect('P sees only P''s division',
  (select string_agg(profile_id || ':' || division, ',') from public.season_division), 'e7000000-0000-4000-8000-000000000001:3');
select pg_temp.expect('P cannot promote themself',
  pg_temp.refusal('update public.season_division set division = 1'), 'permission denied for table season_division');
select pg_temp.expect('P cannot add a division',
  pg_temp.refusal('insert into public.season_division (profile_id, season_id, division) values (''e7000000-0000-4000-8000-000000000004'', ''2026-27'', 1)'),
  'permission denied for table season_division');
select pg_temp.expect('P cannot close a season',
  pg_temp.refusal('select public.close_finished_seasons()'), 'permission denied for function close_finished_seasons');
select pg_temp.expect('P cannot plan challenges',
  pg_temp.refusal('select public.plan_weekly_challenges()'), 'permission denied for function plan_weekly_challenges');
select pg_temp.expect('my_missions never lists a challenge beyond next week',
  (select count(*)::integer from public.my_missions() where week_start > (select this_week + 7 from t_week)), 0);
select pg_temp.expect('my_missions lists the active achievements',
  (select count(*)::integer from public.my_missions() where kind = 'achievement')
  = (select count(*)::integer from public.mission where kind = 'achievement' and active), true);

select pg_temp.as_user('e7000000-0000-4000-8000-000000000004');
select pg_temp.expect('a fresh account has no division', pg_temp.visible('select * from public.season_division'), 0);
select pg_temp.expect('a fresh account starts with no progress',
  (select count(*)::integer from public.my_missions() where progress > 0 or completed_at is not null), 0);

select pg_temp.as_user('e7000000-0000-4000-8000-000000000003');
select pg_temp.expect('the admin sees only their own division (none)', pg_temp.visible('select * from public.season_division'), 0);
select pg_temp.expect('the admin cannot read closings', pg_temp.visible('select * from public.season_closing'), -1);
select pg_temp.expect('the admin cannot change missions',
  pg_temp.refusal('update public.mission set xp = 1'), 'permission denied for table mission');

reset role;
select count(*) as checks_passed from expect_log;

rollback;
