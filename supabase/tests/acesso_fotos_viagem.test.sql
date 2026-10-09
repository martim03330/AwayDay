-- Access tests for trip photos: trip_photo, the trip-photos storage folder, and the memories built on them.
--
-- People: A and B went to the game; X is in a group with both of them but did not go; Y is in a group with A only;
-- O is an outsider; ADM is an admin.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_fotos_viagem.test.sql

begin;

create temporary table expect_log (name text) on commit drop;
create temporary table t_ids (key text primary key, id uuid) on commit drop;
grant insert, select, update on expect_log, t_ids to authenticated, anon;

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

-- Runs a call that must be refused, and returns its message (or 'accepted').
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

-- Tries select, insert, update and delete on a table with the current role, and says what got through.
-- 'denied' = no privilege on the table; 'rls' = blocked by row level security; 'allowed' = it ran.
create function pg_temp.direct_access(p_table text)
returns text
language plpgsql
as $$
declare
  coluna text;
  resultado text := '';
  operacao text;
  comando text;
  estado text;
begin
  select a.attname into coluna
  from pg_catalog.pg_attribute as a
  where a.attrelid = ('public.' || p_table)::regclass and a.attnum = 1;
  foreach operacao in array array['select', 'insert', 'update', 'delete'] loop
    comando := case operacao
      when 'select' then format('select count(*) from public.%I', p_table)
      when 'insert' then format('insert into public.%I default values', p_table)
      when 'update' then format('update public.%I set %I = %I', p_table, coluna, coluna)
      else format('delete from public.%I', p_table)
    end;
    begin
      execute comando;
      estado := 'allowed';
    exception when others then
      estado := case
        when sqlerrm like 'permission denied%' then 'denied'
        when sqlerrm like '%row-level security%' then 'rls'
        else 'allowed'
      end;
    end;
    resultado := resultado || operacao || ':' || estado || ' ';
  end loop;
  return btrim(resultado);
end;
$$;

create function pg_temp.id(p_key text)
returns uuid
language sql
as $$
  select id from t_ids where key = p_key;
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

-- A game of our own, so the board only has the rides made here.
create function pg_temp.make_fixture(p_id text, p_kickoff timestamptz)
returns void
language sql
as $$
  insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at)
  select p_id, f.competition_id, f.stage, f.home_club_id, f.away_club_id, v.id, p_kickoff
  from public.fixture as f
  cross join lateral (
    select v.id from public.venue as v
    where v.location is not null and v.country = 'Portugal'
    order by v.id limit 1
  ) as v
  order by f.id
  limit 1;
$$;

-- A ride as the rides edge function writes it: total = fuel + tolls, worked out on the server.
create function pg_temp.make_ride(
  p_id uuid, p_fixture text, p_driver uuid, p_seats integer, p_fuel integer, p_tolls integer,
  p_round boolean default false, p_group uuid default null, p_visibility text default 'publica'
)
returns void
language sql
as $$
  insert into public.ride (
    id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
    distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
    total_cents, group_id, visibility
  )
  select p_id, f.id, p_driver, 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)', f.kickoff_at - interval '3 hours',
    p_seats, 'rapida', p_round, 100000, 3600, 20000, 600, 1700, p_fuel, p_tolls, p_fuel + p_tolls, p_group,
    p_visibility
  from public.fixture as f
  where f.id = p_fixture;
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('e6000000-0000-4000-8000-000000000001', 'fotos-a@test.invalid', '{"display_name":"Fotos A"}', 'authenticated', 'authenticated'),
  ('e6000000-0000-4000-8000-000000000002', 'fotos-b@test.invalid', '{"display_name":"Fotos B"}', 'authenticated', 'authenticated'),
  ('e6000000-0000-4000-8000-000000000003', 'fotos-x@test.invalid', '{"display_name":"Fotos X"}', 'authenticated', 'authenticated'),
  ('e6000000-0000-4000-8000-000000000004', 'fotos-y@test.invalid', '{"display_name":"Fotos Y"}', 'authenticated', 'authenticated'),
  ('e6000000-0000-4000-8000-000000000005', 'fotos-o@test.invalid', '{"display_name":"Fotos O"}', 'authenticated', 'authenticated'),
  ('e6000000-0000-4000-8000-000000000006', 'fotos-adm@test.invalid', '{"display_name":"Fotos Adm"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'e6000000-0000-4000-8000-000000000006';

-- G1: A, B (who went) and X (who stayed home). G2: A and Y (only one of the trip's people).
insert into public.fan_group (id, name, created_by, invite_code)
values
  ('e6000000-0000-4000-8000-0000000000a1', 'Grupo Fotos', 'e6000000-0000-4000-8000-000000000001', 'tfotos0001'),
  ('e6000000-0000-4000-8000-0000000000a2', 'Grupo Outro', 'e6000000-0000-4000-8000-000000000001', 'tfotos0002');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('e6000000-0000-4000-8000-0000000000a1', 'e6000000-0000-4000-8000-000000000001', 'owner'),
  ('e6000000-0000-4000-8000-0000000000a1', 'e6000000-0000-4000-8000-000000000002', 'member'),
  ('e6000000-0000-4000-8000-0000000000a1', 'e6000000-0000-4000-8000-000000000003', 'member'),
  ('e6000000-0000-4000-8000-0000000000a2', 'e6000000-0000-4000-8000-000000000001', 'owner'),
  ('e6000000-0000-4000-8000-0000000000a2', 'e6000000-0000-4000-8000-000000000004', 'member');

-- A and B went to a game two days ago, with loose accounts of their own.
select pg_temp.make_fixture('teste-acesso-fotos', now() - interval '2 days');
insert into t_ids (key, id) values ('s', gen_random_uuid()), ('outra', gen_random_uuid());
insert into public.trip_session (id, fixture_id, opened_by, name)
values
  (pg_temp.id('s'), 'teste-acesso-fotos', 'e6000000-0000-4000-8000-000000000001', 'Ida ao jogo'),
  (pg_temp.id('outra'), 'teste-acesso-fotos', 'e6000000-0000-4000-8000-000000000005', 'Outra viagem');
insert into public.trip_session_member (session_id, profile_id, added_by)
values
  (pg_temp.id('s'), 'e6000000-0000-4000-8000-000000000001', 'e6000000-0000-4000-8000-000000000001'),
  (pg_temp.id('s'), 'e6000000-0000-4000-8000-000000000002', 'e6000000-0000-4000-8000-000000000001'),
  (pg_temp.id('outra'), 'e6000000-0000-4000-8000-000000000005', 'e6000000-0000-4000-8000-000000000005');

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. No direct access.

set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon: no direct access to trip_photo', pg_temp.direct_access('trip_photo'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon cannot list trip photos',
  pg_temp.refusal(format('select * from public.trip_photos(%L)', pg_temp.id('s'))), 'permission denied for function trip_photos');
select pg_temp.expect('anon cannot read a trip memory',
  pg_temp.refusal(format('select * from public.trip_memory(%L)', pg_temp.id('s'))), 'permission denied for function trip_memory');
select pg_temp.expect('anon sees no trip photo files',
  (select count(*)::integer from storage.objects where bucket_id = 'trip-photos' and name like pg_temp.id('s')::text || '/%'), 0);

set local role authenticated;
select pg_temp.as_user('e6000000-0000-4000-8000-000000000001');
select pg_temp.expect('member: no direct access to trip_photo', pg_temp.direct_access('trip_photo'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.as_user('e6000000-0000-4000-8000-000000000006');
select pg_temp.expect('admin: no direct access to trip_photo', pg_temp.direct_access('trip_photo'),
  'select:denied insert:denied update:denied delete:denied');

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Only who went adds photos, and only in the trip's own folder.

select pg_temp.as_user('e6000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider cannot add a photo',
  pg_temp.refusal(format('select public.add_trip_photo(%L, %L)', pg_temp.id('s'), pg_temp.id('s')::text || '/a.jpg')), 'not_member');
select pg_temp.as_user('e6000000-0000-4000-8000-000000000003');
select pg_temp.expect('a group mate who did not go cannot add a photo',
  pg_temp.refusal(format('select public.add_trip_photo(%L, %L)', pg_temp.id('s'), pg_temp.id('s')::text || '/a.jpg')), 'not_member');
select pg_temp.as_user('e6000000-0000-4000-8000-000000000001');
select pg_temp.expect('a photo must live in the trip''s folder',
  pg_temp.refusal(format('select public.add_trip_photo(%L, %L)', pg_temp.id('s'), pg_temp.id('outra')::text || '/a.jpg')), 'bad_path');
select pg_temp.expect('no climbing out of the folder',
  pg_temp.refusal(format('select public.add_trip_photo(%L, %L)', pg_temp.id('s'), pg_temp.id('s')::text || '/../a.jpg')), 'bad_path');
select pg_temp.expect('a caption over 140 letters is refused',
  split_part(pg_temp.refusal(format('select public.add_trip_photo(%L, %L, %L)', pg_temp.id('s'), pg_temp.id('s')::text || '/b.jpg',
    repeat('x', 141))), ' "', 1),
  'new row for relation');
insert into t_ids (key, id) values ('foto', public.add_trip_photo(pg_temp.id('s'), pg_temp.id('s')::text || '/a.jpg', '  No estádio  '));

-- The file itself, through the storage policies.
insert into storage.objects (bucket_id, name, owner_id)
values ('trip-photos', pg_temp.id('s')::text || '/a.jpg', 'e6000000-0000-4000-8000-000000000001');
select pg_temp.expect('who went cannot upload into another trip''s folder',
  split_part(pg_temp.refusal(format('insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)',
    'trip-photos', pg_temp.id('outra')::text || '/b.jpg', 'e6000000-0000-4000-8000-000000000001')), ' "', 1),
  'new row violates row-level security policy for table');
select pg_temp.as_user('e6000000-0000-4000-8000-000000000003');
select pg_temp.expect('a group mate who did not go cannot upload',
  split_part(pg_temp.refusal(format('insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)',
    'trip-photos', pg_temp.id('s')::text || '/c.jpg', 'e6000000-0000-4000-8000-000000000003')), ' "', 1),
  'new row violates row-level security policy for table');

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Who sees the memories: who went, and the people of a group where at least two of them went.

select pg_temp.as_user('e6000000-0000-4000-8000-000000000002');
select pg_temp.expect('the other person who went sees the photo',
  (select caption || ':' || mine from public.trip_photos(pg_temp.id('s'))), 'No estádio:false');
select pg_temp.expect('and the file',
  (select count(*)::integer from storage.objects where bucket_id = 'trip-photos' and name = pg_temp.id('s')::text || '/a.jpg'), 1);
select pg_temp.expect('who went cannot remove someone else''s photo',
  pg_temp.refusal(format('select public.remove_trip_photo(%L)', pg_temp.id('foto'))), 'not_yours');

select pg_temp.as_user('e6000000-0000-4000-8000-000000000003');
select pg_temp.expect('a mate from a group where two of them went sees the photo',
  (select count(*)::integer from public.trip_photos(pg_temp.id('s'))), 1);
select pg_temp.expect('and the file',
  (select count(*)::integer from storage.objects where bucket_id = 'trip-photos' and name = pg_temp.id('s')::text || '/a.jpg'), 1);
select pg_temp.expect('and the memory, marked as not having gone',
  (select array_to_string(people_names, ',') || ':' || photos || ':' || i_went from public.trip_memory(pg_temp.id('s'))),
  'Fotos A,Fotos B:1:false');
select pg_temp.expect('and the group''s history',
  (select companions_count || ':' || photos from public.group_history('e6000000-0000-4000-8000-0000000000a1')
   where session_id = pg_temp.id('s')), '2:1');
select pg_temp.expect('a mate cannot remove the photo',
  pg_temp.refusal(format('select public.remove_trip_photo(%L)', pg_temp.id('foto'))), 'not_yours');
select pg_temp.expect('a mate does not see the money of a trip they did not go on',
  (select count(*)::integer from public.trip_expenses(pg_temp.id('s'))), 0);

select pg_temp.as_user('e6000000-0000-4000-8000-000000000004');
select pg_temp.expect('a mate from a group with only one of them does not see the photo',
  (select count(*)::integer from public.trip_photos(pg_temp.id('s'))), 0);
select pg_temp.expect('nor the file',
  (select count(*)::integer from storage.objects where bucket_id = 'trip-photos' and name like pg_temp.id('s')::text || '/%'), 0);
select pg_temp.expect('nor the memory', (select count(*)::integer from public.trip_memory(pg_temp.id('s'))), 0);
select pg_temp.expect('nor the trip in that group''s history',
  (select count(*)::integer from public.group_history('e6000000-0000-4000-8000-0000000000a2')), 0);

select pg_temp.as_user('e6000000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider sees no photo', (select count(*)::integer from public.trip_photos(pg_temp.id('s'))), 0);
select pg_temp.expect('nor the file',
  (select count(*)::integer from storage.objects where bucket_id = 'trip-photos' and name like pg_temp.id('s')::text || '/%'), 0);
select pg_temp.expect('nor the memory', (select count(*)::integer from public.trip_memory(pg_temp.id('s'))), 0);
select pg_temp.expect('nor someone else''s group history',
  (select count(*)::integer from public.group_history('e6000000-0000-4000-8000-0000000000a1')), 0);
select pg_temp.expect('an outsider cannot remove the photo',
  pg_temp.refusal(format('select public.remove_trip_photo(%L)', pg_temp.id('foto'))), 'not_yours');

select pg_temp.as_user('e6000000-0000-4000-8000-000000000006');
select pg_temp.expect('an admin sees no trip photo', (select count(*)::integer from public.trip_photos(pg_temp.id('s'))), 0);
select pg_temp.expect('nor the file',
  (select count(*)::integer from storage.objects where bucket_id = 'trip-photos' and name like pg_temp.id('s')::text || '/%'), 0);

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. The owner removes their photo and gets the path back to delete the file.

select pg_temp.as_user('e6000000-0000-4000-8000-000000000001');
select pg_temp.expect('the owner removes the photo and gets its path',
  public.remove_trip_photo(pg_temp.id('foto')), pg_temp.id('s')::text || '/a.jpg');
select pg_temp.expect('the photo is gone', (select count(*)::integer from public.trip_photos(pg_temp.id('s'))), 0);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
