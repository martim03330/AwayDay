-- Access tests for games and stadiums: the catalogue (competition, club, venue, fixture, season, municipality,
-- fixture_meeting_point, venue_safety_note, venue_street), the admin-only meeting_point_draft, and what each person
-- says about a game (fixture_attendance, venue_review), with the aggregates fixture_going_count, venue_attendance,
-- club_away_support and club_supporter_counts.
--
-- Rules checked: the catalogue is read-only for every client role, admins included (it comes from Edge Functions and
-- migrations); attendance and reviews are private to their author; every count shown to others needs >= 5 people.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_jogos.test.sql
--
-- People: F1..F6 go to games, A is an admin, N is a fresh account.

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
  ('e4000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  'acesso-jogos-' || n || '@test.invalid',
  json_build_object('display_name', 'Jogos ' || n),
  'authenticated', 'authenticated'
from generate_series(1, 8) as n;
-- 01..06 = F1..F6, 07 = A (admin), 08 = N.
update public.profile set is_admin = true where id = 'e4000000-0000-4000-8000-000000000007';

insert into public.venue (id, name, city, country, region, location)
values ('tz-jog-estadio', 'Estádio Teste Jogos', 'Teste', 'Portugal', 'mainland', 'SRID=4326;POINT(-7.6 40.1)');
insert into public.club (id, name, short_name, abbreviation, country, primary_color, secondary_color)
values
  ('tz-jog-casa', 'Clube Casa Jogos', 'Casa', 'TJC', 'Portugal', '#112233', '#FFFFFF'),
  ('tz-jog-fora', 'Clube Fora Jogos', 'Fora', 'TJF', 'Portugal', '#332211', '#FFFFFF');
insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at, season_id)
values
  ('tz-jog-futuro', 'liga', 'Jornada teste', 'tz-jog-casa', 'tz-jog-fora', 'tz-jog-estadio', now() + interval '3 days', public.current_season_id()),
  ('tz-jog-passado', 'liga', 'Jornada teste', 'tz-jog-casa', 'tz-jog-fora', 'tz-jog-estadio', now() - interval '3 days', public.current_season_id());
insert into public.meeting_point_draft (fixture_id, club_id, source_url, source_title, excerpt)
values ('tz-jog-futuro', 'tz-jog-fora', 'https://example.invalid/noticia', 'Notícia de teste', 'Concentração às 18h.');
insert into public.place (id, name, name_article, kind, venue_id, walking_minutes, distance_m, location)
values ('tz-jog-tasco', 'Tasco dos Jogos', 'o', 'tasca', 'tz-jog-estadio', 5, 400, 'SRID=4326;POINT(-7.604 40.1)');

-- 1. The catalogue: readable, never writable by a client role.
select pg_temp.expect('catalogue tables have RLS on',
  (select count(*)::integer from pg_class
   where relnamespace = 'public'::regnamespace and relkind = 'r'
     and relname in ('competition', 'club', 'venue', 'fixture', 'season', 'municipality', 'fixture_meeting_point',
       'venue_safety_note', 'venue_street', 'meeting_point_draft', 'fixture_attendance', 'venue_review')
     and relrowsecurity), 12);
select pg_temp.expect('no client role can write the catalogue',
  (select coalesce(string_agg(t || ':' || r, ',' order by t, r), '')
   from unnest(array['competition', 'club', 'venue', 'fixture', 'season', 'municipality', 'fixture_meeting_point',
       'venue_safety_note', 'venue_street', 'meeting_point_draft']) as t,
     unnest(array['anon', 'authenticated']) as r
   where has_table_privilege(r, 'public.' || t, 'insert, update, delete, truncate')
      or exists (select 1 from information_schema.column_privileges as cp
                 where cp.table_schema = 'public' and cp.table_name = t and cp.grantee = r
                   and cp.privilege_type in ('INSERT', 'UPDATE'))),
  '');
select pg_temp.expect('without an account, everything public but the drafts is readable',
  (select string_agg(t, ',' order by t)
   from unnest(array['competition', 'club', 'venue', 'fixture', 'season', 'municipality', 'fixture_meeting_point',
       'venue_safety_note', 'venue_street', 'meeting_point_draft', 'fixture_attendance', 'venue_review']) as t
   where has_table_privilege('anon', 'public.' || t, 'select')),
  'club,competition,fixture,fixture_meeting_point,municipality,season,venue,venue_safety_note,venue_street');

set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon reads the test fixtures',
  pg_temp.visible('select * from public.fixture where venue_id = ''tz-jog-estadio'''), 2);
select pg_temp.expect('anon reads the clubs', pg_temp.visible('select * from public.club where id like ''tz-jog-%'''), 2);
select pg_temp.expect('anon reads the venue', pg_temp.visible('select * from public.venue where id = ''tz-jog-estadio'''), 1);
select pg_temp.expect('anon reads competitions', pg_temp.visible('select * from public.competition where id = ''liga'''), 1);
select pg_temp.expect('anon reads the current season', pg_temp.visible('select * from public.season where starts_on <= current_date and ends_on >= current_date'), 1);
select pg_temp.expect('anon reads the 308 concelhos', pg_temp.visible('select * from public.municipality'), 308);
select pg_temp.expect('anon reads safety notes', pg_temp.visible('select * from public.venue_safety_note') > 0, true);
select pg_temp.expect('anon reads streets', pg_temp.visible('select * from public.venue_street limit 1'), 1);
select pg_temp.expect('anon reads meeting points', pg_temp.visible('select * from public.fixture_meeting_point') >= 0, true);
select pg_temp.expect('anon cannot read meeting point drafts', pg_temp.visible('select * from public.meeting_point_draft'), -1);
select pg_temp.expect('anon cannot read attendance', pg_temp.visible('select * from public.fixture_attendance'), -1);
select pg_temp.expect('anon cannot read reviews', pg_temp.visible('select * from public.venue_review'), -1);
select pg_temp.expect('anon cannot move a kick-off',
  pg_temp.refusal('update public.fixture set kickoff_at = now() where id = ''tz-jog-futuro'''), 'permission denied for table fixture');
select pg_temp.expect('anon cannot add a club',
  pg_temp.refusal('insert into public.club (id, name, short_name, abbreviation, country, primary_color, secondary_color) values (''tz-x'', ''X'', ''X'', ''X'', ''PT'', ''#000000'', ''#000000'')'),
  'permission denied for table club');
select pg_temp.expect('anon cannot read stadium attendance', pg_temp.refusal('select public.venue_attendance()'), 'permission denied for function venue_attendance');
select pg_temp.expect('anon cannot read away support', pg_temp.refusal('select public.club_away_support()'), 'permission denied for function club_away_support');

set local role authenticated;
select pg_temp.as_user('e4000000-0000-4000-8000-000000000007');
select pg_temp.expect('the admin reads the drafts',
  pg_temp.visible('select * from public.meeting_point_draft where fixture_id = ''tz-jog-futuro'''), 1);
select pg_temp.expect('the admin cannot approve a draft through the API',
  pg_temp.refusal('update public.meeting_point_draft set status = ''approved'''), 'permission denied for table meeting_point_draft');
select pg_temp.expect('the admin cannot publish a meeting point through the API',
  pg_temp.refusal('insert into public.fixture_meeting_point (fixture_id, name, address, schedule, transport, origin, published_by, source_title, source_url, published_on) values (''tz-jog-futuro'', ''Praça'', ''Rua A'', ''18h'', ''A pé'', ''clube'', ''Clube'', ''Fonte'', ''https://example.invalid'', current_date)'),
  'permission denied for table fixture_meeting_point');
select pg_temp.expect('the admin cannot change a fixture',
  pg_temp.refusal('update public.fixture set kickoff_at = now() where id = ''tz-jog-futuro'''), 'permission denied for table fixture');
select pg_temp.expect('the admin cannot remove safety notes',
  pg_temp.refusal('delete from public.venue_safety_note'), 'permission denied for table venue_safety_note');
select pg_temp.expect('the admin cannot change a venue',
  pg_temp.refusal('update public.venue set capacity = 1'), 'permission denied for table venue');
select pg_temp.expect('the admin cannot change the season',
  pg_temp.refusal('update public.season set ends_on = current_date'), 'permission denied for table season');
select pg_temp.expect('the admin cannot change streets',
  pg_temp.refusal('delete from public.venue_street'), 'permission denied for table venue_street');
select pg_temp.expect('the admin cannot change concelhos',
  pg_temp.refusal('delete from public.municipality'), 'permission denied for table municipality');
select pg_temp.expect('the admin cannot change competitions',
  pg_temp.refusal('delete from public.competition'), 'permission denied for table competition');

select pg_temp.as_user('e4000000-0000-4000-8000-000000000008');
select pg_temp.expect('a regular person sees no drafts', pg_temp.visible('select * from public.meeting_point_draft'), 0);

-- 2. Going to a game: your own, for the future; "attended" only once it has started.
select pg_temp.as_user('e4000000-0000-4000-8000-000000000001');
select pg_temp.expect('going to a future game',
  pg_temp.refusal('insert into public.fixture_attendance (profile_id, fixture_id, status, place_id) values (''e4000000-0000-4000-8000-000000000001'', ''tz-jog-futuro'', ''going'', ''tz-jog-tasco'')'),
  'accepted');
select pg_temp.expect('"attended" before it is played is refused',
  split_part(pg_temp.refusal('update public.fixture_attendance set status = ''attended'' where fixture_id = ''tz-jog-futuro'''), ' ', 1),
  'new');
select pg_temp.expect('"going" to a game already played is refused',
  split_part(pg_temp.refusal('insert into public.fixture_attendance (profile_id, fixture_id, status) values (''e4000000-0000-4000-8000-000000000001'', ''tz-jog-passado'', ''going'')'), ' ', 1),
  'new');
select pg_temp.expect('marking someone else as going is refused',
  split_part(pg_temp.refusal('insert into public.fixture_attendance (profile_id, fixture_id, status) values (''e4000000-0000-4000-8000-000000000002'', ''tz-jog-futuro'', ''going'')'), ' ', 1),
  'new');
select pg_temp.expect('an unknown status is refused',
  split_part(pg_temp.refusal('update public.fixture_attendance set status = ''talvez'''), ' ', 1), 'new');
select pg_temp.expect('one person: no count shown', public.fixture_going_count('tz-jog-futuro'), null::integer);

reset role;
insert into public.fixture_attendance (profile_id, fixture_id, status)
select ('e4000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'tz-jog-futuro', 'going'
from generate_series(2, 4) as n;
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('four people: still no count', public.fixture_going_count('tz-jog-futuro'), null::integer);
reset role;
insert into public.fixture_attendance (profile_id, fixture_id, status) values ('e4000000-0000-4000-8000-000000000005', 'tz-jog-futuro', 'going');
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('five people: the count is shown', public.fixture_going_count('tz-jog-futuro'), 5);

set local role authenticated;
select pg_temp.as_user('e4000000-0000-4000-8000-000000000002');
select pg_temp.expect('F2 sees only F2''s attendance', pg_temp.visible('select * from public.fixture_attendance'), 1);
select pg_temp.expect('F2 does not see where F1 is watching',
  pg_temp.visible('select * from public.fixture_attendance where place_id is not null'), 0);
select pg_temp.expect('F2 cannot change F1''s attendance',
  pg_temp.affected('update public.fixture_attendance set place_id = null where profile_id = ''e4000000-0000-4000-8000-000000000001'''), 0);
select pg_temp.expect('F2 cannot remove F1''s attendance',
  pg_temp.affected('delete from public.fixture_attendance where profile_id = ''e4000000-0000-4000-8000-000000000001'''), 0);
select pg_temp.expect('F2 cannot take over F1''s row',
  split_part(pg_temp.refusal('update public.fixture_attendance set profile_id = ''e4000000-0000-4000-8000-000000000001'''), ' ', 1),
  'new');
select pg_temp.expect('F2 removes their own',
  pg_temp.affected('delete from public.fixture_attendance where profile_id = ''e4000000-0000-4000-8000-000000000002'''), 1);
select pg_temp.expect('back to four: the count is hidden again', public.fixture_going_count('tz-jog-futuro'), null::integer);
select pg_temp.as_user('e4000000-0000-4000-8000-000000000007');
select pg_temp.expect('the admin does not see who goes', pg_temp.visible('select * from public.fixture_attendance'), 0);

-- 3. Reviews: only after kick-off, only your own, private.
select pg_temp.as_user('e4000000-0000-4000-8000-000000000001');
select pg_temp.expect('reviewing a game not yet played is refused',
  split_part(pg_temp.refusal('insert into public.venue_review (profile_id, fixture_id, stadium_score, atmosphere_score, access_score) values (''e4000000-0000-4000-8000-000000000001'', ''tz-jog-futuro'', 5, 5, 5)'), ' ', 1),
  'new');
select pg_temp.expect('reviewing a game played is accepted',
  pg_temp.refusal('insert into public.venue_review (profile_id, fixture_id, stadium_score, atmosphere_score, access_score, comment) values (''e4000000-0000-4000-8000-000000000001'', ''tz-jog-passado'', 4, 5, 3, ''Bom ambiente'')'),
  'accepted');
select pg_temp.expect('a review as someone else is refused',
  split_part(pg_temp.refusal('insert into public.venue_review (profile_id, fixture_id, stadium_score, atmosphere_score, access_score) values (''e4000000-0000-4000-8000-000000000003'', ''tz-jog-passado'', 1, 1, 1)'), ' ', 1),
  'new');
select pg_temp.expect('a score of 6 is refused',
  split_part(pg_temp.refusal('update public.venue_review set stadium_score = 6'), ' ', 1), 'new');
select pg_temp.expect('a comment over 500 characters is refused',
  split_part(pg_temp.refusal(format('update public.venue_review set comment = %L', repeat('x', 501))), ' ', 1), 'new');
select pg_temp.expect('a review cannot be moved to a game not yet played',
  split_part(pg_temp.refusal('update public.venue_review set fixture_id = ''tz-jog-futuro'''), ' ', 1), 'new');
select pg_temp.as_user('e4000000-0000-4000-8000-000000000003');
select pg_temp.expect('others do not read the review', pg_temp.visible('select * from public.venue_review'), 0);
select pg_temp.expect('others cannot change the review',
  pg_temp.affected('update public.venue_review set comment = ''x'''), 0);
select pg_temp.expect('others cannot delete the review', pg_temp.affected('delete from public.venue_review'), 0);
select pg_temp.as_user('e4000000-0000-4000-8000-000000000007');
select pg_temp.expect('the admin does not read reviews', pg_temp.visible('select * from public.venue_review'), 0);
select pg_temp.as_user('e4000000-0000-4000-8000-000000000001');
select pg_temp.expect('the author reads and edits their review',
  pg_temp.affected('update public.venue_review set comment = ''Muito bom ambiente'''), 1);

-- 4. Stadium and away-support counts: >= 5 different people, signed-in only.
reset role;
insert into public.profile_club (profile_id, relation, club_id)
select ('e4000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'supporter', 'tz-jog-fora'
from generate_series(1, 4) as n;
insert into public.stadium_visit (profile_id, venue_id, fixture_id, visited_on)
select ('e4000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'tz-jog-estadio', 'tz-jog-passado',
  (now() at time zone 'Europe/Lisbon')::date - 3
from generate_series(1, 4) as n;
set local role authenticated;
select pg_temp.as_user('e4000000-0000-4000-8000-000000000008');
select pg_temp.expect('four visitors: the stadium is not listed',
  (select count(*)::integer from public.venue_attendance() where venue_id = 'tz-jog-estadio'), 0);
select pg_temp.expect('four away fans: the club is not listed',
  (select count(*)::integer from public.club_away_support() where club_id = 'tz-jog-fora'), 0);
select pg_temp.expect('four supporters: the club count is not shown',
  (select count(*)::integer from public.club_supporter_counts() where club_id = 'tz-jog-fora'), 0);
reset role;
insert into public.profile_club (profile_id, relation, club_id) values ('e4000000-0000-4000-8000-000000000005', 'supporter', 'tz-jog-fora');
insert into public.stadium_visit (profile_id, venue_id, fixture_id, visited_on)
values ('e4000000-0000-4000-8000-000000000005', 'tz-jog-estadio', 'tz-jog-passado', (now() at time zone 'Europe/Lisbon')::date - 3);
set local role authenticated;
select pg_temp.as_user('e4000000-0000-4000-8000-000000000008');
select pg_temp.expect('five visitors: the stadium is listed',
  (select people || '/' || visits from public.venue_attendance() where venue_id = 'tz-jog-estadio'), '5/5');
select pg_temp.expect('five away fans: the club is listed',
  (select people from public.club_away_support() where club_id = 'tz-jog-fora'), 5);
select pg_temp.expect('five supporters: the club count is shown',
  (select supporters from public.club_supporter_counts() where club_id = 'tz-jog-fora'), 5::bigint);
select pg_temp.expect('no stadium anywhere is listed under 5 people',
  (select count(*)::integer from public.venue_attendance() where people < 5), 0);
select pg_temp.expect('no away support anywhere is listed under 5 people',
  (select count(*)::integer from public.club_away_support() where people < 5), 0);
select pg_temp.expect('no club anywhere shows fewer than 5 supporters',
  (select count(*)::integer from public.club_supporter_counts() where supporters < 5), 0);
select pg_temp.expect('a fan of the club cannot read who the others are',
  pg_temp.visible('select * from public.profile_club where club_id = ''tz-jog-fora'''), 0);
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('supporter counts are public (already >= 5)',
  (select supporters from public.club_supporter_counts() where club_id = 'tz-jog-fora'), 5::bigint);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
