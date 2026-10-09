-- Access tests for presence in tascos: checkin (individual), place_pulse (aggregate) and place_visit (own history).
--
-- Privacy rules from CLAUDE.md checked here:
--   - no client role (anon, a signed-in person, an admin) ever reads or writes public.checkin;
--   - the functions that read checkin are not callable by clients (only the Edge Function / pg_cron);
--   - place_pulse is published only with >= 5 people, and the split by club has the same minimum per club,
--     the rest going to "others";
--   - check-ins end after 3 h, at kick-off at that stadium, and are deleted by pg_cron after 48 h.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_presenca.test.sql
--
-- People: P1..P9 are in the tasco, P10 is a fresh account (outsider), P11 is an admin, P12 is in P1's group and has
-- blocked P1.

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
  ('e1000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  'acesso-presenca-' || n || '@test.invalid',
  json_build_object('display_name', 'Presenca ' || n),
  'authenticated', 'authenticated'
from generate_series(1, 12) as n;
update public.profile set is_admin = true where id = 'e1000000-0000-4000-8000-000000000011';
-- Only accounts with a confirmed email count for the pulse.
update auth.users set email_confirmed_at = now()
where id::text like 'e1000000-0000-4000-8000-0000000000%';

-- A stadium of our own, far from real ones, with two clubs, two tascos and a game that already kicked off.
insert into public.venue (id, name, city, country, region, location)
values ('tz-pres-estadio', 'Estádio Teste Presença', 'Teste', 'Portugal', 'mainland',
  'SRID=4326;POINT(-7.0 39.5)');
insert into public.club (id, name, short_name, abbreviation, country, primary_color, secondary_color)
values
  ('tz-pres-casa', 'Clube Casa Presença', 'Casa', 'TPC', 'Portugal', '#112233', '#FFFFFF'),
  ('tz-pres-fora', 'Clube Fora Presença', 'Fora', 'TPF', 'Portugal', '#332211', '#FFFFFF');
insert into public.place (id, name, name_article, kind, venue_id, walking_minutes, distance_m, location)
values
  ('tz-pres-tasco-um', 'Tasco Um', 'o', 'tasca', 'tz-pres-estadio', 5, 400, 'SRID=4326;POINT(-7.004 39.5)'),
  ('tz-pres-tasco-dois', 'Tasco Dois', 'o', 'tasca', 'tz-pres-estadio', 6, 500, 'SRID=4326;POINT(-7.005 39.5)'),
  ('tz-pres-tasco-tres', 'Tasco Tres', 'o', 'tasca', 'tz-pres-estadio', 7, 600, 'SRID=4326;POINT(-7.006 39.5)');
insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at, season_id)
values ('tz-pres-jogo', 'liga', 'Jornada teste', 'tz-pres-casa', 'tz-pres-fora', 'tz-pres-estadio',
  now() - interval '1 hour', public.current_season_id());

insert into public.profile_club (profile_id, relation, club_id)
select ('e1000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'supporter',
  case when n <= 5 then 'tz-pres-casa' else 'tz-pres-fora' end
from generate_series(1, 6) as n;

-- 1. The table itself: nobody outside the server can touch it.
select pg_temp.expect('checkin has RLS on',
  (select relrowsecurity from pg_class where oid = 'public.checkin'::regclass), true);
select pg_temp.expect('checkin has no policies at all',
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'checkin'), 0);
select pg_temp.expect('checkin keeps no coordinates',
  (select count(*)::integer from information_schema.columns
   where table_schema = 'public' and table_name = 'checkin'
     and (column_name ~ '(lat|lon|lng|location|geo|point|accuracy)')), 0);
select pg_temp.expect('anon has no privilege on checkin',
  has_table_privilege('anon', 'public.checkin', 'select, insert, update, delete, truncate, references, trigger'), false);
select pg_temp.expect('authenticated has no privilege on checkin',
  has_table_privilege('authenticated', 'public.checkin', 'select, insert, update, delete, truncate, references, trigger'), false);
select pg_temp.expect('no client-callable function reads checkin',
  (select coalesce(string_agg(p.proname, ',' order by p.proname), '')
   from pg_proc as p
   where p.pronamespace = 'public'::regnamespace
     and p.prosrc ~ 'public\.checkin\M'
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  '');
select pg_temp.expect('no view exposes checkin',
  (select count(*)::integer from pg_views where schemaname in ('public', 'graphql_public') and definition ~ 'checkin\M'), 0);
select pg_temp.expect('checkin is not broadcast by Realtime',
  (select count(*)::integer from pg_publication_tables where schemaname = 'public' and tablename = 'checkin'), 0);
select pg_temp.expect('place_pulse carries no person',
  (select string_agg(column_name::text, ',' order by column_name) from information_schema.columns
   where table_schema = 'public' and table_name = 'place_pulse'),
  'clubs,others,people,place_id,updated_at,venue_id');
select pg_temp.expect('place_pulse refuses fewer than 5 people even from the owner',
  split_part(pg_temp.refusal('insert into public.place_pulse (place_id, venue_id, people) values (''tz-pres-tasco-um'', ''tz-pres-estadio'', 4)'), ' ', 1),
  'new');

-- Seed: one check-in as the server would make it, so there is a row to hide.
select public.start_checkin('e1000000-0000-4000-8000-000000000001', 'tz-pres-tasco-um');

set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon cannot read checkin', pg_temp.visible('select * from public.checkin'), -1);
select pg_temp.expect('anon cannot insert a checkin',
  pg_temp.refusal('insert into public.checkin (profile_id, place_id) values (''e1000000-0000-4000-8000-000000000001'', ''tz-pres-tasco-um'')'),
  'permission denied for table checkin');
select pg_temp.expect('anon cannot start a check-in',
  pg_temp.refusal('select public.start_checkin(''e1000000-0000-4000-8000-000000000001'', ''tz-pres-tasco-um'')'),
  'permission denied for function start_checkin');
select pg_temp.expect('anon cannot refresh the pulse',
  pg_temp.refusal('select public.refresh_place_pulse()'), 'permission denied for function refresh_place_pulse');
select pg_temp.expect('anon cannot read place_visit', pg_temp.visible('select * from public.place_visit'), -1);

set local role authenticated;
-- The person who checked in can't read their own check-in either: only the visit it created.
select pg_temp.as_user('e1000000-0000-4000-8000-000000000001');
select pg_temp.expect('owner cannot read checkin', pg_temp.visible('select * from public.checkin'), -1);
select pg_temp.expect('owner cannot insert a checkin for themselves',
  pg_temp.refusal('insert into public.checkin (profile_id, place_id) values (''e1000000-0000-4000-8000-000000000001'', ''tz-pres-tasco-dois'')'),
  'permission denied for table checkin');
select pg_temp.expect('owner cannot end a check-in through SQL',
  pg_temp.refusal('update public.checkin set ended_at = now()'), 'permission denied for table checkin');
select pg_temp.expect('owner cannot delete check-ins',
  pg_temp.refusal('delete from public.checkin'), 'permission denied for table checkin');
select pg_temp.expect('owner cannot call start_checkin directly',
  pg_temp.refusal('select public.start_checkin(''e1000000-0000-4000-8000-000000000001'', ''tz-pres-tasco-dois'')'),
  'permission denied for function start_checkin');
select pg_temp.expect('owner cannot call end_checkin directly',
  pg_temp.refusal('select public.end_checkin(''e1000000-0000-4000-8000-000000000001'', ''tz-pres-tasco-um'')'),
  'permission denied for function end_checkin');
select pg_temp.expect('owner cannot share a check-in on someone''s behalf',
  pg_temp.refusal('select public.share_checkin_with_groups(''e1000000-0000-4000-8000-000000000002'', ''tz-pres-tasco-um'')'),
  'permission denied for function share_checkin_with_groups');
select pg_temp.expect('owner sees the verified visit the check-in created',
  (select string_agg(place_id || ':' || source, ',') from public.place_visit), 'tz-pres-tasco-um:check-in');

select pg_temp.as_user('e1000000-0000-4000-8000-000000000011');
select pg_temp.expect('admin cannot read checkin either', pg_temp.visible('select * from public.checkin'), -1);
select pg_temp.expect('admin cannot refresh the pulse',
  pg_temp.refusal('select public.refresh_place_pulse()'), 'permission denied for function refresh_place_pulse');
select pg_temp.expect('admin does not see other people''s visits', pg_temp.visible('select * from public.place_visit'), 0);

select pg_temp.as_user('e1000000-0000-4000-8000-000000000010');
select pg_temp.expect('fresh account cannot read checkin', pg_temp.visible('select * from public.checkin'), -1);
select pg_temp.expect('fresh account sees no visits', pg_temp.visible('select * from public.place_visit'), 0);

-- 2. The aggregate: nothing with 4 people, then 5.
reset role;
select public.start_checkin(('e1000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'tz-pres-tasco-um')
from generate_series(2, 4) as n;
select pg_temp.expect('four people: the server stores four check-ins',
  (select count(*)::integer from public.checkin where place_id = 'tz-pres-tasco-um' and ended_at is null), 4);

set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('four people: anon sees no pulse',
  pg_temp.visible('select * from public.place_pulse where place_id = ''tz-pres-tasco-um'''), 0);
set local role authenticated;
select pg_temp.as_user('e1000000-0000-4000-8000-000000000010');
select pg_temp.expect('four people: signed-in sees no pulse',
  pg_temp.visible('select * from public.place_pulse where place_id = ''tz-pres-tasco-um'''), 0);
select pg_temp.expect('nobody writes the pulse',
  pg_temp.refusal('insert into public.place_pulse (place_id, venue_id, people) values (''tz-pres-tasco-um'', ''tz-pres-estadio'', 50)'),
  'permission denied for table place_pulse');
select pg_temp.expect('nobody inflates the pulse',
  pg_temp.refusal('update public.place_pulse set people = 500'), 'permission denied for table place_pulse');
select pg_temp.expect('nobody wipes the pulse',
  pg_temp.refusal('delete from public.place_pulse'), 'permission denied for table place_pulse');

reset role;
select public.start_checkin('e1000000-0000-4000-8000-000000000005', 'tz-pres-tasco-um');
select pg_temp.expect('a check-in does not publish by itself (the 5-minute job does)',
  (select count(*)::integer from public.place_pulse where place_id = 'tz-pres-tasco-um'), 0);
update auth.users set email_confirmed_at = null where id = 'e1000000-0000-4000-8000-000000000005';
select public.refresh_place_pulse();
select pg_temp.expect('an account without a confirmed email does not count: four are not published',
  (select count(*)::integer from public.place_pulse where place_id = 'tz-pres-tasco-um'), 0);
update auth.users set email_confirmed_at = now() where id = 'e1000000-0000-4000-8000-000000000005';
select public.refresh_place_pulse();
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('five people of one club: published with the club',
  (select people || ' ' || clubs::text || ' ' || others from public.place_pulse where place_id = 'tz-pres-tasco-um'),
  '5 [{"people": 5, "club_id": "tz-pres-casa"}] 0');

-- One supporter of the other club and one with no club: they only show up as "others".
reset role;
select public.start_checkin('e1000000-0000-4000-8000-000000000006', 'tz-pres-tasco-um');
select public.start_checkin('e1000000-0000-4000-8000-000000000007', 'tz-pres-tasco-um');
select public.refresh_place_pulse();
set local role authenticated;
select pg_temp.as_user('e1000000-0000-4000-8000-000000000010');
select pg_temp.expect('seven people show as 5 (multiples of 5: one more person does not show)',
  (select people || ' ' || clubs::text || ' ' || others from public.place_pulse where place_id = 'tz-pres-tasco-um'),
  '5 [{"people": 5, "club_id": "tz-pres-casa"}] 0');

-- Six people in the second tasco, three per club: published, but no club reaches 5.
reset role;
insert into public.checkin (profile_id, place_id, club_id)
select ('e1000000-0000-4000-8000-0000000000' || lpad((n + 1)::text, 2, '0'))::uuid, 'tz-pres-tasco-dois',
  case when n < 3 then 'tz-pres-casa' else 'tz-pres-fora' end
from generate_series(0, 5) as n;
-- Plus four people whose presence no longer counts: one expired, one ended, two that started before kick-off here.
insert into public.checkin (profile_id, place_id, club_id, created_at, expires_at)
values ('e1000000-0000-4000-8000-000000000007', 'tz-pres-tasco-dois', 'tz-pres-casa', now() - interval '4 hours', now() - interval '1 hour');
insert into public.checkin (profile_id, place_id, club_id, ended_at)
values ('e1000000-0000-4000-8000-000000000008', 'tz-pres-tasco-dois', 'tz-pres-casa', now());
insert into public.checkin (profile_id, place_id, club_id, created_at)
values
  ('e1000000-0000-4000-8000-000000000009', 'tz-pres-tasco-tres', 'tz-pres-casa', now() - interval '2 hours'),
  ('e1000000-0000-4000-8000-000000000010', 'tz-pres-tasco-tres', 'tz-pres-casa', now() - interval '2 hours');
select public.refresh_place_pulse();
select pg_temp.expect('kick-off at this stadium ended the earlier check-ins',
  (select count(*)::integer from public.checkin where place_id = 'tz-pres-tasco-tres' and ended_at is not null), 2);

set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('three and three: everyone is "others" (6 shows as 5)',
  (select people || ' ' || clubs::text || ' ' || others from public.place_pulse where place_id = 'tz-pres-tasco-dois'),
  '5 [] 5');
select pg_temp.expect('anon sees two pulses at the test stadium and no small one',
  pg_temp.visible('select * from public.place_pulse where venue_id = ''tz-pres-estadio'''), 2);
select pg_temp.expect('no published pulse anywhere has fewer than 5 people',
  pg_temp.visible('select * from public.place_pulse where people < 5'), 0);
select pg_temp.expect('no published club anywhere has fewer than 5 people',
  pg_temp.visible('select * from public.place_pulse as pp, jsonb_array_elements(pp.clubs) as c where (c ->> ''people'')::integer < 5'), 0);
select pg_temp.expect('club counts and others always add up to the total',
  pg_temp.visible('select * from public.place_pulse as pp where pp.people <> pp.others + coalesce((select sum((c ->> ''people'')::integer) from jsonb_array_elements(pp.clubs) as c), 0)'), 0);

-- 3. Ending a check-in (as the Edge Function does) drops the tasco back under 5: the pulse disappears.
reset role;
select pg_temp.expect('end_checkin ends the presence', public.end_checkin('e1000000-0000-4000-8000-000000000006', 'tz-pres-tasco-um'), true);
select pg_temp.expect('ending a check-in also removes the visit it created',
  (select count(*)::integer from public.place_visit
   where profile_id = 'e1000000-0000-4000-8000-000000000006' and place_id = 'tz-pres-tasco-um'), 0);
select public.end_checkin('e1000000-0000-4000-8000-000000000005', 'tz-pres-tasco-um');
select public.end_checkin('e1000000-0000-4000-8000-000000000004', 'tz-pres-tasco-um');
select public.refresh_place_pulse();
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('four left: the pulse is withdrawn',
  pg_temp.visible('select * from public.place_pulse where place_id = ''tz-pres-tasco-um'''), 0);

-- A check-in in another tasco ends the previous one.
reset role;
select public.start_checkin('e1000000-0000-4000-8000-000000000001', 'tz-pres-tasco-tres');
select pg_temp.expect('one open check-in per person',
  (select count(*)::integer from public.checkin
   where profile_id = 'e1000000-0000-4000-8000-000000000001' and ended_at is null and expires_at > now()), 1);
select pg_temp.expect('presence lasts 3 hours',
  (select expires_at - created_at from public.checkin
   where profile_id = 'e1000000-0000-4000-8000-000000000001' and ended_at is null), interval '3 hours');

-- 4. pg_cron deletes check-ins after 48 h.
insert into public.checkin (profile_id, place_id, created_at, expires_at)
values
  ('e1000000-0000-4000-8000-000000000002', 'tz-pres-tasco-tres', now() - interval '49 hours', now() - interval '46 hours'),
  ('e1000000-0000-4000-8000-000000000003', 'tz-pres-tasco-tres', now() - interval '47 hours', now() - interval '44 hours');
select pg_temp.expect('the deletion job runs every hour',
  (select schedule || ' ' || active from cron.job where jobname = 'delete-old-checkins'), '17 * * * * true');
do $$ begin execute (select command from cron.job where jobname = 'delete-old-checkins'); end $$;
select pg_temp.expect('after the job nothing older than 48 h is left',
  (select count(*)::integer from public.checkin where created_at < now() - interval '48 hours'), 0);
select pg_temp.expect('a 47 h old check-in is still kept',
  (select count(*)::integer from public.checkin
   where profile_id = 'e1000000-0000-4000-8000-000000000003' and created_at < now() - interval '46 hours'), 1);
select pg_temp.expect('the pulse job runs every 5 minutes',
  (select schedule || ' ' || active from cron.job where jobname = 'refresh-place-pulse'), '*/5 * * * * true');

-- 5. place_visit: everyone keeps their own history; only the server writes verified visits.
set local role authenticated;
select pg_temp.as_user('e1000000-0000-4000-8000-000000000010');
select pg_temp.expect('a manual visit to your own history is accepted',
  pg_temp.refusal('insert into public.place_visit (profile_id, place_id, source) values (''e1000000-0000-4000-8000-000000000010'', ''tz-pres-tasco-um'', ''manual'')'),
  'accepted');
select pg_temp.expect('a self-made verified visit is refused',
  split_part(pg_temp.refusal('insert into public.place_visit (profile_id, place_id, source) values (''e1000000-0000-4000-8000-000000000010'', ''tz-pres-tasco-dois'', ''check-in'')'), ' ', 1),
  'new');
select pg_temp.expect('a visit in someone else''s history is refused',
  split_part(pg_temp.refusal('insert into public.place_visit (profile_id, place_id, source) values (''e1000000-0000-4000-8000-000000000001'', ''tz-pres-tasco-dois'', ''manual'')'), ' ', 1),
  'new');
select pg_temp.expect('a visit in the future is refused',
  split_part(pg_temp.refusal('insert into public.place_visit (profile_id, place_id, source, visited_at) values (''e1000000-0000-4000-8000-000000000010'', ''tz-pres-tasco-dois'', ''manual'', now() + interval ''1 hour'')'), ' ', 1),
  'new');
select pg_temp.expect('a manual visit cannot be turned into a verified one',
  pg_temp.refusal('update public.place_visit set source = ''check-in'''), 'permission denied for table place_visit');
select pg_temp.expect('the outsider sees only their own visit', pg_temp.visible('select * from public.place_visit'), 1);
select pg_temp.expect('the outsider cannot delete P1''s visits',
  pg_temp.affected('delete from public.place_visit where profile_id = ''e1000000-0000-4000-8000-000000000001'''), 0);
select pg_temp.expect('the outsider can delete their own visit',
  pg_temp.affected('delete from public.place_visit where profile_id = ''e1000000-0000-4000-8000-000000000010'''), 1);

select pg_temp.as_user('e1000000-0000-4000-8000-000000000002');
select pg_temp.expect('P2 sees only P2''s visit',
  (select string_agg(distinct profile_id::text, ',') from public.place_visit), 'e1000000-0000-4000-8000-000000000002');

reset role;
select pg_temp.expect('P1''s visits are untouched',
  (select count(*)::integer from public.place_visit where profile_id = 'e1000000-0000-4000-8000-000000000001'), 2);

-- 6. Telling the group where you are is opt-in, and only says the tasco.
insert into public.fan_group (id, name, created_by, invite_code)
values ('c1000000-0000-4000-8000-0000000000e1', 'Grupo Presença', 'e1000000-0000-4000-8000-000000000001', 'tzpresenca');
insert into public.fan_group_member (group_id, profile_id, role)
values ('c1000000-0000-4000-8000-0000000000e1', 'e1000000-0000-4000-8000-000000000001', 'owner');
insert into public.fan_group_member (group_id, profile_id)
values
  ('c1000000-0000-4000-8000-0000000000e1', 'e1000000-0000-4000-8000-000000000002'),
  ('c1000000-0000-4000-8000-0000000000e1', 'e1000000-0000-4000-8000-000000000012');

select pg_temp.expect('a fresh account does not share check-ins',
  (select coalesce(share_checkins_with_groups, false) from public.profile where id = 'e1000000-0000-4000-8000-000000000001'), false);
select pg_temp.expect('without opting in, nothing is posted',
  public.share_checkin_with_groups('e1000000-0000-4000-8000-000000000001', 'tz-pres-tasco-tres'), 0);

set local role authenticated;
select pg_temp.as_user('e1000000-0000-4000-8000-000000000001');
select public.set_share_checkins_with_groups(true);
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon cannot change anyone''s sharing',
  pg_temp.refusal('select public.set_share_checkins_with_groups(true)'), 'permission denied for function set_share_checkins_with_groups');

reset role;
select pg_temp.expect('P1 opted in for P1 only',
  (select string_agg(id::text, ',') from public.profile where id::text like 'e1000000-%' and share_checkins_with_groups),
  'e1000000-0000-4000-8000-000000000001');
select pg_temp.expect('after opting in, one post per group', public.share_checkin_with_groups('e1000000-0000-4000-8000-000000000001', 'tz-pres-tasco-tres'), 1);
select pg_temp.expect('the same tasco is not repeated within 3 hours',
  public.share_checkin_with_groups('e1000000-0000-4000-8000-000000000001', 'tz-pres-tasco-tres'), 0);
insert into public.user_block (blocker_id, blocked_id)
values ('e1000000-0000-4000-8000-000000000012', 'e1000000-0000-4000-8000-000000000001');

set local role authenticated;
select pg_temp.as_user('e1000000-0000-4000-8000-000000000002');
select pg_temp.expect('a group member sees only the tasco name',
  (select body || '|' || place_id from public.group_messages('c1000000-0000-4000-8000-0000000000e1') where kind = 'local'),
  'no Tasco Tres|tz-pres-tasco-tres');
select pg_temp.as_user('e1000000-0000-4000-8000-000000000012');
select pg_temp.expect('someone who blocked P1 does not see where P1 is',
  (select count(*)::integer from public.group_messages('c1000000-0000-4000-8000-0000000000e1') where kind = 'local'), 0);
select pg_temp.as_user('e1000000-0000-4000-8000-000000000010');
select pg_temp.expect('an outsider does not see where P1 is',
  (select count(*)::integer from public.group_messages('c1000000-0000-4000-8000-0000000000e1')), 0);

-- 7. The verified places ranking only shows people who opted in (P1 has not).
select pg_temp.expect('a person not in the rankings is not listed to others',
  (select count(*)::integer from public.verified_places_ranking(50) where display_name like 'Presenca %' and not is_me), 0);
select pg_temp.as_user('e1000000-0000-4000-8000-000000000001');
select pg_temp.expect('the person sees their own verified places',
  (select verified_places from public.verified_places_ranking(50) where is_me), 2);
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon cannot read the verified places ranking',
  pg_temp.refusal('select * from public.verified_places_ranking(10)'), 'permission denied for function verified_places_ranking');

reset role;
select count(*) as checks_passed from expect_log;

rollback;
