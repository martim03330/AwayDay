-- Access tests for what fans add to a tasco: place_photo (with moderate_place_photo), dish and dish_recommendation.
--
-- Rules checked: a photo or dish someone sends stays pending and invisible to others until approved (photos by an
-- admin through moderate_place_photo); nobody approves their own; status, author and counts are set by the server;
-- an approved photo is shown "sem dizer quem a enviou" (docs/DECISOES.md, 2026-09-16), so no client may learn who
-- sent it.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails. The checks that
-- currently expose a bug are at the end, so everything else still runs first.
--
--   supabase db query --linked -f supabase/tests/acesso_fotos_pratos.test.sql
--
-- People: U sends photos and dishes, O is another signed-in person, A is an admin, N is a fresh account.

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
  ('e3000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  'acesso-fotos-' || n || '@test.invalid',
  json_build_object('display_name', 'Fotos ' || n),
  'authenticated', 'authenticated'
from generate_series(1, 4) as n;
-- 01 = U, 02 = O, 03 = A (admin), 04 = N.
update public.profile set is_admin = true where id = 'e3000000-0000-4000-8000-000000000003';

insert into public.venue (id, name, city, country, region, location)
values ('tz-fot-estadio', 'Estádio Teste Fotos', 'Teste', 'Portugal', 'mainland', 'SRID=4326;POINT(-7.4 39.9)');
insert into public.place (id, name, name_article, kind, venue_id, walking_minutes, distance_m, location)
values ('tz-fot-tasco', 'Tasco das Fotos', 'o', 'tasca', 'tz-fot-estadio', 5, 400, 'SRID=4326;POINT(-7.404 39.9)');
-- One dish already approved (as the owner loads them from the dashboard).
insert into public.dish (id, place_id, name, price_cents, status)
values ('d3000000-0000-4000-8000-0000000000a1', 'tz-fot-tasco', 'Bifana da Casa', 350, 'approved');

create temporary table t_ids (key text primary key, id uuid) on commit drop;
grant insert, select on t_ids to authenticated, anon;
create function pg_temp.id(p_key text)
returns uuid
language sql
as $$
  select id from t_ids where key = p_key;
$$;

select pg_temp.expect('RLS on all three tables',
  (select count(*)::integer from pg_class
   where oid in ('public.place_photo'::regclass, 'public.dish'::regclass, 'public.dish_recommendation'::regclass)
     and relrowsecurity), 3);
select pg_temp.expect('nobody updates photos from the app',
  has_table_privilege('authenticated', 'public.place_photo', 'update') or has_table_privilege('anon', 'public.place_photo', 'update'), false);
select pg_temp.expect('nobody updates or deletes dishes from the app',
  has_table_privilege('authenticated', 'public.dish', 'update, delete') or has_table_privilege('anon', 'public.dish', 'insert, update, delete'), false);
select pg_temp.expect('the photo status and author are not writable by clients',
  has_column_privilege('authenticated', 'public.place_photo', 'status', 'insert')
  or has_column_privilege('authenticated', 'public.place_photo', 'submitted_by', 'insert')
  or has_column_privilege('authenticated', 'public.place_photo', 'moderated_by', 'insert'), false);
select pg_temp.expect('the dish status, author and counts are not writable by clients',
  has_column_privilege('authenticated', 'public.dish', 'status', 'insert')
  or has_column_privilege('authenticated', 'public.dish', 'submitted_by', 'insert')
  or has_column_privilege('authenticated', 'public.dish', 'is_specialty', 'insert')
  or has_column_privilege('authenticated', 'public.dish', 'recommendations_count', 'insert'), false);

-- The photo files: new uploads go to «anonimas/», and who sent each one is the storage object's owner.
insert into storage.objects (bucket_id, name, owner_id)
values
  ('place-photos', 'anonimas/um.jpg', 'e3000000-0000-4000-8000-000000000001'),
  ('place-photos', 'anonimas/dois.jpg', 'e3000000-0000-4000-8000-000000000001'),
  ('place-photos', 'anonimas/tres.jpg', 'e3000000-0000-4000-8000-000000000001'),
  ('place-photos', 'anonimas/a.jpg', 'e3000000-0000-4000-8000-000000000001'),
  ('place-photos', 'anonimas/x.jpg', 'e3000000-0000-4000-8000-000000000001'),
  ('place-photos', 'anonimas/roubada.jpg', 'e3000000-0000-4000-8000-000000000002'),
  ('place-photos', 'anonimas/onze.jpg', 'e3000000-0000-4000-8000-000000000004');

-- 1. U sends a photo and a dish.
set local role authenticated;
select pg_temp.as_user('e3000000-0000-4000-8000-000000000001');
select pg_temp.expect('a photo file sent by someone else is refused',
  pg_temp.refusal('insert into public.place_photo (place_id, storage_path) values (''tz-fot-tasco'', ''anonimas/roubada.jpg'')'),
  'place_photo_path_not_owned');
select pg_temp.expect('a photo cannot be sent already approved',
  pg_temp.refusal('insert into public.place_photo (place_id, storage_path, status) values (''tz-fot-tasco'', ''anonimas/a.jpg'', ''approved'')'),
  'permission denied for table place_photo');
select pg_temp.expect('a photo cannot be sent in someone else''s name',
  pg_temp.refusal('insert into public.place_photo (place_id, storage_path, submitted_by) values (''tz-fot-tasco'', ''anonimas/a.jpg'', ''e3000000-0000-4000-8000-000000000002'')'),
  'permission denied for table place_photo');
select pg_temp.expect('a photo of a place that does not exist is refused',
  pg_temp.refusal('insert into public.place_photo (place_id, storage_path) values (''nao-existe'', ''anonimas/x.jpg'')') = 'accepted',
  false);
insert into public.place_photo (place_id, storage_path)
values
  ('tz-fot-tasco', 'anonimas/um.jpg'),
  ('tz-fot-tasco', 'anonimas/dois.jpg'),
  ('tz-fot-tasco', 'anonimas/tres.jpg');
insert into t_ids select 'um', id from public.place_photo where storage_path like '%/um.jpg';
insert into t_ids select 'dois', id from public.place_photo where storage_path like '%/dois.jpg';
insert into t_ids select 'tres', id from public.place_photo where storage_path like '%/tres.jpg';
reset role;
select pg_temp.expect('the server stamped the photos pending and as U''s',
  (select string_agg(distinct status || ':' || submitted_by, ',') from public.place_photo where place_id = 'tz-fot-tasco'),
  'pending:e3000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.as_user('e3000000-0000-4000-8000-000000000001');
select pg_temp.expect('U cannot read the sender column, not even of their own photos',
  split_part(pg_temp.refusal('select submitted_by from public.place_photo'), ' ', 1), 'permission');
select pg_temp.expect('U cannot approve their own photo',
  pg_temp.refusal(format('update public.place_photo set status = %L where id = %L', 'approved', pg_temp.id('um'))),
  'permission denied for table place_photo');
select pg_temp.expect('U cannot moderate',
  pg_temp.refusal(format('select public.moderate_place_photo(%L, true)', pg_temp.id('um'))), 'not_admin');

select pg_temp.expect('a dish for a place that does not exist is refused',
  pg_temp.refusal('insert into public.dish (place_id, name) values (''nao-existe'', ''Prego'')') = 'accepted', false);
select pg_temp.expect('a dish cannot be sent already approved',
  pg_temp.refusal('insert into public.dish (place_id, name, status) values (''tz-fot-tasco'', ''Prego'', ''approved'')'),
  'permission denied for table dish');
select pg_temp.expect('a dish cannot be sent as the specialty',
  pg_temp.refusal('insert into public.dish (place_id, name, is_specialty) values (''tz-fot-tasco'', ''Prego'', true)'),
  'permission denied for table dish');
insert into public.dish (place_id, name, price_cents, prep_minutes, temperature)
values ('tz-fot-tasco', 'Prego no Pão', 450, 5, 'hot');
insert into t_ids select 'prato', id from public.dish where name = 'Prego no Pão';
reset role;
select pg_temp.expect('the server stamped the dish pending, as U''s, with no recommendations',
  (select status || ':' || submitted_by || ':' || is_specialty || ':' || recommendations_count from public.dish where id = pg_temp.id('prato')),
  'pending:e3000000-0000-4000-8000-000000000001:false:0');
set local role authenticated;
select pg_temp.as_user('e3000000-0000-4000-8000-000000000001');
select pg_temp.expect('nobody reads who suggested a dish',
  split_part(pg_temp.refusal('select submitted_by from public.dish'), ' ', 1), 'permission');
select pg_temp.expect('a price in cents must be whole and in range',
  split_part(pg_temp.refusal('insert into public.dish (place_id, name, price_cents) values (''tz-fot-tasco'', ''Caro'', 1000000)'), ' ', 1),
  'new');
select pg_temp.expect('U cannot approve their own dish',
  pg_temp.refusal(format('update public.dish set status = %L where id = %L', 'approved', pg_temp.id('prato'))),
  'permission denied for table dish');
select pg_temp.expect('U sees the pending dish', pg_temp.visible(format('select id from public.dish where id = %L', pg_temp.id('prato'))), 1);
select pg_temp.expect('a pending dish cannot be recommended',
  split_part(pg_temp.refusal(format('insert into public.dish_recommendation (profile_id, dish_id) values (%L, %L)',
    'e3000000-0000-4000-8000-000000000001', pg_temp.id('prato'))), ' ', 1),
  'new');

-- 2. Others do not see what is pending.
select pg_temp.as_user('e3000000-0000-4000-8000-000000000002');
select pg_temp.expect('O does not see U''s pending photos',
  pg_temp.visible('select id from public.place_photo where place_id = ''tz-fot-tasco'''), 0);
select pg_temp.expect('O cannot delete U''s pending photo',
  pg_temp.affected(format('delete from public.place_photo where id = %L', pg_temp.id('um'))), 0);
select pg_temp.expect('O does not see U''s pending dish',
  pg_temp.visible(format('select id from public.dish where id = %L', pg_temp.id('prato'))), 0);
select pg_temp.expect('O cannot moderate',
  pg_temp.refusal(format('select public.moderate_place_photo(%L, true)', pg_temp.id('um'))), 'not_admin');

set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon does not see pending photos',
  pg_temp.visible('select id from public.place_photo where place_id = ''tz-fot-tasco'''), 0);
select pg_temp.expect('anon does not see pending dishes',
  pg_temp.visible(format('select id from public.dish where id = %L', pg_temp.id('prato'))), 0);
select pg_temp.expect('anon sees approved dishes',
  pg_temp.visible('select id from public.dish where place_id = ''tz-fot-tasco'''), 1);
select pg_temp.expect('anon cannot send photos',
  pg_temp.refusal('insert into public.place_photo (place_id, storage_path) values (''tz-fot-tasco'', ''anon/x.jpg'')'),
  'permission denied for table place_photo');
select pg_temp.expect('anon cannot send dishes',
  pg_temp.refusal('insert into public.dish (place_id, name) values (''tz-fot-tasco'', ''Prego'')'), 'permission denied for table dish');
select pg_temp.expect('anon cannot moderate',
  pg_temp.refusal(format('select public.moderate_place_photo(%L, true)', pg_temp.id('um'))),
  'permission denied for function moderate_place_photo');
select pg_temp.expect('anon cannot recommend', pg_temp.visible('select * from public.dish_recommendation'), -1);
select pg_temp.expect('anon cannot delete photos',
  pg_temp.refusal('delete from public.place_photo'), 'permission denied for table place_photo');

-- 3. The admin moderates.
set local role authenticated;
select pg_temp.as_user('e3000000-0000-4000-8000-000000000003');
select pg_temp.expect('the admin sees pending photos',
  pg_temp.visible('select id from public.place_photo where place_id = ''tz-fot-tasco'' and status = ''pending'''), 3);
select pg_temp.expect('the admin cannot approve by writing the row',
  pg_temp.refusal(format('update public.place_photo set status = %L where id = %L', 'approved', pg_temp.id('um'))),
  'permission denied for table place_photo');
select public.moderate_place_photo(pg_temp.id('um'), true);
select public.moderate_place_photo(pg_temp.id('dois'), false);
select pg_temp.expect('a photo is moderated only once',
  pg_temp.refusal(format('select public.moderate_place_photo(%L, false)', pg_temp.id('um'))), 'photo_not_pending');
select pg_temp.expect('an unknown photo cannot be moderated',
  pg_temp.refusal('select public.moderate_place_photo(''00000000-0000-4000-8000-000000000000'', true)'), 'photo_not_pending');
reset role;
select pg_temp.expect('the decision and who took it are recorded',
  (select status || ':' || moderated_by from public.place_photo where id = pg_temp.id('um')),
  'approved:e3000000-0000-4000-8000-000000000003');
set local role authenticated;
select pg_temp.as_user('e3000000-0000-4000-8000-000000000003');
select pg_temp.expect('the admin cannot delete someone''s photos',
  pg_temp.affected('delete from public.place_photo where place_id = ''tz-fot-tasco'''), 0);
select pg_temp.expect('the admin cannot approve a dish through the API',
  pg_temp.refusal(format('update public.dish set status = %L where id = %L', 'approved', pg_temp.id('prato'))),
  'permission denied for table dish');
select pg_temp.expect('the admin does not see U''s pending dish', pg_temp.visible(format('select id from public.dish where id = %L', pg_temp.id('prato'))), 0);

-- 4. After moderation: approved is public, rejected is only U's.
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon sees exactly the approved photo',
  (select string_agg(id::text, ',') from public.place_photo where place_id = 'tz-fot-tasco'), pg_temp.id('um')::text);
select pg_temp.expect('no non-approved photo is readable without an account',
  pg_temp.visible('select id from public.place_photo where status <> ''approved'''), 0);
set local role authenticated;
select pg_temp.as_user('e3000000-0000-4000-8000-000000000004');
select pg_temp.expect('a fresh account sees exactly the approved photo',
  (select string_agg(status, ',') from public.place_photo where place_id = 'tz-fot-tasco'), 'approved');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000001');
select pg_temp.expect('U sees all three, with their status',
  (select string_agg(status, ',' order by status) from public.place_photo where place_id = 'tz-fot-tasco'),
  'approved,pending,rejected');
select pg_temp.expect('U cannot delete an approved photo',
  pg_temp.affected(format('delete from public.place_photo where id = %L', pg_temp.id('um'))), 0);
select pg_temp.expect('U cannot delete a rejected photo',
  pg_temp.affected(format('delete from public.place_photo where id = %L', pg_temp.id('dois'))), 0);
select pg_temp.expect('U withdraws a pending photo',
  pg_temp.affected(format('delete from public.place_photo where id = %L', pg_temp.id('tres'))), 1);

-- 5. Recommending dishes: approved only, once, as yourself; the server keeps the count.
select pg_temp.expect('a recommendation as someone else is refused',
  split_part(pg_temp.refusal('insert into public.dish_recommendation (profile_id, dish_id) values (''e3000000-0000-4000-8000-000000000002'', ''d3000000-0000-4000-8000-0000000000a1'')'), ' ', 1),
  'new');
insert into public.dish_recommendation (profile_id, dish_id) values ('e3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-0000000000a1');
select pg_temp.expect('recommending twice is refused',
  split_part(pg_temp.refusal('insert into public.dish_recommendation (profile_id, dish_id) values (''e3000000-0000-4000-8000-000000000001'', ''d3000000-0000-4000-8000-0000000000a1'')'), ' ', 1),
  'duplicate');
select pg_temp.expect('nobody writes the count directly',
  pg_temp.refusal('update public.dish set recommendations_count = 99'), 'permission denied for table dish');
select pg_temp.as_user('e3000000-0000-4000-8000-000000000002');
insert into public.dish_recommendation (profile_id, dish_id) values ('e3000000-0000-4000-8000-000000000002', 'd3000000-0000-4000-8000-0000000000a1');
select pg_temp.expect('two recommendations, counted by the server',
  (select recommendations_count from public.dish where id = 'd3000000-0000-4000-8000-0000000000a1'), 2);
select pg_temp.expect('O sees only O''s recommendation', pg_temp.visible('select * from public.dish_recommendation'), 1);
select pg_temp.expect('O cannot withdraw U''s recommendation',
  pg_temp.affected('delete from public.dish_recommendation where profile_id = ''e3000000-0000-4000-8000-000000000001'''), 0);
select pg_temp.expect('O withdraws their own',
  pg_temp.affected('delete from public.dish_recommendation where profile_id = ''e3000000-0000-4000-8000-000000000002'''), 1);
select pg_temp.expect('the count goes back down',
  (select recommendations_count from public.dish where id = 'd3000000-0000-4000-8000-0000000000a1'), 1);
select pg_temp.as_user('e3000000-0000-4000-8000-000000000003');
select pg_temp.expect('the admin does not see who recommended', pg_temp.visible('select * from public.dish_recommendation'), 0);

-- 6. Rate limits: 10 photos and 20 dishes a day.
reset role;
insert into public.rate_limit_hit (profile_id, bucket)
select 'e3000000-0000-4000-8000-000000000004', b from unnest(array['place_photo', 'dish_suggestion']) as b, generate_series(1, 20) as n
where b = 'dish_suggestion' or n <= 10;
set local role authenticated;
select pg_temp.as_user('e3000000-0000-4000-8000-000000000004');
select pg_temp.expect('the 11th photo of the day is refused',
  pg_temp.refusal('insert into public.place_photo (place_id, storage_path) values (''tz-fot-tasco'', ''anonimas/onze.jpg'')'),
  'place_photo_rate_limited');
select pg_temp.expect('the 21st dish of the day is refused',
  pg_temp.refusal('insert into public.dish (place_id, name) values (''tz-fot-tasco'', ''Vigésimo Primeiro'')'),
  'dish_suggestion_rate_limited');

-- 7. Who sent an approved photo must not be readable (DECISOES 2026-09-16: «sem dizer quem a enviou»).
--    Any signed-in person can turn a profile id into a name and photo with profile_cards, so the id is enough.
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon cannot read who sent a photo',
  pg_temp.refusal('select submitted_by from public.place_photo'), 'permission denied for table place_photo');
select pg_temp.expect('no readable column of an approved photo carries the sender''s id',
  pg_temp.visible('select id from public.place_photo as ph where ph.place_id = ''tz-fot-tasco'' and (ph.id::text || ph.place_id || ph.storage_path || ph.status) like ''%e3000000-0000-4000-8000-000000000001%'''), 0);
set local role authenticated;
select pg_temp.as_user('e3000000-0000-4000-8000-000000000004');
select pg_temp.expect('a signed-in stranger cannot learn who sent the photo',
  pg_temp.visible('select id from public.place_photo as ph where ph.place_id = ''tz-fot-tasco'' and (ph.id::text || ph.place_id || ph.storage_path || ph.status) like ''%e3000000-0000-4000-8000-000000000001%'''), 0);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
