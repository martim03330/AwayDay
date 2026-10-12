-- Access tests for people's profiles: profile, profile_club, the email, and the profile RPCs.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_perfil.test.sql
--
-- People: A owns the rows, B is another account, F is a fresh account, D is an admin, plus S1..S5 supporters
-- of a club nobody supports yet (for the "at least 5 people" rule). Anon has no account.

begin;

create temporary table expect_log (name text) on commit drop;
create temporary table t_ids (key text primary key, txt text) on commit drop;
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

-- How many rows a statement touched (0 when RLS hides the row).
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
values
  ('ad000001-0000-4000-8000-0000000000a1', 'acesso-perfil-a@test.invalid', '{"display_name":"Perfil A"}', 'authenticated', 'authenticated'),
  ('ad000001-0000-4000-8000-0000000000b1', 'acesso-perfil-b@test.invalid', '{"display_name":"Perfil B"}', 'authenticated', 'authenticated'),
  ('ad000001-0000-4000-8000-0000000000f1', 'acesso-perfil-f@test.invalid', '{"display_name":"x"}', 'authenticated', 'authenticated'),
  ('ad000001-0000-4000-8000-0000000000d1', 'acesso-perfil-d@test.invalid', '{"display_name":"Perfil Admin"}', 'authenticated', 'authenticated'),
  ('ad000001-0000-4000-8000-000000000051', 'acesso-perfil-s1@test.invalid', '{"display_name":"Adepto Um"}', 'authenticated', 'authenticated'),
  ('ad000001-0000-4000-8000-000000000052', 'acesso-perfil-s2@test.invalid', '{"display_name":"Adepto Dois"}', 'authenticated', 'authenticated'),
  ('ad000001-0000-4000-8000-000000000053', 'acesso-perfil-s3@test.invalid', '{"display_name":"Adepto Tres"}', 'authenticated', 'authenticated'),
  ('ad000001-0000-4000-8000-000000000054', 'acesso-perfil-s4@test.invalid', '{"display_name":"Adepto Quatro"}', 'authenticated', 'authenticated'),
  ('ad000001-0000-4000-8000-000000000055', 'acesso-perfil-s5@test.invalid', '{"display_name":"Adepto Cinco"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'ad000001-0000-4000-8000-0000000000d1';

-- A club nobody supports yet, and a second club for the hometown.
insert into t_ids (key, txt)
select 'club', c.id from public.club as c
where not exists (select 1 from public.profile_club as pc where pc.club_id = c.id)
order by c.id limit 1;
insert into t_ids (key, txt)
select 'club2', c.id from public.club as c where c.id <> (select txt from t_ids where key = 'club') order by c.id limit 1;
select pg_temp.expect('there is a club nobody supports', (select count(*)::integer from t_ids), 2);

-- B already has a supporter club, a hometown club and a city.
insert into public.profile_club (profile_id, relation, club_id)
values
  ('ad000001-0000-4000-8000-0000000000b1', 'supporter', (select txt from t_ids where key = 'club2')),
  ('ad000001-0000-4000-8000-0000000000b1', 'hometown', (select txt from t_ids where key = 'club'));
update public.profile set home_city = 'Viseu' where id = 'ad000001-0000-4000-8000-0000000000b1';

-- 0. A new account gets a profile, with everything that needs a yes switched off.
select pg_temp.expect('the sign-up trigger creates the profile',
  (select count(*)::integer from public.profile where id::text like 'ad000001-%'), 9);
select pg_temp.expect('a name too short becomes Adepto',
  (select display_name from public.profile where id = 'ad000001-0000-4000-8000-0000000000f1'), 'Adepto');
select pg_temp.expect('a fresh account starts without AI tips, recap, admin or check-in sharing, and in the rankings',
  (select format('%s/%s/%s/%s/%s', nudges_enabled, recap_enabled, show_in_rankings, is_admin,
     coalesce(share_checkins_with_groups, false))
   from public.profile where id = 'ad000001-0000-4000-8000-0000000000f1'),
  'f/f/t/f/f');

-- 1. Anon reads nothing and calls nothing.
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon cannot read profiles',
  pg_temp.refusal('select count(*) from public.profile'), 'permission denied for table profile');
select pg_temp.expect('anon cannot read clubs of people',
  pg_temp.refusal('select count(*) from public.profile_club'), 'permission denied for table profile_club');
select pg_temp.expect('anon cannot read auth.users',
  split_part(pg_temp.refusal('select count(*) from auth.users'), ' ', 1), 'permission');
select pg_temp.expect('anon cannot ask for profile cards',
  pg_temp.refusal('select * from public.profile_cards(array[''ad000001-0000-4000-8000-0000000000b1''::uuid])'),
  'permission denied for function profile_cards');
select pg_temp.expect('anon cannot set a name',
  pg_temp.refusal('select public.set_display_name(''Anonimo'')'), 'permission denied for function set_display_name');
select pg_temp.expect('anon cannot set a city',
  pg_temp.refusal('select public.set_home_city(''Porto'')'), 'permission denied for function set_home_city');
select pg_temp.expect('anon cannot set a photo',
  pg_temp.refusal('select public.set_profile_photo(''x/y.jpg'')'), 'permission denied for function set_profile_photo');
select pg_temp.expect('anon cannot clear a photo',
  pg_temp.refusal('select public.clear_profile_photo()'), 'permission denied for function clear_profile_photo');
select pg_temp.expect('anon cannot change check-in sharing',
  pg_temp.refusal('select public.set_share_checkins_with_groups(true)'),
  'permission denied for function set_share_checkins_with_groups');
select pg_temp.expect('anon cannot ask who is admin',
  pg_temp.refusal('select public.is_admin()'), 'permission denied for function is_admin');
select pg_temp.expect('anon can read supporter counts (aggregate only)',
  pg_temp.refusal('select count(*) from public.club_supporter_counts()'), 'accepted');

-- 2. A signed-in person reads only their own profile, and changes only the safe columns.
set local role authenticated;
select pg_temp.as_user('ad000001-0000-4000-8000-0000000000a1');
select pg_temp.expect('A sees exactly one profile: their own',
  (select string_agg(id::text, ',') from public.profile), 'ad000001-0000-4000-8000-0000000000a1');
select pg_temp.expect('A cannot read auth.users',
  split_part(pg_temp.refusal('select email from auth.users'), ' ', 1), 'permission');
select pg_temp.expect('A cannot change the name directly (only set_display_name, with its weekly limit)',
  pg_temp.refusal('update public.profile set display_name = ''Perfil A2'' where id = ''ad000001-0000-4000-8000-0000000000a1'''),
  'permission denied for table profile');
select pg_temp.expect('A cannot change B''s name either',
  pg_temp.refusal('update public.profile set display_name = ''Pirata'' where id = ''ad000001-0000-4000-8000-0000000000b1'''),
  'permission denied for table profile');
select pg_temp.expect('A cannot make themselves admin',
  pg_temp.refusal('update public.profile set is_admin = true where id = ''ad000001-0000-4000-8000-0000000000a1'''),
  'permission denied for table profile');
select pg_temp.expect('A cannot set a photo path directly',
  pg_temp.refusal('update public.profile set avatar_path = ''ad000001-0000-4000-8000-0000000000b1/x.jpg'''),
  'permission denied for table profile');
select pg_temp.expect('A cannot turn on check-in sharing directly',
  pg_temp.refusal('update public.profile set share_checkins_with_groups = true'),
  'permission denied for table profile');
select pg_temp.expect('A cannot change the profile id',
  pg_temp.refusal('update public.profile set id = gen_random_uuid()'), 'permission denied for table profile');
select pg_temp.expect('A cannot create a profile',
  pg_temp.refusal('insert into public.profile (id, display_name) values (gen_random_uuid(), ''Falso'')'),
  'permission denied for table profile');
select pg_temp.expect('A cannot delete a profile (accounts go through delete-account)',
  pg_temp.refusal('delete from public.profile'), 'permission denied for table profile');
select pg_temp.expect('a name over 40 is refused',
  pg_temp.refusal('select public.set_display_name(repeat(''a'', 41))'), 'bad_name');
select pg_temp.expect('A turns on AI tips and recap (the opt-in)',
  pg_temp.affected('update public.profile set nudges_enabled = true, recap_enabled = true, show_in_rankings = true where id = ''ad000001-0000-4000-8000-0000000000a1'''), 1);
select pg_temp.expect('is_admin() is false for A', public.is_admin(), false);

-- 3. The profile RPCs.
select pg_temp.expect('a 1-letter name is refused', pg_temp.refusal('select public.set_display_name('' a '')'), 'bad_name');
select pg_temp.expect('a 41-letter name is refused',
  pg_temp.refusal(format('select public.set_display_name(%L)', repeat('a', 41))), 'bad_name');
select public.set_display_name('  Perfil A3  ');
select pg_temp.expect('the name is trimmed', (select display_name from public.profile), 'Perfil A3');
select public.set_display_name('Perfil A4');
select public.set_display_name('Perfil A5');
select public.set_display_name('Perfil A6');
select public.set_display_name('Perfil A7');
select pg_temp.expect('6th name change in a week is refused',
  pg_temp.refusal('select public.set_display_name(''Perfil A8'')'), 'rate_limited');

select pg_temp.expect('a 1-letter city is refused', pg_temp.refusal('select public.set_home_city(''X'')'), 'bad_city');
select public.set_home_city('  Coimbra ');
select pg_temp.expect('the city is trimmed', (select home_city from public.profile), 'Coimbra');
select public.set_home_city('   ');
select pg_temp.expect('a blank city clears it', (select home_city from public.profile), null::text);

select pg_temp.expect('a photo in someone else''s folder is refused',
  pg_temp.refusal('select public.set_profile_photo(''ad000001-0000-4000-8000-0000000000b1/foto.jpg'')'), 'bad_path');
select pg_temp.expect('a photo path that climbs folders is refused',
  pg_temp.refusal('select public.set_profile_photo(''ad000001-0000-4000-8000-0000000000a1/../b/foto.jpg'')'), 'bad_path');
select pg_temp.expect('a missing photo path is refused',
  pg_temp.refusal('select public.set_profile_photo(null)'), 'bad_path');
select public.set_profile_photo('ad000001-0000-4000-8000-0000000000a1/foto.jpg');
select pg_temp.expect('own photo set', (select avatar_path from public.profile), 'ad000001-0000-4000-8000-0000000000a1/foto.jpg');
select public.clear_profile_photo();
select pg_temp.expect('own photo cleared', (select avatar_path from public.profile), null::text);

select public.set_share_checkins_with_groups(true);
select pg_temp.expect('check-in sharing on through the RPC', (select share_checkins_with_groups from public.profile), true);
select public.set_share_checkins_with_groups(false);
select pg_temp.expect('check-in sharing off again', (select share_checkins_with_groups from public.profile), false);

select pg_temp.expect('non-admin cannot clear someone''s photo',
  pg_temp.refusal('select public.admin_clear_profile_photo(''ad000001-0000-4000-8000-0000000000b1'')'), 'not_admin');
select pg_temp.expect('non-admin gets no reported photos',
  (select count(*)::integer from public.reported_profile_photos()), 0);

-- 4. Profile cards: name, photo, city and reputation, never the email or the clubs; and only of people A has a
-- reason to see (crossed paths, a driver with an open ride, a plan A sees), so nobody can dump every profile.
select pg_temp.expect('a stranger''s card is not given',
  (select count(*)::integer from public.profile_cards(array['ad000001-0000-4000-8000-0000000000b1'::uuid])), 0);
reset role;
insert into public.fan_group (id, name, created_by, invite_code)
values ('c0000001-0000-4000-8000-0000000000a1', 'Grupo Perfil', 'ad000001-0000-4000-8000-0000000000a1', 'acperfil01');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('c0000001-0000-4000-8000-0000000000a1', 'ad000001-0000-4000-8000-0000000000a1', 'owner'),
  ('c0000001-0000-4000-8000-0000000000a1', 'ad000001-0000-4000-8000-0000000000b1', 'member');
set local role authenticated;
select pg_temp.as_user('ad000001-0000-4000-8000-0000000000a1');
select pg_temp.expect('profile card shows the public bits of B, now in A''s group',
  (select display_name || '/' || coalesce(home_city, '-') || '/' || is_me::text
   from public.profile_cards(array['ad000001-0000-4000-8000-0000000000b1'::uuid])),
  'Perfil B/Viseu/false');
select pg_temp.expect('profile card marks me as me',
  (select is_me from public.profile_cards(array['ad000001-0000-4000-8000-0000000000a1'::uuid])), true);
select pg_temp.expect('unknown ids give no card',
  (select count(*)::integer from public.profile_cards(array[gen_random_uuid()])), 0);

-- 5. Clubs: only the owner sees theirs, supporter or hometown.
select pg_temp.expect('A sees none of B''s clubs (hometown included)',
  (select count(*)::integer from public.profile_club), 0);
insert into public.profile_club (profile_id, relation, club_id)
values
  ('ad000001-0000-4000-8000-0000000000a1', 'supporter', (select txt from t_ids where key = 'club')),
  ('ad000001-0000-4000-8000-0000000000a1', 'hometown', (select txt from t_ids where key = 'club2'));
select pg_temp.expect('A sees their two clubs', (select count(*)::integer from public.profile_club), 2);
select pg_temp.expect('A cannot add a club for B',
  pg_temp.refusal(format('insert into public.profile_club (profile_id, relation, club_id) values (%L, %L, %L)',
    'ad000001-0000-4000-8000-0000000000f1', 'supporter', (select txt from t_ids where key = 'club'))),
  'new row violates row-level security policy for table "profile_club"');
select pg_temp.expect('A cannot move their club to B',
  pg_temp.refusal('update public.profile_club set profile_id = ''ad000001-0000-4000-8000-0000000000f1'''),
  'new row violates row-level security policy for table "profile_club"');
select pg_temp.expect('A changes nothing of B''s clubs',
  pg_temp.affected('update public.profile_club set club_id = club_id where profile_id = ''ad000001-0000-4000-8000-0000000000b1'''), 0);
select pg_temp.expect('A deletes nothing of B''s clubs',
  pg_temp.affected('delete from public.profile_club where profile_id = ''ad000001-0000-4000-8000-0000000000b1'''), 0);
select pg_temp.expect('only supporter and hometown',
  split_part(pg_temp.refusal(format('insert into public.profile_club (profile_id, relation, club_id) values (%L, %L, %L)',
    'ad000001-0000-4000-8000-0000000000a1', 'socio', (select txt from t_ids where key = 'club'))), ' ', 1),
  'new');
select pg_temp.expect('one supporter club per person',
  split_part(pg_temp.refusal(format('insert into public.profile_club (profile_id, relation, club_id) values (%L, %L, %L)',
    'ad000001-0000-4000-8000-0000000000a1', 'supporter', (select txt from t_ids where key = 'club2'))), ' ', 1),
  'duplicate');

-- 6. Fresh account and admin: still only their own rows.
select pg_temp.as_user('ad000001-0000-4000-8000-0000000000f1');
select pg_temp.expect('a fresh account sees only itself', (select count(*)::integer from public.profile), 1);
select pg_temp.expect('a fresh account sees no clubs', (select count(*)::integer from public.profile_club), 0);

select pg_temp.as_user('ad000001-0000-4000-8000-0000000000d1');
select pg_temp.expect('is_admin() is true for the admin', public.is_admin(), true);
select pg_temp.expect('the admin does not read other profiles directly', (select count(*)::integer from public.profile), 1);
select pg_temp.expect('the admin does not read other people''s clubs', (select count(*)::integer from public.profile_club), 0);
select pg_temp.expect('the admin cannot read auth.users either',
  split_part(pg_temp.refusal('select email from auth.users'), ' ', 1), 'permission');
select pg_temp.expect('the admin can clear a photo', pg_temp.refusal('select public.admin_clear_profile_photo(''ad000001-0000-4000-8000-0000000000b1'')'), 'accepted');

-- 7. Supporter counts: only supporters, only clubs with 5 or more.
reset role;
insert into public.profile_club (profile_id, relation, club_id)
select p.id, 'supporter', (select txt from t_ids where key = 'club')
from public.profile as p
where p.id in ('ad000001-0000-4000-8000-000000000051', 'ad000001-0000-4000-8000-000000000052',
               'ad000001-0000-4000-8000-000000000053');
insert into public.profile_club (profile_id, relation, club_id)
values ('ad000001-0000-4000-8000-000000000054', 'hometown', (select txt from t_ids where key = 'club'));
set local role authenticated;
select pg_temp.as_user('ad000001-0000-4000-8000-0000000000f1');
-- A + S1..S3 support it (4 people), B and S4 only have it as hometown.
select pg_temp.expect('4 supporters plus 2 hometowns stay hidden',
  (select count(*)::integer from public.club_supporter_counts() where club_id = (select txt from t_ids where key = 'club')), 0);
reset role;
insert into public.profile_club (profile_id, relation, club_id)
values ('ad000001-0000-4000-8000-000000000055', 'supporter', (select txt from t_ids where key = 'club'));
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('the 5th supporter publishes the count, without hometowns',
  (select supporters::integer from public.club_supporter_counts() where club_id = (select txt from t_ids where key = 'club')), 5);
select pg_temp.expect('the count says nothing about who',
  pg_get_function_result('public.club_supporter_counts()'::regprocedure), 'TABLE(club_id text, supporters bigint)');

-- 8. The email is never exposed: no client-visible column or function result carries it.
reset role;
select pg_temp.expect('no public table or view column named like email is readable by clients',
  (select count(*)::integer from information_schema.columns as c
   where c.table_schema = 'public' and c.column_name ilike '%email%'
     and (has_column_privilege('anon', format('public.%I', c.table_name), c.column_name, 'SELECT')
       or has_column_privilege('authenticated', format('public.%I', c.table_name), c.column_name, 'SELECT'))), 0);
select pg_temp.expect('no client-callable function returns an email',
  (select string_agg(p.proname, ',') from pg_proc as p
   where p.pronamespace = 'public'::regnamespace
     and pg_get_function_result(p.oid) ilike '%email%'
     and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))),
  null::text);
select pg_temp.expect('clients cannot read auth.users at all',
  has_table_privilege('authenticated', 'auth.users', 'SELECT') or has_table_privilege('anon', 'auth.users', 'SELECT'), false);

-- 9. Nothing was changed for B by anyone but the admin.
select pg_temp.expect('B''s profile untouched (photo cleared by admin only)',
  (select display_name || '/' || home_city || '/' || is_admin::text from public.profile
   where id = 'ad000001-0000-4000-8000-0000000000b1'), 'Perfil B/Viseu/false');
select pg_temp.expect('B''s clubs untouched',
  (select count(*)::integer from public.profile_club where profile_id = 'ad000001-0000-4000-8000-0000000000b1'), 2);

select count(*) as checks_passed from expect_log;

rollback;
