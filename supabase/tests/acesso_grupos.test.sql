-- Access tests for groups (A Malta): fan_group, fan_group_member, group_invite, invite codes and the group RPCs.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_grupos.test.sql
--
-- People: O owns the group, M is a member, X is an outsider, F is O's friend (fresh account), D is an admin.

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

create function pg_temp.txt(p_key text)
returns text
language sql
as $$
  select txt from t_ids where key = p_key;
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

-- Members of the test group, as the owner sees them in the table.
create function pg_temp.members(p_group text)
returns text
language sql
security definer
as $$
  select string_agg(p.display_name || ':' || m.role, ',' order by m.role desc, p.display_name)
  from public.fan_group_member as m join public.profile as p on p.id = m.profile_id
  where m.group_id = p_group::uuid;
$$;
grant execute on function pg_temp.members(text) to authenticated;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('ad000005-0000-4000-8000-0000000000a1', 'acesso-grupos-o@test.invalid', '{"display_name":"Grupo Dono"}', 'authenticated', 'authenticated'),
  ('ad000005-0000-4000-8000-0000000000b1', 'acesso-grupos-m@test.invalid', '{"display_name":"Grupo Membro"}', 'authenticated', 'authenticated'),
  ('ad000005-0000-4000-8000-0000000000e1', 'acesso-grupos-x@test.invalid', '{"display_name":"Grupo Fora"}', 'authenticated', 'authenticated'),
  ('ad000005-0000-4000-8000-0000000000f1', 'acesso-grupos-f@test.invalid', '{"display_name":"Grupo Amigo"}', 'authenticated', 'authenticated'),
  ('ad000005-0000-4000-8000-0000000000d1', 'acesso-grupos-d@test.invalid', '{"display_name":"Grupo Admin"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'ad000005-0000-4000-8000-0000000000d1';
insert into public.friendship (requester_id, addressee_id, status, responded_at)
values ('ad000005-0000-4000-8000-0000000000a1', 'ad000005-0000-4000-8000-0000000000f1', 'aceite', now());

-- 1. Anon.
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon cannot read groups', pg_temp.refusal('select count(*) from public.fan_group'), 'permission denied for table fan_group');
select pg_temp.expect('anon cannot read members', pg_temp.refusal('select count(*) from public.fan_group_member'), 'permission denied for table fan_group_member');
select pg_temp.expect('anon cannot read invites', pg_temp.refusal('select count(*) from public.group_invite'), 'permission denied for table group_invite');
select pg_temp.expect('anon cannot create a group', pg_temp.refusal('select public.create_group(''Grupo anonimo'')'), 'permission denied for function create_group');
select pg_temp.expect('anon cannot look up a code', pg_temp.refusal('select count(*) from public.group_by_code(''abcdefghij'')'), 'permission denied for function group_by_code');
select pg_temp.expect('anon cannot join with a code', pg_temp.refusal('select public.join_group_with_code(''abcdefghij'')'), 'permission denied for function join_group_with_code');
select pg_temp.expect('anon cannot list groups', pg_temp.refusal('select count(*) from public.my_groups()'), 'permission denied for function my_groups');

-- 2. Creating a group.
set local role authenticated;
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000a1');
select pg_temp.expect('the tables are closed to clients',
  pg_temp.refusal('select count(*) from public.fan_group'), 'permission denied for table fan_group');
select pg_temp.expect('members cannot be inserted directly',
  pg_temp.refusal('insert into public.fan_group_member (group_id, profile_id, role) values (gen_random_uuid(), ''ad000005-0000-4000-8000-0000000000a1'', ''owner'')'),
  'permission denied for table fan_group_member');
select pg_temp.expect('invites cannot be inserted directly',
  pg_temp.refusal('insert into public.group_invite (group_id, profile_id) values (gen_random_uuid(), ''ad000005-0000-4000-8000-0000000000e1'')'),
  'permission denied for table group_invite');
select pg_temp.expect('a 1-letter name is refused', pg_temp.refusal('select public.create_group('' a '')'), 'bad_name');
select pg_temp.expect('a 61-letter name is refused', pg_temp.refusal(format('select public.create_group(%L)', repeat('a', 61))), 'bad_name');
insert into t_ids (key, txt) values ('g', public.create_group('  Malta do Teste  ')::text);
select pg_temp.expect('the creator owns the group',
  (select name || ':' || role || ':' || members from public.my_groups() where id = pg_temp.txt('g')::uuid),
  'Malta do Teste:owner:1');
insert into t_ids (key, txt) select 'code', invite_code from public.my_groups() where id = pg_temp.txt('g')::uuid;
select pg_temp.expect('the code is 10 lowercase letters or digits', pg_temp.txt('code') ~ '^[a-z0-9]{10}$', true);

-- 3. X finds the group by its code, and only by its code.
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000e1');
select pg_temp.expect('X sees no groups', (select count(*)::integer from public.my_groups()), 0);
select pg_temp.expect('X sees no members before joining',
  (select count(*)::integer from public.group_members(pg_temp.txt('g')::uuid)), 0);
select pg_temp.expect('a wrong code finds nothing', (select count(*)::integer from public.group_by_code('zzzzzzzzzz')), 0);
select pg_temp.expect('an empty code finds nothing', (select count(*)::integer from public.group_by_code('')), 0);
select pg_temp.expect('the code finds the group, with spaces and capitals',
  (select name || ':' || members || ':' || already_in from public.group_by_code('  ' || upper(pg_temp.txt('code')) || ' ')),
  'Malta do Teste:1:false');
select pg_temp.expect('the code lookup gives no member names or codes',
  pg_get_function_result('public.group_by_code(text)'::regprocedure),
  'TABLE(id uuid, name text, members integer, already_in boolean)');
select pg_temp.expect('a wrong code cannot be joined', pg_temp.refusal('select public.join_group_with_code(''zzzzzzzzzz'')'), 'group_not_found');
select pg_temp.expect('X joins with the code', public.join_group_with_code(pg_temp.txt('code'))::text, pg_temp.txt('g'));
select pg_temp.expect('joining twice is harmless', public.join_group_with_code(pg_temp.txt('code'))::text, pg_temp.txt('g'));
select pg_temp.expect('X is a plain member', pg_temp.members(pg_temp.txt('g')), 'Grupo Dono:owner,Grupo Fora:member');
select pg_temp.expect('X now sees the members', (select count(*)::integer from public.group_members(pg_temp.txt('g')::uuid)), 2);
select pg_temp.expect('X now sees it as joined',
  (select already_in from public.group_by_code(pg_temp.txt('code'))), true);

-- 4. Only the owner manages the group.
select pg_temp.expect('a member cannot rotate the code',
  pg_temp.refusal(format('select public.rotate_group_invite(%L)', pg_temp.txt('g'))), 'not_owner');
select pg_temp.expect('a member cannot rename',
  pg_temp.refusal(format('select public.rename_group(%L, %L)', pg_temp.txt('g'), 'Roubado')), 'not_owner');
select pg_temp.expect('a member cannot remove the owner',
  pg_temp.refusal(format('select public.remove_group_member(%L, %L)', pg_temp.txt('g'), 'ad000005-0000-4000-8000-0000000000a1')), 'not_owner');
-- Any member may change the photo and the chat background, only inside the group's own folder.
select pg_temp.expect('a photo from another group''s folder is refused',
  pg_temp.refusal(format('select public.set_group_photo(%L, %L)', pg_temp.txt('g'), gen_random_uuid()::text || '/foto.jpg')), 'bad_path');
select pg_temp.expect('a photo path that climbs folders is refused',
  pg_temp.refusal(format('select public.set_group_photo(%L, %L)', pg_temp.txt('g'), pg_temp.txt('g') || '/../x.jpg')), 'bad_path');
select pg_temp.expect('a member sets the group photo',
  pg_temp.refusal(format('select public.set_group_photo(%L, %L)', pg_temp.txt('g'), pg_temp.txt('g') || '/foto.jpg')), 'accepted');
select pg_temp.expect('an unknown background is refused',
  pg_temp.refusal(format('select public.set_group_chat_background(%L, %L)', pg_temp.txt('g'), 'neon')), 'bad_background');
select pg_temp.expect('a photo background needs a photo',
  pg_temp.refusal(format('select public.set_group_chat_background(%L, %L)', pg_temp.txt('g'), 'foto')), 'bad_path');
select pg_temp.expect('a member sets the background',
  pg_temp.refusal(format('select public.set_group_chat_background(%L, %L)', pg_temp.txt('g'), 'noite')), 'accepted');

select pg_temp.as_user('ad000005-0000-4000-8000-0000000000a1');
select pg_temp.expect('the owner cannot remove themselves (they leave instead)',
  pg_temp.refusal(format('select public.remove_group_member(%L, %L)', pg_temp.txt('g'), 'ad000005-0000-4000-8000-0000000000a1')), 'own_membership');
select pg_temp.expect('the owner cannot rename to 1 letter',
  pg_temp.refusal(format('select public.rename_group(%L, %L)', pg_temp.txt('g'), 'a')), 'bad_name');
select public.rename_group(pg_temp.txt('g')::uuid, 'Malta Nova');
insert into t_ids (key, txt) values ('code2', public.rotate_group_invite(pg_temp.txt('g')::uuid));
select pg_temp.expect('the new code is different', pg_temp.txt('code2') <> pg_temp.txt('code'), true);
select pg_temp.expect('the inbox shows the new name, photo and background',
  (select name || ':' || photo_path || ':' || chat_background || ':' || invite_code from public.my_group_inbox()
   where group_id = pg_temp.txt('g')::uuid),
  'Malta Nova:' || pg_temp.txt('g') || '/foto.jpg:noite:' || pg_temp.txt('code2'));

-- 5. The old code stops working.
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000b1');
select pg_temp.expect('the old code finds nothing', (select count(*)::integer from public.group_by_code(pg_temp.txt('code'))), 0);
select pg_temp.expect('the old code cannot be joined',
  pg_temp.refusal(format('select public.join_group_with_code(%L)', pg_temp.txt('code'))), 'group_not_found');
select pg_temp.expect('M joins with the new code', public.join_group_with_code(pg_temp.txt('code2'))::text, pg_temp.txt('g'));

-- 6. Outsiders and admins have no say.
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000d1');
select pg_temp.expect('the admin sees no members', (select count(*)::integer from public.group_members(pg_temp.txt('g')::uuid)), 0);
select pg_temp.expect('the admin cannot rename', pg_temp.refusal(format('select public.rename_group(%L, %L)', pg_temp.txt('g'), 'Admin')), 'not_owner');
select pg_temp.expect('the admin cannot rotate', pg_temp.refusal(format('select public.rotate_group_invite(%L)', pg_temp.txt('g'))), 'not_owner');
select pg_temp.expect('the admin cannot set the photo',
  pg_temp.refusal(format('select public.set_group_photo(%L, null)', pg_temp.txt('g'))), 'not_member');
select pg_temp.expect('the admin cannot set the background',
  pg_temp.refusal(format('select public.set_group_chat_background(%L, %L)', pg_temp.txt('g'), 'liso')), 'not_member');
select pg_temp.expect('the admin cannot remove members',
  pg_temp.refusal(format('select public.remove_group_member(%L, %L)', pg_temp.txt('g'), 'ad000005-0000-4000-8000-0000000000b1')), 'not_owner');
select pg_temp.expect('a non-member cannot leave', pg_temp.refusal(format('select public.leave_group(%L)', pg_temp.txt('g'))), 'not_member');
select pg_temp.expect('a non-member cannot invite', pg_temp.refusal(format('select public.invite_friend_to_group(%L, %L)',
  pg_temp.txt('g'), 'ad000005-0000-4000-8000-0000000000f1')), 'not_member');

-- 7. Invites: only between friends, only seen by the person invited.
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000b1');
select pg_temp.expect('a member cannot invite someone who is not their friend',
  pg_temp.refusal(format('select public.invite_friend_to_group(%L, %L)', pg_temp.txt('g'), 'ad000005-0000-4000-8000-0000000000f1')), 'not_friends');
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000a1');
select public.invite_friend_to_group(pg_temp.txt('g')::uuid, 'ad000005-0000-4000-8000-0000000000f1');
select public.invite_friend_to_group(pg_temp.txt('g')::uuid, 'ad000005-0000-4000-8000-0000000000f1');
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000e1');
select pg_temp.expect('X sees no invite for F', (select count(*)::integer from public.my_group_invites()), 0);
select pg_temp.expect('X cannot accept an invite that isn''t theirs',
  pg_temp.refusal(format('select public.accept_group_invite(%L)', pg_temp.txt('g'))), 'not_yours');
select pg_temp.expect('X cannot decline it either',
  pg_temp.refusal(format('select public.decline_group_invite(%L)', pg_temp.txt('g'))), 'not_yours');
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000f1');
select pg_temp.expect('F sees one invite, from O',
  (select group_name || ':' || invited_by_name || ':' || members from public.my_group_invites()), 'Malta Nova:Grupo Dono:3');
select pg_temp.expect('F is not a member yet', (select count(*)::integer from public.group_members(pg_temp.txt('g')::uuid)), 0);
select public.decline_group_invite(pg_temp.txt('g')::uuid);
select pg_temp.expect('declined invite is gone', (select count(*)::integer from public.my_group_invites()), 0);
select pg_temp.expect('a declined invite cannot be accepted',
  pg_temp.refusal(format('select public.accept_group_invite(%L)', pg_temp.txt('g'))), 'not_yours');
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000a1');
select public.invite_friend_to_group(pg_temp.txt('g')::uuid, 'ad000005-0000-4000-8000-0000000000f1');
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000f1');
select public.accept_group_invite(pg_temp.txt('g')::uuid);
select pg_temp.expect('accepting makes F a member', (select count(*)::integer from public.group_members(pg_temp.txt('g')::uuid)), 4);
select pg_temp.expect('accepting again is refused',
  pg_temp.refusal(format('select public.accept_group_invite(%L)', pg_temp.txt('g'))), 'not_yours');
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000a1');
select pg_temp.expect('a member cannot be invited again',
  pg_temp.refusal(format('select public.invite_friend_to_group(%L, %L)', pg_temp.txt('g'), 'ad000005-0000-4000-8000-0000000000f1')), 'already_member');

-- 8. Removing and leaving. (Everyone joined in this transaction, so give them distinct join times.)
reset role;
update public.fan_group_member set joined_at = now() - interval '2 days'
where group_id = pg_temp.txt('g')::uuid and profile_id = 'ad000005-0000-4000-8000-0000000000b1';
update public.fan_group_member set joined_at = now() - interval '1 day'
where group_id = pg_temp.txt('g')::uuid and profile_id = 'ad000005-0000-4000-8000-0000000000f1';
set local role authenticated;
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000a1');
select public.remove_group_member(pg_temp.txt('g')::uuid, 'ad000005-0000-4000-8000-0000000000e1');
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000e1');
select pg_temp.expect('a removed member sees nothing', (select count(*)::integer from public.group_members(pg_temp.txt('g')::uuid)), 0);
select pg_temp.expect('a removed member has no group', (select count(*)::integer from public.my_groups()), 0);
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000a1');
select public.leave_group(pg_temp.txt('g')::uuid);
select pg_temp.expect('when the owner leaves, the oldest member owns it',
  pg_temp.members(pg_temp.txt('g')), 'Grupo Membro:owner,Grupo Amigo:member');
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000b1');
select public.leave_group(pg_temp.txt('g')::uuid);
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000f1');
select pg_temp.expect('F owns it now', pg_temp.members(pg_temp.txt('g')), 'Grupo Amigo:owner');
select public.leave_group(pg_temp.txt('g')::uuid);
reset role;
select pg_temp.expect('the last one out deletes the group',
  (select count(*)::integer from public.fan_group where id = pg_temp.txt('g')::uuid), 0);

-- 9. Five new groups a day.
insert into public.rate_limit_hit (profile_id, bucket)
select 'ad000005-0000-4000-8000-0000000000e1', 'group-create' from generate_series(1, 5);
insert into public.rate_limit_hit (profile_id, bucket)
select 'ad000005-0000-4000-8000-0000000000e1', 'group-join' from generate_series(1, 20);
set local role authenticated;
select pg_temp.as_user('ad000005-0000-4000-8000-0000000000e1');
select pg_temp.expect('6th group of the day refused', pg_temp.refusal('select public.create_group(''Mais um'')'), 'rate_limited');
select pg_temp.expect('21st join of the day refused (stops guessing codes)',
  pg_temp.refusal('select public.join_group_with_code(''zzzzzzzzzz'')'), 'rate_limited');

reset role;
select count(*) as checks_passed from expect_log;

rollback;
