-- Access tests for being at the stadium: stadium_visit (stamps) and noise_measurement, with the RPCs stamp_stadium,
-- my_stadium_stamps, stadium_ranking, record_noise_measurement and noise_ranking.
--
-- Rules checked: a stamp only comes from stamp_stadium (near the stadium, around kick-off), never from a direct write;
-- the position is not stored; noise only from someone who is there (stamped today, or a verified check-in in one of
-- this stadium's tascos) while the game is on; each person reads only their own rows; rankings only list people who
-- opted in.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_estadio_barulho.test.sql
--
-- People: S stamps (in the rankings), O stamps (not in the rankings), C checked in at a tasco, M only has a manual
-- visit, A is an admin, N is a fresh account.

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
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

create function pg_temp.as_anon()
returns void
language sql
as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
select
  ('e6000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  'acesso-estadio-' || n || '@test.invalid',
  json_build_object('display_name', 'Estadio ' || n),
  'authenticated', 'authenticated'
from generate_series(1, 6) as n;
-- 01 = S, 02 = O, 03 = C, 04 = M, 05 = A (admin), 06 = N.
-- Appearing is on by default: everyone but S turned it off here.
update public.profile set show_in_rankings = (id = 'e6000000-0000-4000-8000-000000000001')
where id::text like 'e6000000-%';
update public.profile set is_admin = true where id = 'e6000000-0000-4000-8000-000000000005';

insert into public.venue (id, name, city, country, region, location)
values ('tz-est-estadio', 'Estádio Teste Carimbo', 'Teste', 'Portugal', 'mainland', 'SRID=4326;POINT(-8.0 40.5)');
insert into public.club (id, name, short_name, abbreviation, country, primary_color, secondary_color)
values
  ('tz-est-casa', 'Clube Casa Carimbo', 'Casa', 'TEC', 'Portugal', '#112233', '#FFFFFF'),
  ('tz-est-fora', 'Clube Fora Carimbo', 'Fora', 'TEF', 'Portugal', '#332211', '#FFFFFF');
insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at, season_id)
values
  ('tz-est-agora', 'liga', 'Jornada teste', 'tz-est-casa', 'tz-est-fora', 'tz-est-estadio', now() - interval '1 minute', public.current_season_id()),
  ('tz-est-logo', 'liga', 'Jornada teste', 'tz-est-casa', 'tz-est-fora', 'tz-est-estadio', now() + interval '2 hours', public.current_season_id()),
  ('tz-est-amanha', 'liga', 'Jornada teste', 'tz-est-casa', 'tz-est-fora', 'tz-est-estadio', now() + interval '1 day', public.current_season_id());
insert into public.place (id, name, name_article, kind, venue_id, walking_minutes, distance_m, location)
values ('tz-est-tasco', 'Tasco do Carimbo', 'o', 'tasca', 'tz-est-estadio', 5, 400, 'SRID=4326;POINT(-8.004 40.5)');
insert into public.profile_club (profile_id, relation, club_id) values ('e6000000-0000-4000-8000-000000000001', 'supporter', 'tz-est-fora');

select pg_temp.expect('RLS on both tables',
  (select count(*)::integer from pg_class
   where oid in ('public.stadium_visit'::regclass, 'public.noise_measurement'::regclass) and relrowsecurity), 2);
select pg_temp.expect('stadium_visit is closed to every client role',
  has_table_privilege('anon', 'public.stadium_visit', 'select, insert, update, delete')
  or has_table_privilege('authenticated', 'public.stadium_visit', 'select, insert, update, delete'), false);
select pg_temp.expect('noise_measurement is read-only, own rows',
  has_table_privilege('authenticated', 'public.noise_measurement', 'insert, update, delete')
  or has_table_privilege('anon', 'public.noise_measurement', 'select, insert, update, delete'), false);
select pg_temp.expect('a stamp keeps no position',
  (select count(*)::integer from information_schema.columns
   where table_schema = 'public' and table_name in ('stadium_visit', 'noise_measurement')
     and column_name ~ '(lat|lon|lng|location|geo|point|distance)'), 0);

-- 1. Without an account.
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon cannot stamp',
  pg_temp.refusal('select public.stamp_stadium(''tz-est-agora'', 40.5005, -8.0)'), 'permission denied for function stamp_stadium');
select pg_temp.expect('anon has no stamps', pg_temp.refusal('select public.my_stadium_stamps()'), 'permission denied for function my_stadium_stamps');
select pg_temp.expect('anon cannot read the stadium ranking',
  pg_temp.refusal('select public.stadium_ranking(10)'), 'permission denied for function stadium_ranking');
select pg_temp.expect('anon cannot measure noise',
  pg_temp.refusal('select public.record_noise_measurement(''tz-est-agora'', 80)'), 'permission denied for function record_noise_measurement');
select pg_temp.expect('anon cannot read the noise ranking',
  pg_temp.refusal('select public.noise_ranking(''tz-est-agora'', 10)'), 'permission denied for function noise_ranking');
select pg_temp.expect('anon cannot read stamps', pg_temp.visible('select * from public.stadium_visit'), -1);
select pg_temp.expect('anon cannot read noise', pg_temp.visible('select * from public.noise_measurement'), -1);

-- 2. Stamping: only through stamp_stadium.
set local role authenticated;
select pg_temp.as_user('e6000000-0000-4000-8000-000000000001');
select pg_temp.expect('a stamp cannot be written directly',
  pg_temp.refusal('insert into public.stadium_visit (profile_id, venue_id, visited_on) values (''e6000000-0000-4000-8000-000000000001'', ''tz-est-estadio'', current_date)'),
  'permission denied for table stadium_visit');
select pg_temp.expect('no position', pg_temp.refusal('select public.stamp_stadium(''tz-est-agora'', null, -8.0)'), 'bad_location');
select pg_temp.expect('impossible position', pg_temp.refusal('select public.stamp_stadium(''tz-est-agora'', 40.5, -181)'), 'bad_location');
select pg_temp.expect('unknown game', pg_temp.refusal('select public.stamp_stadium(''nao-existe'', 40.5005, -8.0)'), 'fixture_not_found');
select pg_temp.expect('too early (a day before)',
  pg_temp.refusal('select public.stamp_stadium(''tz-est-amanha'', 40.5005, -8.0)'), 'outside_window');
select pg_temp.expect('too far (2 km)',
  pg_temp.refusal('select public.stamp_stadium(''tz-est-agora'', 40.518, -8.0)'), 'too_far');
select pg_temp.expect('next to the stadium: stamped, distance rounded to 100 m',
  public.stamp_stadium('tz-est-agora', 40.5005, -8.0), 100);
select pg_temp.expect('a second game the same day keeps one stamp',
  public.stamp_stadium('tz-est-logo', 40.5004, -8.0001), 0);
select pg_temp.expect('S sees one stamp of their own',
  (select venue_id || ' ' || visits from public.my_stadium_stamps()), 'tz-est-estadio 1');
select pg_temp.expect('the stamp also marks the game as attended, for S only',
  (select string_agg(fixture_id || ':' || status, ',' order by fixture_id) from public.fixture_attendance),
  'tz-est-agora:attended,tz-est-logo:attended');

select pg_temp.as_user('e6000000-0000-4000-8000-000000000002');
select pg_temp.expect('O has no stamps', (select count(*)::integer from public.my_stadium_stamps()), 0);
select public.stamp_stadium('tz-est-agora', 40.5001, -8.0);
select pg_temp.expect('O does not see S''s stamp', (select count(*)::integer from public.my_stadium_stamps()), 1);
select pg_temp.expect('O sees S in the ranking (S opted in)',
  (select count(*)::integer from public.stadium_ranking(100) where profile_id = 'e6000000-0000-4000-8000-000000000001'), 1);
select pg_temp.expect('O sees themself in the ranking',
  (select count(*)::integer from public.stadium_ranking(100) where is_me), 1);

select pg_temp.as_user('e6000000-0000-4000-8000-000000000006');
select pg_temp.expect('N does not see O in the ranking (O did not opt in)',
  (select count(*)::integer from public.stadium_ranking(100) where profile_id = 'e6000000-0000-4000-8000-000000000002'), 0);
select pg_temp.as_user('e6000000-0000-4000-8000-000000000005');
select pg_temp.expect('the admin cannot read stamps either', pg_temp.visible('select * from public.stadium_visit'), -1);
select pg_temp.expect('the admin cannot stamp for someone',
  pg_temp.refusal('insert into public.stadium_visit (profile_id, venue_id, visited_on) values (''e6000000-0000-4000-8000-000000000006'', ''tz-est-estadio'', current_date)'),
  'permission denied for table stadium_visit');

reset role;
insert into public.rate_limit_hit (profile_id, bucket) select 'e6000000-0000-4000-8000-000000000006', 'stadium-stamp' from generate_series(1, 10);
set local role authenticated;
select pg_temp.as_user('e6000000-0000-4000-8000-000000000006');
select pg_temp.expect('the 11th stamp attempt of the day is refused',
  pg_temp.refusal('select public.stamp_stadium(''tz-est-agora'', 40.5005, -8.0)'), 'rate_limited');

-- 3. Noise: only from someone who is there, while the game is on.
select pg_temp.as_user('e6000000-0000-4000-8000-000000000001');
select pg_temp.expect('noise cannot be written directly',
  pg_temp.refusal('insert into public.noise_measurement (profile_id, fixture_id, level) values (''e6000000-0000-4000-8000-000000000001'', ''tz-est-agora'', 100)'),
  'permission denied for table noise_measurement');
select pg_temp.expect('a game not yet started is not live',
  pg_temp.refusal('select public.record_noise_measurement(''tz-est-logo'', 80)'), 'fixture_not_live');
select pg_temp.expect('over 100 is refused',
  pg_temp.refusal('select public.record_noise_measurement(''tz-est-agora'', 101)'), 'noise_level_out_of_range');
select pg_temp.expect('below 0 is refused',
  pg_temp.refusal('select public.record_noise_measurement(''tz-est-agora'', -1)'), 'noise_level_out_of_range');
select pg_temp.expect('unknown game', pg_temp.refusal('select public.record_noise_measurement(''nao-existe'', 50)'), 'fixture_not_found');
select pg_temp.expect('S, stamped today, measures',
  (select profile_id || ' ' || level from public.record_noise_measurement('tz-est-agora', 88)),
  'e6000000-0000-4000-8000-000000000001 88');
select pg_temp.expect('a second reading within 8 minutes is refused',
  pg_temp.refusal('select public.record_noise_measurement(''tz-est-agora'', 95)'), 'noise_measurement_too_soon');

select pg_temp.as_user('e6000000-0000-4000-8000-000000000006');
select pg_temp.expect('N, not there, is refused',
  pg_temp.refusal('select public.record_noise_measurement(''tz-est-agora'', 70)'), 'noise_needs_presence');

reset role;
insert into public.place_visit (profile_id, place_id, source) values ('e6000000-0000-4000-8000-000000000004', 'tz-est-tasco', 'manual');
select public.start_checkin('e6000000-0000-4000-8000-000000000003', 'tz-est-tasco');
set local role authenticated;
select pg_temp.as_user('e6000000-0000-4000-8000-000000000004');
select pg_temp.expect('a manual visit is not presence',
  pg_temp.refusal('select public.record_noise_measurement(''tz-est-agora'', 70)'), 'noise_needs_presence');
select pg_temp.as_user('e6000000-0000-4000-8000-000000000003');
select pg_temp.expect('a verified check-in in a tasco of this stadium is presence',
  pg_temp.refusal('select public.record_noise_measurement(''tz-est-agora'', 75)'), 'accepted');
select pg_temp.expect('C reads only C''s reading', (select string_agg(level::text, ',') from public.noise_measurement), '75');
select pg_temp.expect('C cannot change a reading',
  pg_temp.refusal('update public.noise_measurement set level = 100'), 'permission denied for table noise_measurement');
select pg_temp.expect('C cannot delete a reading',
  pg_temp.refusal('delete from public.noise_measurement'), 'permission denied for table noise_measurement');
select pg_temp.expect('the noise ranking shows S (opted in) and C to C only as "me"',
  (select string_agg(display_name || ':' || is_me || ':' || coalesce(club_id, '-') || ':' || level, ',' order by rank_position)
   from public.noise_ranking('tz-est-agora', 10)),
  'Estadio 1:false:tz-est-fora:88,Estadio 3:true:-:75');
select pg_temp.as_user('e6000000-0000-4000-8000-000000000006');
select pg_temp.expect('N sees only the person who opted in',
  (select string_agg(display_name, ',') from public.noise_ranking('tz-est-agora', 10)), 'Estadio 1');
select pg_temp.as_user('e6000000-0000-4000-8000-000000000005');
select pg_temp.expect('the admin does not read people''s readings', pg_temp.visible('select * from public.noise_measurement'), 0);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
