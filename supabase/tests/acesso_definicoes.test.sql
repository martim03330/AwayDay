-- Access tests for settings and things people send: device_token, notification_preference, feedback, mission_photo.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_definicoes.test.sql
--
-- People: A owns the rows, B is another account, D is an admin. Anon has no account.

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
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.as_anon()
returns void
language sql
as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('ad000002-0000-4000-8000-0000000000a1', 'acesso-def-a@test.invalid', '{"display_name":"Def A"}', 'authenticated', 'authenticated'),
  ('ad000002-0000-4000-8000-0000000000b1', 'acesso-def-b@test.invalid', '{"display_name":"Def B"}', 'authenticated', 'authenticated'),
  ('ad000002-0000-4000-8000-0000000000d1', 'acesso-def-d@test.invalid', '{"display_name":"Def Admin"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'ad000002-0000-4000-8000-0000000000d1';

-- 1. Anon: nothing but sending feedback.
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon cannot read device tokens',
  pg_temp.refusal('select count(*) from public.device_token'), 'permission denied for table device_token');
select pg_temp.expect('anon cannot register a device',
  pg_temp.refusal('select public.register_device_token(''ExponentPushToken[anon]'', ''ios'')'),
  'permission denied for function register_device_token');
select pg_temp.expect('anon cannot read notification settings',
  pg_temp.refusal('select count(*) from public.notification_preference'), 'permission denied for table notification_preference');
select pg_temp.expect('anon cannot read feedback',
  pg_temp.refusal('select count(*) from public.feedback'), 'permission denied for table feedback');
select pg_temp.expect('anon cannot read the feedback inbox',
  pg_temp.refusal('select count(*) from public.feedback_inbox()'), 'permission denied for function feedback_inbox');
select pg_temp.expect('anon cannot change feedback status',
  pg_temp.refusal(format('select public.set_feedback_status(%L, %L)', gen_random_uuid(), 'visto')),
  'permission denied for function set_feedback_status');
select pg_temp.expect('anon cannot read mission photos',
  pg_temp.refusal('select count(*) from public.mission_photo'), 'permission denied for table mission_photo');
select pg_temp.expect('anon cannot read missions',
  pg_temp.refusal('select count(*) from public.my_missions()'), 'permission denied for function my_missions');
-- Without an account a bug can still be reported (by design, see send_feedback).
insert into t_ids (key, id) values ('fb_anon', public.send_feedback('erro', 'contas', 'Nao consigo criar conta', 'iPhone', '1.0.0'));
select pg_temp.expect('anon feedback with a short body is refused',
  pg_temp.refusal('select public.send_feedback(''erro'', ''contas'', ''curto'')'), 'bad_body');
select pg_temp.expect('anon feedback with an unknown kind is refused',
  pg_temp.refusal('select public.send_feedback(''queixa'', ''contas'', ''Isto e uma queixa longa'')'), 'bad_feedback');
select pg_temp.expect('anon feedback with an unknown area is refused',
  pg_temp.refusal('select public.send_feedback(''erro'', ''pagamentos'', ''Isto e uma queixa longa'')'), 'bad_feedback');

-- 2. Device tokens: registered by RPC, read and removed only by the owner.
set local role authenticated;
select pg_temp.as_user('ad000002-0000-4000-8000-0000000000a1');
select public.register_device_token('ExponentPushToken[acesso-a-1]', 'ios');
select pg_temp.expect('A sees their device', (select count(*)::integer from public.device_token), 1);
select pg_temp.expect('a token that is not an Expo token is refused',
  split_part(pg_temp.refusal('select public.register_device_token(''qualquer-coisa'', ''ios'')'), ' ', 1), 'new');
select pg_temp.expect('an unknown platform is refused',
  split_part(pg_temp.refusal('select public.register_device_token(''ExponentPushToken[acesso-a-x]'', ''windows'')'), ' ', 1), 'new');
select pg_temp.expect('tokens are not inserted directly',
  pg_temp.refusal('insert into public.device_token (token, profile_id, platform) values (''ExponentPushToken[d]'', ''ad000002-0000-4000-8000-0000000000a1'', ''ios'')'),
  'permission denied for table device_token');
select pg_temp.expect('tokens are not updated directly',
  pg_temp.refusal('update public.device_token set profile_id = ''ad000002-0000-4000-8000-0000000000b1'''),
  'permission denied for table device_token');
select public.register_device_token('ExponentPushToken[acesso-a-' || n || ']', 'android') from generate_series(2, 12) as n;
select pg_temp.expect('at most 10 devices per person', (select count(*)::integer from public.device_token), 10);

select pg_temp.as_user('ad000002-0000-4000-8000-0000000000b1');
select pg_temp.expect('B sees none of A''s devices', (select count(*)::integer from public.device_token), 0);
select pg_temp.expect('B removes none of A''s devices',
  pg_temp.affected('delete from public.device_token where profile_id = ''ad000002-0000-4000-8000-0000000000a1'''), 0);
-- Same phone, new account: the token moves to whoever registers it last.
select public.register_device_token('ExponentPushToken[acesso-a-12]', 'android');
select pg_temp.expect('a phone signed in with B now belongs to B', (select count(*)::integer from public.device_token), 1);

select pg_temp.as_user('ad000002-0000-4000-8000-0000000000a1');
select pg_temp.expect('A no longer gets pushes on that phone',
  (select count(*)::integer from public.device_token where token = 'ExponentPushToken[acesso-a-12]'), 0);
select pg_temp.expect('A removes their own device',
  pg_temp.affected('delete from public.device_token where token = (select min(token) from public.device_token)'), 1);

select pg_temp.as_user('ad000002-0000-4000-8000-0000000000d1');
select pg_temp.expect('the admin does not see anyone''s devices', (select count(*)::integer from public.device_token), 0);

-- 3. Notification preferences: own rows only.
select pg_temp.as_user('ad000002-0000-4000-8000-0000000000a1');
insert into public.notification_preference (profile_id, kind, enabled)
values ('ad000002-0000-4000-8000-0000000000a1', 'group_message', false);
select pg_temp.expect('A sees their preference', (select count(*)::integer from public.notification_preference), 1);
select pg_temp.expect('A changes their preference',
  pg_temp.affected('update public.notification_preference set enabled = true where kind = ''group_message'''), 1);
select pg_temp.expect('an unknown kind is refused',
  split_part(pg_temp.refusal('insert into public.notification_preference (profile_id, kind, enabled) values (''ad000002-0000-4000-8000-0000000000a1'', ''spam'', true)'), ' ', 1),
  'new');
select pg_temp.expect('A cannot set B''s preferences',
  pg_temp.refusal('insert into public.notification_preference (profile_id, kind, enabled) values (''ad000002-0000-4000-8000-0000000000b1'', ''friends'', false)'),
  'new row violates row-level security policy for table "notification_preference"');
select pg_temp.expect('A cannot hand their preference to B',
  pg_temp.refusal('update public.notification_preference set profile_id = ''ad000002-0000-4000-8000-0000000000b1'''),
  'new row violates row-level security policy for table "notification_preference"');
select pg_temp.expect('preferences are not deleted, only switched',
  pg_temp.refusal('delete from public.notification_preference'), 'permission denied for table notification_preference');

select pg_temp.as_user('ad000002-0000-4000-8000-0000000000b1');
select pg_temp.expect('B sees none of A''s preferences', (select count(*)::integer from public.notification_preference), 0);
select pg_temp.expect('B changes none of A''s preferences',
  pg_temp.affected('update public.notification_preference set enabled = false'), 0);

-- 4. Feedback: anyone sends, only admins read and triage.
select pg_temp.as_user('ad000002-0000-4000-8000-0000000000a1');
insert into t_ids (key, id) values ('fb_a', public.send_feedback('ideia', 'grupos', '  Gostava de ter fotos no grupo  '));
select pg_temp.expect('A cannot read feedback, even their own',
  pg_temp.refusal('select count(*) from public.feedback'), 'permission denied for table feedback');
select pg_temp.expect('A cannot insert feedback directly',
  pg_temp.refusal('insert into public.feedback (kind, area, body) values (''erro'', ''outro'', ''Directo sem passar pela funcao'')'),
  'permission denied for table feedback');
select pg_temp.expect('A gets nothing from the inbox', (select count(*)::integer from public.feedback_inbox(null)), 0);
select pg_temp.expect('A cannot triage feedback',
  pg_temp.refusal(format('select public.set_feedback_status(%L, %L)', pg_temp.id('fb_a'), 'resolvido')), 'not_admin');
select public.send_feedback('erro', 'outro', 'Mensagem numero ' || n) from generate_series(2, 10) as n;
select pg_temp.expect('11th feedback of the day refused',
  pg_temp.refusal('select public.send_feedback(''erro'', ''outro'', ''Mensagem numero 11'')'), 'rate_limited');

select pg_temp.as_user('ad000002-0000-4000-8000-0000000000d1');
select pg_temp.expect('the admin reads A''s feedback, trimmed, with A''s name',
  (select from_name || ':' || body from public.feedback_inbox('novo') where id = pg_temp.id('fb_a')),
  'Def A:Gostava de ter fotos no grupo');
select pg_temp.expect('the admin reads anon feedback without a name',
  (select coalesce(from_name, '-') || ':' || device || ':' || app_version from public.feedback_inbox('novo') where id = pg_temp.id('fb_anon')),
  '-:iPhone:1.0.0');
select pg_temp.expect('a made-up status is refused',
  pg_temp.refusal(format('select public.set_feedback_status(%L, %L)', pg_temp.id('fb_a'), 'apagado')), 'bad_status');
select public.set_feedback_status(pg_temp.id('fb_a'), 'resolvido');
select pg_temp.expect('triaged feedback leaves the new list',
  (select count(*)::integer from public.feedback_inbox('novo') where id = pg_temp.id('fb_a')), 0);
select pg_temp.expect('and shows under resolved',
  (select count(*)::integer from public.feedback_inbox('resolvido') where id = pg_temp.id('fb_a')), 1);
select pg_temp.expect('even the admin cannot read the table directly',
  pg_temp.refusal('select count(*) from public.feedback'), 'permission denied for table feedback');

-- 5. Mission photos: own folder, own rows, and "verified" only from the server.
select pg_temp.as_user('ad000002-0000-4000-8000-0000000000a1');
insert into public.mission_photo (profile_id, mission_id, storage_path)
values ('ad000002-0000-4000-8000-0000000000a1', 'cinco-jogos', 'ad000002-0000-4000-8000-0000000000a1/foto1.jpg');
select pg_temp.expect('a photo without a check-in at a game today is not verified',
  (select verified from public.mission_photo), false);
select pg_temp.expect('A cannot mark their photo verified',
  pg_temp.refusal('update public.mission_photo set verified = true'), 'permission denied for table mission_photo');
select pg_temp.expect('A cannot insert a verified photo',
  pg_temp.refusal('insert into public.mission_photo (profile_id, mission_id, storage_path, verified) values (''ad000002-0000-4000-8000-0000000000a1'', ''tres-estadios'', ''ad000002-0000-4000-8000-0000000000a1/f2.jpg'', true)'),
  'permission denied for table mission_photo');
select pg_temp.expect('A cannot backdate a photo',
  pg_temp.refusal('update public.mission_photo set taken_at = now() - interval ''1 year'''), 'permission denied for table mission_photo');
select pg_temp.expect('a photo outside A''s folder is refused',
  split_part(pg_temp.refusal('insert into public.mission_photo (profile_id, mission_id, storage_path) values (''ad000002-0000-4000-8000-0000000000a1'', ''tres-estadios'', ''ad000002-0000-4000-8000-0000000000b1/f.jpg'')'), ' ', 1),
  'new');
select pg_temp.expect('A cannot add a photo for B',
  pg_temp.refusal('insert into public.mission_photo (profile_id, mission_id, storage_path) values (''ad000002-0000-4000-8000-0000000000b1'', ''tres-estadios'', ''ad000002-0000-4000-8000-0000000000b1/f.jpg'')'),
  'new row violates row-level security policy for table "mission_photo"');
select pg_temp.expect('A replaces their photo',
  pg_temp.affected('update public.mission_photo set storage_path = ''ad000002-0000-4000-8000-0000000000a1/foto2.jpg'''), 1);
select pg_temp.expect('A lists their missions', (select count(*)::integer from public.my_missions()) > 0, true);

select pg_temp.as_user('ad000002-0000-4000-8000-0000000000b1');
select pg_temp.expect('B sees none of A''s photos', (select count(*)::integer from public.mission_photo), 0);
select pg_temp.expect('B changes none of A''s photos',
  pg_temp.affected('update public.mission_photo set mission_id = mission_id'), 0);
select pg_temp.expect('B deletes none of A''s photos',
  pg_temp.affected('delete from public.mission_photo'), 0);

select pg_temp.as_user('ad000002-0000-4000-8000-0000000000a1');
select pg_temp.expect('A deletes their photo', pg_temp.affected('delete from public.mission_photo'), 1);

reset role;
select pg_temp.expect('anon feedback is stored without a person',
  (select profile_id from public.feedback where id = pg_temp.id('fb_anon')), null::uuid);
select pg_temp.expect('A''s feedback is tied to A',
  (select profile_id from public.feedback where id = pg_temp.id('fb_a')), 'ad000002-0000-4000-8000-0000000000a1'::uuid);

select count(*) as checks_passed from expect_log;

rollback;
