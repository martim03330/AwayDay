-- Access tests for "adeptos da casa" signals: home_fan_report (raw, per person), home_fan_cell and home_fan_rollup
-- (history per stadium), and the RPCs report_home_fans, home_fan_zones and home_fan_usual_streets.
--
-- Rules checked (docs/DECISOES.md, 2026-09-16): the server keeps a ~150 m cell, never the position; nobody reads who
-- reported; a zone shows from 5 different people and only up to 6 h after kick-off; reports are deleted 48 h after
-- the game; a usual street shows only from 5 different people and 2 different games.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails. The check that
-- currently exposes a bug is at the end, so everything else still runs first.
--
--   supabase db query --linked -f supabase/tests/acesso_adeptos_casa.test.sql
--
-- People: R1..R8 report, N is a fresh account, A is an admin.

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
  ('e5000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  'acesso-casa-' || n || '@test.invalid',
  json_build_object('display_name', 'Casa ' || n),
  'authenticated', 'authenticated'
from generate_series(1, 10) as n;
-- 01..08 = R1..R8, 09 = N, 10 = A (admin).
update public.profile set is_admin = true where id = 'e5000000-0000-4000-8000-000000000010';

create function pg_temp.r(n integer)
returns uuid
language sql
as $$
  select ('e5000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid;
$$;

insert into public.venue (id, name, city, country, region, location)
values ('tz-hf-estadio', 'Estádio Teste Casa', 'Teste', 'Portugal', 'mainland', 'SRID=4326;POINT(-7.8 40.3)');
insert into public.club (id, name, short_name, abbreviation, country, primary_color, secondary_color)
values
  ('tz-hf-casa', 'Clube Casa Sinais', 'Casa', 'THC', 'Portugal', '#112233', '#FFFFFF'),
  ('tz-hf-fora', 'Clube Fora Sinais', 'Fora', 'THF', 'Portugal', '#332211', '#FFFFFF');
insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at, season_id)
select id, 'liga', 'Jornada teste', 'tz-hf-casa', 'tz-hf-fora', 'tz-hf-estadio', now() + delta, public.current_season_id()
from (values
  ('tz-hf-agora', interval '1 hour'),
  ('tz-hf-longe', interval '10 hours'),
  ('tz-hf-j1', interval '-8 hours'),
  ('tz-hf-j2', interval '-30 hours'),
  ('tz-hf-j3', interval '-50 hours'),
  ('tz-hf-j4', interval '-70 hours'),
  ('tz-hf-velho', interval '-49 hours'),
  ('tz-hf-recente', interval '-47 hours')
) as v(id, delta);
-- Two streets, one next to each cell used below.
insert into public.venue_street (venue_id, osm_id, name, path)
values
  ('tz-hf-estadio', 'way/999999101', 'Rua dos Cinco', 'SRID=4326;LINESTRING(-7.8005 40.302, -7.7995 40.302)'),
  ('tz-hf-estadio', 'way/999999102', 'Rua dos Tres', 'SRID=4326;LINESTRING(-7.8005 40.29, -7.7995 40.29)');

-- 1. The tables are closed to every client role.
select pg_temp.expect('RLS on the three tables',
  (select count(*)::integer from pg_class
   where oid in ('public.home_fan_report'::regclass, 'public.home_fan_cell'::regclass, 'public.home_fan_rollup'::regclass)
     and relrowsecurity), 3);
select pg_temp.expect('no client role has any privilege on them',
  (select coalesce(string_agg(t || ':' || r, ','), '')
   from unnest(array['home_fan_report', 'home_fan_cell', 'home_fan_rollup']) as t, unnest(array['anon', 'authenticated']) as r
   where has_table_privilege(r, 'public.' || t, 'select, insert, update, delete, truncate')),
  '');
select pg_temp.expect('the report keeps a cell, not a position',
  (select string_agg(column_name::text, ',' order by column_name) from information_schema.columns
   where table_schema = 'public' and table_name = 'home_fan_report'),
  'cell_latitude,cell_longitude,created_at,fixture_id,reporter_id');
select pg_temp.expect('the jobs are not callable by clients',
  has_function_privilege('authenticated', 'public.roll_up_home_fan_reports()', 'execute')
  or has_function_privilege('authenticated', 'public.delete_old_home_fan_reports()', 'execute')
  or has_function_privilege('anon', 'public.roll_up_home_fan_reports()', 'execute'), false);
select pg_temp.expect('a zone says where and how many, never who',
  (select pg_get_function_result('public.home_fan_zones(text)'::regprocedure)),
  'TABLE(latitude double precision, longitude double precision, reporters integer)');
select pg_temp.expect('the jobs are scheduled',
  (select string_agg(jobname || ' ' || schedule || ' ' || active, ',' order by jobname) from cron.job
   where jobname in ('roll-up-home-fan-reports', 'delete-old-home-fan-reports')),
  'delete-old-home-fan-reports 41 * * * * true,roll-up-home-fan-reports 11 * * * * true');

-- 2. Reporting.
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon cannot report',
  pg_temp.refusal('select public.report_home_fans(''tz-hf-agora'', 40.3021, -7.8001)'), 'permission denied for function report_home_fans');
select pg_temp.expect('anon cannot read reports', pg_temp.visible('select * from public.home_fan_report'), -1);
select pg_temp.expect('anon cannot read cells', pg_temp.visible('select * from public.home_fan_cell'), -1);
select pg_temp.expect('anon reads no zone yet', (select count(*)::integer from public.home_fan_zones('tz-hf-agora')), 0);

set local role authenticated;
select pg_temp.as_user(pg_temp.r(1)::text);
select pg_temp.expect('unknown game', pg_temp.refusal('select public.report_home_fans(''nao-existe'', 40.3021, -7.8001)'), 'fixture_not_found');
select pg_temp.expect('too long before kick-off',
  pg_temp.refusal('select public.report_home_fans(''tz-hf-longe'', 40.3021, -7.8001)'), 'outside_window');
select pg_temp.expect('too long after kick-off',
  pg_temp.refusal('select public.report_home_fans(''tz-hf-j1'', 40.3021, -7.8001)'), 'outside_window');
select pg_temp.expect('more than 3 km from the stadium',
  pg_temp.refusal('select public.report_home_fans(''tz-hf-agora'', 40.4, -7.8)'), 'too_far');
select pg_temp.expect('a report near the stadium is accepted',
  pg_temp.refusal('select public.report_home_fans(''tz-hf-agora'', 40.3021, -7.8001)'), 'accepted');
select pg_temp.expect('the same cell twice is not counted twice',
  pg_temp.refusal('select public.report_home_fans(''tz-hf-agora'', 40.30205, -7.80005)'), 'accepted');
select pg_temp.expect('the reporter cannot read their own report', pg_temp.visible('select * from public.home_fan_report'), -1);
select pg_temp.expect('the reporter cannot write a report directly',
  pg_temp.refusal('insert into public.home_fan_report (fixture_id, reporter_id, cell_latitude, cell_longitude) values (''tz-hf-agora'', ''e5000000-0000-4000-8000-000000000002'', 40.302, -7.8)'),
  'permission denied for table home_fan_report');
select pg_temp.expect('the reporter cannot fake history',
  pg_temp.refusal('insert into public.home_fan_cell (venue_id, cell_latitude, cell_longitude, fixtures, reporters) values (''tz-hf-estadio'', 40.302, -7.8, 9, 99)'),
  'permission denied for table home_fan_cell');
select pg_temp.expect('the reporter cannot run the roll-up',
  pg_temp.refusal('select public.roll_up_home_fan_reports()'), 'permission denied for function roll_up_home_fan_reports');

reset role;
select pg_temp.expect('one row, a rounded cell and not the position',
  (select count(*) || ' ' || min(cell_latitude) || ' ' || min(cell_longitude) from public.home_fan_report where fixture_id = 'tz-hf-agora'),
  '1 40.3020 -7.8000');

-- 3. A zone needs 5 different people (every aggregate in the app does).
set local role authenticated;
select pg_temp.as_user(pg_temp.r(2)::text);
select public.report_home_fans('tz-hf-agora', 40.3019, -7.7999);
select pg_temp.expect('two people: no zone', (select count(*)::integer from public.home_fan_zones('tz-hf-agora')), 0);
select pg_temp.as_user(pg_temp.r(3)::text);
select public.report_home_fans('tz-hf-agora', 40.3022, -7.8003);
select pg_temp.expect('three people: still no zone', (select count(*)::integer from public.home_fan_zones('tz-hf-agora')), 0);
select pg_temp.expect('a report in another cell does not add up',
  pg_temp.refusal('select public.report_home_fans(''tz-hf-agora'', 40.296, -7.8)'), 'accepted');
select pg_temp.as_user(pg_temp.r(5)::text);
select public.report_home_fans('tz-hf-agora', 40.3020, -7.8001);
select pg_temp.expect('four people: still no zone', (select count(*)::integer from public.home_fan_zones('tz-hf-agora')), 0);
select pg_temp.as_user(pg_temp.r(6)::text);
select public.report_home_fans('tz-hf-agora', 40.3021, -7.8002);
select pg_temp.as_user(pg_temp.r(9)::text);
select pg_temp.expect('five people: a zone, with only the cell and the count',
  (select string_agg(latitude || ' ' || longitude || ' ' || reporters, ',') from public.home_fan_zones('tz-hf-agora')),
  '40.302 -7.8 5');
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon sees the same zone', (select count(*)::integer from public.home_fan_zones('tz-hf-agora')), 1);

-- 4. Rate limit: 10 an hour.
reset role;
insert into public.rate_limit_hit (profile_id, bucket) select pg_temp.r(4), 'home-fan-report' from generate_series(1, 10);
set local role authenticated;
select pg_temp.as_user(pg_temp.r(4)::text);
select pg_temp.expect('the 11th report in an hour is refused',
  pg_temp.refusal('select public.report_home_fans(''tz-hf-agora'', 40.3021, -7.8001)'), 'rate_limited');

-- 5. After the game: zones disappear 6 h after kick-off; history is rolled up; raw reports go after 48 h.
reset role;
insert into public.home_fan_report (fixture_id, reporter_id, cell_latitude, cell_longitude)
select 'tz-hf-j1', pg_temp.r(n), 40.302, -7.8 from generate_series(1, 5) as n
union all
select 'tz-hf-j1', pg_temp.r(n), 40.29, -7.8 from generate_series(1, 5) as n
union all
-- Four people in a third cell: never enough.
select 'tz-hf-j1', pg_temp.r(n), 40.3095, -7.8 from generate_series(6, 9) as n;
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('8 h after kick-off: no zones', (select count(*)::integer from public.home_fan_zones('tz-hf-j1')), 0);

reset role;
select public.roll_up_home_fan_reports();
select pg_temp.expect('after one game: two cells, the small one left out',
  (select string_agg(cell_latitude || ':' || fixtures || ':' || reporters, ',' order by cell_latitude)
   from public.home_fan_cell where venue_id = 'tz-hf-estadio'),
  '40.2900:1:5,40.3020:1:5');
select public.roll_up_home_fan_reports();
select pg_temp.expect('a game is rolled up only once',
  (select sum(fixtures)::integer from public.home_fan_cell where venue_id = 'tz-hf-estadio'), 2);

set local role authenticated;
select pg_temp.as_user(pg_temp.r(9)::text);
select pg_temp.expect('one game: no usual street', (select count(*)::integer from public.home_fan_usual_streets('tz-hf-estadio')), 0);

-- A second game, five other people in the first cell: 10 different people over 2 games.
reset role;
insert into public.home_fan_report (fixture_id, reporter_id, cell_latitude, cell_longitude)
select 'tz-hf-j2', pg_temp.r(n), 40.302, -7.8 from generate_series(6, 10) as n;
select public.roll_up_home_fan_reports();
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('two games, ten people: the street shows, without anyone',
  (select string_agg(name || ' ' || fixtures, ',') from public.home_fan_usual_streets('tz-hf-estadio') where name = 'Rua dos Cinco'),
  'Rua dos Cinco 2');
select pg_temp.expect('anon cannot read the cells behind it', pg_temp.visible('select * from public.home_fan_cell'), -1);
set local role authenticated;
select pg_temp.as_user(pg_temp.r(10)::text);
select pg_temp.expect('the admin cannot read reports either', pg_temp.visible('select * from public.home_fan_report'), -1);
select pg_temp.expect('the admin cannot read cells either', pg_temp.visible('select * from public.home_fan_cell'), -1);

reset role;
insert into public.home_fan_report (fixture_id, reporter_id, cell_latitude, cell_longitude)
values ('tz-hf-velho', pg_temp.r(1), 40.31, -7.79), ('tz-hf-recente', pg_temp.r(1), 40.31, -7.79);
select public.delete_old_home_fan_reports();
select pg_temp.expect('reports of a game 49 h ago are deleted',
  (select count(*)::integer from public.home_fan_report where fixture_id = 'tz-hf-velho'), 0);
select pg_temp.expect('reports of a game 47 h ago are kept',
  (select count(*)::integer from public.home_fan_report where fixture_id = 'tz-hf-recente'), 1);
select pg_temp.expect('no report anywhere outlives its game by 48 h',
  (select count(*)::integer from public.home_fan_report as r join public.fixture as f on f.id = r.fixture_id
   where f.kickoff_at < now() - interval '48 hours'), 0);

-- 6. A game only counts for a cell with 5 different people, so a usual street always rests on 5 or more different
--    people (CLAUDE.md; DECISOES 2026-09-16: «5 pessoas diferentes e 2 jogos diferentes»).
reset role;
insert into public.home_fan_report (fixture_id, reporter_id, cell_latitude, cell_longitude)
select 'tz-hf-j2', pg_temp.r(n), 40.29, -7.8 from generate_series(1, 3) as n;
delete from public.home_fan_rollup where fixture_id = 'tz-hf-j2';
delete from public.home_fan_cell where venue_id = 'tz-hf-estadio' and cell_latitude = 40.302;
select public.roll_up_home_fan_reports();
select pg_temp.expect('a game with only three people does not count for the cell',
  (select fixtures || ':' || reporters from public.home_fan_cell where venue_id = 'tz-hf-estadio' and cell_latitude = 40.29), '1:5');
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('one counted game does not make a usual street',
  (select count(*)::integer from public.home_fan_usual_streets('tz-hf-estadio') where name = 'Rua dos Tres'), 0);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
