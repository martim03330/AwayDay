-- Access tests for tascos and what people say about them: place, place_candidate, place_vote, place_rating,
-- place_toilet_answer, restroom, and the RPCs suggest_place, place_scores, place_scores_all, share_place_with_group.
--
-- Rules checked: the catalogue is read-only for clients (places only come in through suggest_place, which decides
-- everything on the server); hidden (rejected) places are invisible; each person only sees and changes their own
-- votes, ratings and toilet answers; counts and averages are computed on the server, and averages only appear
-- from 5 ratings.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_locais.test.sql
--
-- People: S suggests a tasco, V1..V6 vote and rate, A is an admin, N is a fresh account.

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
  ('e2000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  'acesso-locais-' || n || '@test.invalid',
  json_build_object('display_name', 'Locais ' || n),
  'authenticated', 'authenticated'
from generate_series(1, 9) as n;
-- 01 = S, 02..07 = V1..V6, 08 = A (admin), 09 = N (fresh).
update public.profile set is_admin = true where id = 'e2000000-0000-4000-8000-000000000008';

insert into public.venue (id, name, city, country, region, location)
values ('tz-loc-estadio', 'Estádio Teste Locais', 'Teste', 'Portugal', 'mainland', 'SRID=4326;POINT(-7.2 39.7)');
insert into public.club (id, name, short_name, abbreviation, country, primary_color, secondary_color)
values
  ('tz-loc-casa', 'Clube Casa Locais', 'Casa', 'TLC', 'Portugal', '#112233', '#FFFFFF'),
  ('tz-loc-fora', 'Clube Fora Locais', 'Fora', 'TLF', 'Portugal', '#332211', '#FFFFFF');
insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at, season_id)
values ('tz-loc-jogo', 'liga', 'Jornada teste', 'tz-loc-casa', 'tz-loc-fora', 'tz-loc-estadio',
  now() + interval '5 days', public.current_season_id());
insert into public.place (id, name, name_article, kind, venue_id, walking_minutes, distance_m, location, confirmation)
values
  ('tz-loc-confirmado', 'Tasco Confirmado', 'o', 'tasca', 'tz-loc-estadio', 5, 400, 'SRID=4326;POINT(-7.204 39.7)', 'confirmed'),
  ('tz-loc-escondido', 'Tasco Escondido', 'o', 'tasca', 'tz-loc-estadio', 5, 450, 'SRID=4326;POINT(-7.2 39.704)', 'rejected');
insert into public.restroom (id, venue_id, osm_id, location, distance_m, walking_minutes)
values ('tz-loc-wc', 'tz-loc-estadio', 'node/999999001', 'SRID=4326;POINT(-7.201 39.7)', 90, 2);
insert into public.place_candidate (osm_id, venue_id, name, location, distance_m, walking_minutes)
values ('node/999999002', 'tz-loc-estadio', 'Candidato OSM', 'SRID=4326;POINT(-7.203 39.701)', 300, 4);

-- 1. Grants: the catalogue is read-only, candidates are server-only.
select pg_temp.expect('anon may only read place',
  has_table_privilege('anon', 'public.place', 'insert, update, delete, truncate'), false);
select pg_temp.expect('authenticated may only read place',
  has_table_privilege('authenticated', 'public.place', 'insert, update, delete, truncate'), false);
select pg_temp.expect('authenticated may only read restroom',
  has_table_privilege('authenticated', 'public.restroom', 'insert, update, delete, truncate'), false);
select pg_temp.expect('place_candidate is closed to anon',
  has_table_privilege('anon', 'public.place_candidate', 'select, insert, update, delete'), false);
select pg_temp.expect('place_candidate is closed to authenticated',
  has_table_privilege('authenticated', 'public.place_candidate', 'select, insert, update, delete'), false);
select pg_temp.expect('candidate publishing is not callable by clients',
  has_function_privilege('authenticated', 'public.publish_place_candidate(text, text, text, text, text, smallint)', 'execute')
  or has_function_privilege('authenticated', 'public.suggest_place_candidates()', 'execute')
  or has_function_privilege('anon', 'public.suggest_place_candidates()', 'execute'), false);
select pg_temp.expect('vote and toilet recounts are triggers, not RPCs',
  has_function_privilege('authenticated', 'public.place_vote_recount()', 'execute')
  or has_function_privilege('authenticated', 'public.place_toilet_recount()', 'execute'), false);
select pg_temp.expect('every table here has RLS on',
  (select count(*)::integer from pg_class
   where oid in ('public.place'::regclass, 'public.place_candidate'::regclass, 'public.place_vote'::regclass,
     'public.place_rating'::regclass, 'public.place_toilet_answer'::regclass, 'public.restroom'::regclass)
     and relrowsecurity), 6);

-- 2. Without an account.
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon reads confirmed places',
  pg_temp.visible('select id from public.place where id = ''tz-loc-confirmado'''), 1);
select pg_temp.expect('anon cannot read who suggested a place',
  split_part(pg_temp.refusal('select suggested_by from public.place'), ' ', 1), 'permission');
select pg_temp.expect('anon never sees a rejected place',
  pg_temp.visible('select id from public.place where id = ''tz-loc-escondido'''), 0);
select pg_temp.expect('no rejected place is readable at all',
  pg_temp.visible('select id from public.place where confirmation = ''rejected'''), 0);
select pg_temp.expect('anon reads restrooms', pg_temp.visible('select * from public.restroom where id = ''tz-loc-wc'''), 1);
select pg_temp.expect('anon cannot read candidates', pg_temp.visible('select * from public.place_candidate'), -1);
select pg_temp.expect('anon cannot add a place',
  pg_temp.refusal('insert into public.place (id, name, name_article, kind, venue_id, walking_minutes, distance_m, location) values (''tz-loc-x'', ''X'', ''o'', ''bar'', ''tz-loc-estadio'', 1, 1, ''SRID=4326;POINT(-7.2 39.7)'')'),
  'permission denied for table place');
select pg_temp.expect('anon cannot suggest a place',
  pg_temp.refusal('select public.suggest_place(''Tasco Anónimo'', ''tasca'', 39.71, -7.2, null)'),
  'permission denied for function suggest_place');
select pg_temp.expect('anon cannot vote', pg_temp.visible('select * from public.place_vote'), -1);
select pg_temp.expect('anon cannot read ratings', pg_temp.visible('select * from public.place_rating'), -1);
select pg_temp.expect('anon cannot read toilet answers', pg_temp.visible('select * from public.place_toilet_answer'), -1);
select pg_temp.expect('anon cannot rate',
  pg_temp.refusal('insert into public.place_rating (profile_id, place_id, score) values (''e2000000-0000-4000-8000-000000000002'', ''tz-loc-confirmado'', 5)'),
  'permission denied for table place_rating');
select pg_temp.expect('anon cannot share a place with a group',
  pg_temp.refusal('select public.share_place_with_group(''c2000000-0000-4000-8000-0000000000e2'', ''tz-loc-confirmado'')'),
  'permission denied for function share_place_with_group');

-- 3. Suggesting a place: the server checks and decides everything.
set local role authenticated;
select pg_temp.as_user('e2000000-0000-4000-8000-000000000001');
select pg_temp.expect('a signed-in person cannot insert places directly',
  pg_temp.refusal('insert into public.place (id, name, name_article, kind, venue_id, walking_minutes, distance_m, location) values (''tz-loc-x'', ''X'', ''o'', ''bar'', ''tz-loc-estadio'', 1, 1, ''SRID=4326;POINT(-7.2 39.7)'')'),
  'permission denied for table place');
select pg_temp.expect('a signed-in person cannot edit places',
  pg_temp.refusal('update public.place set confirmation = ''confirmed'' where id = ''tz-loc-escondido'''),
  'permission denied for table place');
select pg_temp.expect('a signed-in person cannot delete places',
  pg_temp.refusal('delete from public.place where id = ''tz-loc-confirmado'''), 'permission denied for table place');
select pg_temp.expect('a signed-in person cannot read candidates',
  pg_temp.visible('select * from public.place_candidate'), -1);
select pg_temp.expect('name too short', pg_temp.refusal('select public.suggest_place(''X'', ''tasca'', 39.71, -7.2, null)'), 'bad_name');
select pg_temp.expect('a link in the name',
  pg_temp.refusal('select public.suggest_place(''Tasco www.promo.pt'', ''tasca'', 39.71, -7.2, null)'), 'bad_name');
select pg_temp.expect('a phone number in the name',
  pg_temp.refusal('select public.suggest_place(''Tasco 912345678'', ''tasca'', 39.71, -7.2, null)'), 'bad_name');
select pg_temp.expect('unknown kind', pg_temp.refusal('select public.suggest_place(''Tasco Novo'', ''discoteca'', 39.71, -7.2, null)'), 'bad_kind');
select pg_temp.expect('impossible coordinates',
  pg_temp.refusal('select public.suggest_place(''Tasco Novo'', ''tasca'', 95, -7.2, null)'), 'bad_location');
select pg_temp.expect('note over 200 characters',
  pg_temp.refusal(format('select public.suggest_place(%L, %L, 39.71, -7.2, %L)', 'Tasco Novo', 'tasca', repeat('x', 201))), 'bad_note');
select pg_temp.expect('too far from any stadium',
  pg_temp.refusal('select public.suggest_place(''Tasco Longe'', ''tasca'', 39.75, -7.2, null)'), 'too_far');
select pg_temp.expect('a place right next to one already there is a duplicate',
  pg_temp.refusal('select public.suggest_place(''Outro Nome'', ''tasca'', 39.7, -7.2042, null)'), 'duplicate_place');
select pg_temp.expect('a place with the same name is a duplicate',
  pg_temp.refusal('select public.suggest_place(''tasco confirmado'', ''tasca'', 39.71, -7.21, null)'), 'duplicate_place');
-- A rejected place does not block a new suggestion with its name.
select pg_temp.expect('the name of a hidden place is free again',
  pg_temp.refusal('select public.suggest_place(''Tasco Escondido'', ''bar'', 39.708, -7.208, null)'), 'accepted');

create temporary table t_place (id text) on commit drop;
grant insert, select on t_place to authenticated;
insert into t_place select public.suggest_place('  Tasco da Malta  ', 'tasca', 39.71, -7.2, '  Bifanas boas  ');
reset role;
select pg_temp.expect('the suggestion is born a suggestion, from the server',
  (select name || '|' || confirmation || '|' || source || '|' || suggested_by || '|' || fan_note || '|' || votes_yes
   from public.place where id = (select id from t_place)),
  'Tasco da Malta|suggested|adepto|e2000000-0000-4000-8000-000000000001|Bifanas boas|0');
set local role authenticated;
select pg_temp.as_user('e2000000-0000-4000-8000-000000000001');
select pg_temp.expect('the server picked the stadium and the walk',
  (select venue_id || ' ' || (walking_minutes between 15 and 25) from public.place where id = (select id from t_place)),
  'tz-loc-estadio true');
select pg_temp.expect('the third suggestion of the day is accepted',
  pg_temp.refusal('select public.suggest_place(''Tasco Quatro'', ''bar'', 39.69, -7.19, null)'), 'accepted');
select pg_temp.expect('three suggestions a day, the fourth is refused',
  pg_temp.refusal('select public.suggest_place(''Tasco Cinco'', ''bar'', 39.692, -7.212, null)'), 'rate_limited');

-- 4. Votes: never on your own suggestion, only on suggestions, only as yourself.
select pg_temp.expect('the suggester cannot vote on their own suggestion',
  split_part(pg_temp.refusal(format('insert into public.place_vote (profile_id, place_id, is_good) values (%L, %L, true)',
    'e2000000-0000-4000-8000-000000000001', (select id from t_place))), ' ', 1),
  'new');

select pg_temp.as_user('e2000000-0000-4000-8000-000000000002');
select pg_temp.expect('a vote as someone else is refused',
  split_part(pg_temp.refusal(format('insert into public.place_vote (profile_id, place_id, is_good) values (%L, %L, true)',
    'e2000000-0000-4000-8000-000000000003', (select id from t_place))), ' ', 1),
  'new');
select pg_temp.expect('a vote on a confirmed place is refused',
  split_part(pg_temp.refusal('insert into public.place_vote (profile_id, place_id, is_good) values (''e2000000-0000-4000-8000-000000000002'', ''tz-loc-confirmado'', true)'), ' ', 1),
  'new');
select pg_temp.expect('a vote on a hidden place is refused',
  split_part(pg_temp.refusal('insert into public.place_vote (profile_id, place_id, is_good) values (''e2000000-0000-4000-8000-000000000002'', ''tz-loc-escondido'', true)'), ' ', 1),
  'new');
select pg_temp.expect('a voter cannot write the tally on the place',
  pg_temp.refusal(format('update public.place set votes_yes = 99 where id = %L', (select id from t_place))),
  'permission denied for table place');
insert into public.place_vote (profile_id, place_id, is_good) select 'e2000000-0000-4000-8000-000000000002', id, false from t_place;
update public.place_vote set is_good = true where place_id = (select id from t_place);
select pg_temp.expect('a voter changes their own vote and the server counts it',
  (select votes_yes || '/' || votes_no from public.place where id = (select id from t_place)), '1/0');

select pg_temp.as_user('e2000000-0000-4000-8000-000000000003');
insert into public.place_vote (profile_id, place_id, is_good) select 'e2000000-0000-4000-8000-000000000003', id, true from t_place;
select pg_temp.expect('another voter sees only their own vote', pg_temp.visible('select * from public.place_vote'), 1);
select pg_temp.expect('another voter cannot flip someone else''s vote',
  pg_temp.affected('update public.place_vote set is_good = false where profile_id = ''e2000000-0000-4000-8000-000000000002'''), 0);
select pg_temp.expect('another voter cannot remove someone else''s vote',
  pg_temp.affected('delete from public.place_vote where profile_id = ''e2000000-0000-4000-8000-000000000002'''), 0);
select pg_temp.expect('a vote cannot be moved onto someone else',
  split_part(pg_temp.refusal('update public.place_vote set profile_id = ''e2000000-0000-4000-8000-000000000004'''), ' ', 1),
  'new');

select pg_temp.as_user('e2000000-0000-4000-8000-000000000008');
select pg_temp.expect('the admin does not see people''s votes', pg_temp.visible('select * from public.place_vote'), 0);

-- Three more good votes make five: the server confirms the place.
reset role;
insert into public.place_vote (profile_id, place_id, is_good)
select ('e2000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, (select id from t_place), true
from generate_series(4, 5) as n;
set local role authenticated;
select pg_temp.as_user('e2000000-0000-4000-8000-000000000006');
select pg_temp.expect('four good votes: still a suggestion',
  (select confirmation from public.place where id = (select id from t_place)), 'suggested');
insert into public.place_vote (profile_id, place_id, is_good) select 'e2000000-0000-4000-8000-000000000006', id, true from t_place;
select pg_temp.expect('five good votes: confirmed',
  (select confirmation || ' ' || votes_yes from public.place where id = (select id from t_place)), 'confirmed 5');
select pg_temp.as_user('e2000000-0000-4000-8000-000000000007');
select pg_temp.expect('no more votes once it is confirmed',
  split_part(pg_temp.refusal(format('insert into public.place_vote (profile_id, place_id, is_good) values (%L, %L, false)',
    'e2000000-0000-4000-8000-000000000007', (select id from t_place))), ' ', 1),
  'new');

-- Five bad votes on another suggestion hide it from everyone.
reset role;
insert into public.place (id, name, name_article, kind, venue_id, walking_minutes, distance_m, location, source, confirmation, suggested_by)
values ('tz-loc-mau', 'Tasco Mau', 'o', 'bar', 'tz-loc-estadio', 5, 400, 'SRID=4326;POINT(-7.21 39.69)', 'adepto', 'suggested',
  'e2000000-0000-4000-8000-000000000001');
insert into public.place_vote (profile_id, place_id, is_good)
select ('e2000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'tz-loc-mau', false
from generate_series(2, 6) as n;
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('five bad votes: hidden from everyone',
  pg_temp.visible('select id from public.place where id = ''tz-loc-mau'''), 0);

-- 5. Ratings: private one by one, published only as an average of 5 or more.
set local role authenticated;
select pg_temp.as_user('e2000000-0000-4000-8000-000000000002');
select pg_temp.expect('a rating as yourself is accepted',
  pg_temp.refusal('insert into public.place_rating (profile_id, place_id, score, beer_score) values (''e2000000-0000-4000-8000-000000000002'', ''tz-loc-confirmado'', 4, 5)'),
  'accepted');
select pg_temp.expect('a rating as someone else is refused',
  split_part(pg_temp.refusal('insert into public.place_rating (profile_id, place_id, score) values (''e2000000-0000-4000-8000-000000000003'', ''tz-loc-confirmado'', 1)'), ' ', 1),
  'new');
select pg_temp.expect('a score of 6 is refused',
  split_part(pg_temp.refusal('update public.place_rating set score = 6'), ' ', 1), 'new');
select pg_temp.expect('a score of 0 is refused',
  split_part(pg_temp.refusal('update public.place_rating set food_score = 0'), ' ', 1), 'new');
select pg_temp.expect('one rating: no average published',
  (select count(*)::integer from public.place_scores_all() where place_id = 'tz-loc-confirmado'), 0);

reset role;
insert into public.place_rating (profile_id, place_id, score, beer_score)
select ('e2000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'tz-loc-confirmado', n - 1, null
from generate_series(3, 5) as n;
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('four ratings: still no average (by stadium)',
  (select count(*)::integer from public.place_scores('tz-loc-estadio')), 0);
reset role;
insert into public.place_rating (profile_id, place_id, score) values ('e2000000-0000-4000-8000-000000000006', 'tz-loc-confirmado', 5);
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('five ratings: the average is published, rounded',
  (select ratings || ' ' || score || ' ' || beer_score || ' ' || coalesce(food_score::text, '-')
   from public.place_scores_all() where place_id = 'tz-loc-confirmado'),
  '5 3.6 5.0 -');
select pg_temp.expect('the per-stadium scores agree',
  (select score from public.place_scores('tz-loc-estadio') where place_id = 'tz-loc-confirmado'), 3.6);
select pg_temp.expect('no published average anywhere comes from fewer than 5 ratings',
  (select count(*)::integer from public.place_scores_all() where ratings < 5), 0);

set local role authenticated;
select pg_temp.as_user('e2000000-0000-4000-8000-000000000003');
select pg_temp.expect('a rater sees only their own rating', pg_temp.visible('select * from public.place_rating'), 1);
select pg_temp.expect('a rater cannot change someone else''s rating',
  pg_temp.affected('update public.place_rating set score = 1 where profile_id = ''e2000000-0000-4000-8000-000000000002'''), 0);
select pg_temp.expect('a rater cannot delete someone else''s rating',
  pg_temp.affected('delete from public.place_rating where profile_id = ''e2000000-0000-4000-8000-000000000002'''), 0);
select pg_temp.expect('a rater removes their own rating',
  pg_temp.affected('delete from public.place_rating where profile_id = ''e2000000-0000-4000-8000-000000000003'''), 1);
select pg_temp.expect('down to four: the average is withdrawn',
  (select count(*)::integer from public.place_scores_all() where place_id = 'tz-loc-confirmado'), 0);
select pg_temp.as_user('e2000000-0000-4000-8000-000000000008');
select pg_temp.expect('the admin does not read individual ratings', pg_temp.visible('select * from public.place_rating'), 0);
select pg_temp.as_user('e2000000-0000-4000-8000-000000000009');
select pg_temp.expect('a fresh account sees no ratings', pg_temp.visible('select * from public.place_rating'), 0);

-- 6. "Has a toilet?": one answer per person, counted by the server.
select pg_temp.expect('an answer as yourself is accepted',
  pg_temp.refusal('insert into public.place_toilet_answer (profile_id, place_id, has_toilet) values (''e2000000-0000-4000-8000-000000000009'', ''tz-loc-confirmado'', true)'),
  'accepted');
select pg_temp.expect('a second answer for the same place is refused',
  split_part(pg_temp.refusal('insert into public.place_toilet_answer (profile_id, place_id, has_toilet) values (''e2000000-0000-4000-8000-000000000009'', ''tz-loc-confirmado'', false)'), ' ', 1),
  'duplicate');
select pg_temp.expect('an answer as someone else is refused',
  split_part(pg_temp.refusal('insert into public.place_toilet_answer (profile_id, place_id, has_toilet) values (''e2000000-0000-4000-8000-000000000002'', ''tz-loc-confirmado'', false)'), ' ', 1),
  'new');
select pg_temp.expect('an answer about a hidden place is refused',
  split_part(pg_temp.refusal('insert into public.place_toilet_answer (profile_id, place_id, has_toilet) values (''e2000000-0000-4000-8000-000000000009'', ''tz-loc-escondido'', true)'), ' ', 1),
  'new');
select pg_temp.expect('the server counted the answer',
  (select toilet_yes || '/' || toilet_no from public.place where id = 'tz-loc-confirmado'), '1/0');
update public.place_toilet_answer set has_toilet = false;
select pg_temp.expect('changing the answer moves the count',
  (select toilet_yes || '/' || toilet_no from public.place where id = 'tz-loc-confirmado'), '0/1');
select pg_temp.expect('nobody writes the toilet count directly',
  pg_temp.refusal('update public.place set toilet_yes = 50 where id = ''tz-loc-confirmado'''), 'permission denied for table place');
select pg_temp.as_user('e2000000-0000-4000-8000-000000000002');
select pg_temp.expect('others do not see the answer', pg_temp.visible('select * from public.place_toilet_answer'), 0);
select pg_temp.expect('others cannot change the answer',
  pg_temp.affected('update public.place_toilet_answer set has_toilet = true'), 0);
select pg_temp.expect('others cannot remove the answer',
  pg_temp.affected('delete from public.place_toilet_answer'), 0);

-- 7. Restrooms and candidates: nobody writes them from the app, not even an admin.
select pg_temp.as_user('e2000000-0000-4000-8000-000000000008');
select pg_temp.expect('admin cannot add restrooms',
  pg_temp.refusal('insert into public.restroom (id, venue_id, osm_id, location, distance_m, walking_minutes) values (''tz-loc-wc2'', ''tz-loc-estadio'', ''node/999999003'', ''SRID=4326;POINT(-7.2 39.7)'', 1, 1)'),
  'permission denied for table restroom');
select pg_temp.expect('admin cannot remove restrooms',
  pg_temp.refusal('delete from public.restroom where id = ''tz-loc-wc'''), 'permission denied for table restroom');
select pg_temp.expect('admin cannot read candidates', pg_temp.visible('select * from public.place_candidate'), -1);
select pg_temp.expect('admin cannot publish a candidate',
  pg_temp.refusal('select public.publish_place_candidate(''node/999999002'', ''tz-loc-pub'', ''o'', ''tasca'')'),
  'permission denied for function publish_place_candidate');
select pg_temp.expect('admin cannot edit places either',
  pg_temp.refusal('update public.place set name = ''Outro'' where id = ''tz-loc-confirmado'''), 'permission denied for table place');

-- 8. Sharing a tasco with a group: only members.
reset role;
insert into public.fan_group (id, name, created_by, invite_code)
values ('c2000000-0000-4000-8000-0000000000e2', 'Grupo Locais', 'e2000000-0000-4000-8000-000000000002', 'tzlocais01');
insert into public.fan_group_member (group_id, profile_id, role)
values ('c2000000-0000-4000-8000-0000000000e2', 'e2000000-0000-4000-8000-000000000002', 'owner');
set local role authenticated;
select pg_temp.as_user('e2000000-0000-4000-8000-000000000009');
select pg_temp.expect('an outsider cannot post a tasco in the group',
  pg_temp.refusal('select public.share_place_with_group(''c2000000-0000-4000-8000-0000000000e2'', ''tz-loc-confirmado'')'), 'not_member');
select pg_temp.as_user('e2000000-0000-4000-8000-000000000002');
select pg_temp.expect('a member posts a tasco',
  pg_temp.refusal('select public.share_place_with_group(''c2000000-0000-4000-8000-0000000000e2'', ''tz-loc-confirmado'')'), 'accepted');
select pg_temp.expect('an unknown tasco is refused',
  pg_temp.refusal('select public.share_place_with_group(''c2000000-0000-4000-8000-0000000000e2'', ''nao-existe'')'), 'place_not_found');
select pg_temp.expect('the post is just the tasco',
  (select body from public.group_messages('c2000000-0000-4000-8000-0000000000e2') where kind = 'local'), 'no Tasco Confirmado');

reset role;
select count(*) as checks_passed from expect_log;

rollback;
