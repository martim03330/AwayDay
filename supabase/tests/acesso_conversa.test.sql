-- Access tests for the group chat: group_message, group_message_read, the chat RPCs and the realtime topic.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_conversa.test.sql
--
-- People: O owns the group, M is a member (who blocks B), B is a member, X is an outsider, D is an admin.

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

-- What I see in the test group's chat, oldest first.
create function pg_temp.chat()
returns text
language sql
as $$
  select string_agg(body, ',' order by created_at, id)
  from public.group_messages('c0000006-0000-4000-8000-0000000000a1');
$$;

create function pg_temp.unread()
returns integer
language sql
as $$
  select unread from public.my_group_inbox() where group_id = 'c0000006-0000-4000-8000-0000000000a1';
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('ad000006-0000-4000-8000-0000000000a1', 'acesso-conversa-o@test.invalid', '{"display_name":"Conversa Dono"}', 'authenticated', 'authenticated'),
  ('ad000006-0000-4000-8000-0000000000b1', 'acesso-conversa-m@test.invalid', '{"display_name":"Conversa Membro"}', 'authenticated', 'authenticated'),
  ('ad000006-0000-4000-8000-0000000000c1', 'acesso-conversa-b@test.invalid', '{"display_name":"Conversa Bloqueado"}', 'authenticated', 'authenticated'),
  ('ad000006-0000-4000-8000-0000000000e1', 'acesso-conversa-x@test.invalid', '{"display_name":"Conversa Fora"}', 'authenticated', 'authenticated'),
  ('ad000006-0000-4000-8000-0000000000d1', 'acesso-conversa-d@test.invalid', '{"display_name":"Conversa Admin"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'ad000006-0000-4000-8000-0000000000d1';

insert into public.fan_group (id, name, created_by, invite_code)
values ('c0000006-0000-4000-8000-0000000000a1', 'Grupo Conversa', 'ad000006-0000-4000-8000-0000000000a1', 'acconversa');
insert into public.fan_group_member (group_id, profile_id, role, joined_at)
values
  ('c0000006-0000-4000-8000-0000000000a1', 'ad000006-0000-4000-8000-0000000000a1', 'owner', now() - interval '1 day'),
  ('c0000006-0000-4000-8000-0000000000a1', 'ad000006-0000-4000-8000-0000000000b1', 'member', now() - interval '1 day'),
  ('c0000006-0000-4000-8000-0000000000a1', 'ad000006-0000-4000-8000-0000000000c1', 'member', now() - interval '1 day');
insert into public.user_block (blocker_id, blocked_id)
values ('ad000006-0000-4000-8000-0000000000b1', 'ad000006-0000-4000-8000-0000000000c1');

-- A plan card from the blocked B, sent before X will join.
insert into t_ids (key, id) select 'jogo_plano', gen_random_uuid();
insert into public.fixture_plan (id, group_id, fixture_id, created_by)
select pg_temp.id('jogo_plano'), 'c0000006-0000-4000-8000-0000000000a1', f.id, 'ad000006-0000-4000-8000-0000000000c1'
from public.fixture as f where f.kickoff_at > now() + interval '2 days' order by f.kickoff_at limit 1;
insert into public.group_message (group_id, profile_id, kind, body, plan_id, created_at)
values ('c0000006-0000-4000-8000-0000000000a1', 'ad000006-0000-4000-8000-0000000000c1', 'plano', 'Cartao do plano',
  pg_temp.id('jogo_plano'), now() - interval '10 hours');

-- 1. Anon.
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon cannot read messages', pg_temp.refusal('select count(*) from public.group_message'), 'permission denied for table group_message');
select pg_temp.expect('anon cannot read read-marks', pg_temp.refusal('select count(*) from public.group_message_read'), 'permission denied for table group_message_read');
select pg_temp.expect('anon cannot list a chat',
  pg_temp.refusal('select count(*) from public.group_messages(''c0000006-0000-4000-8000-0000000000a1'')'), 'permission denied for function group_messages');
select pg_temp.expect('anon cannot send',
  pg_temp.refusal('select public.send_group_message(''c0000006-0000-4000-8000-0000000000a1'', ''ola'')'), 'permission denied for function send_group_message');
select pg_temp.expect('anon cannot share a place',
  pg_temp.refusal('select public.share_place_with_group(''c0000006-0000-4000-8000-0000000000a1'', ''x'')'), 'permission denied for function share_place_with_group');
select pg_temp.expect('anon cannot mark read',
  pg_temp.refusal('select public.mark_group_messages_read(''c0000006-0000-4000-8000-0000000000a1'')'), 'permission denied for function mark_group_messages_read');
select pg_temp.expect('anon has no inbox', pg_temp.refusal('select count(*) from public.my_group_inbox()'), 'permission denied for function my_group_inbox');
select pg_temp.expect('anon cannot remove messages',
  pg_temp.refusal(format('select public.remove_group_message(%L)', gen_random_uuid())), 'permission denied for function remove_group_message');

-- 2. The tables are closed; everything goes through the RPCs.
set local role authenticated;
select pg_temp.as_user('ad000006-0000-4000-8000-0000000000a1');
select pg_temp.expect('a member cannot read the table directly',
  pg_temp.refusal('select count(*) from public.group_message'), 'permission denied for table group_message');
select pg_temp.expect('a member cannot write the table directly',
  pg_temp.refusal('insert into public.group_message (group_id, profile_id, body) values (''c0000006-0000-4000-8000-0000000000a1'', ''ad000006-0000-4000-8000-0000000000b1'', ''Em nome do M'')'),
  'permission denied for table group_message');
select pg_temp.expect('a member cannot unhide messages',
  pg_temp.refusal('update public.group_message set hidden_at = null'), 'permission denied for table group_message');
select pg_temp.expect('a member cannot fake read-marks',
  pg_temp.refusal('insert into public.group_message_read (group_id, profile_id) values (''c0000006-0000-4000-8000-0000000000a1'', ''ad000006-0000-4000-8000-0000000000b1'')'),
  'permission denied for table group_message_read');

-- 3. Sending.
select pg_temp.expect('an empty message is refused',
  pg_temp.refusal('select public.send_group_message(''c0000006-0000-4000-8000-0000000000a1'', ''   '')'), 'bad_message');
select pg_temp.expect('a 501-letter message is refused',
  pg_temp.refusal(format('select public.send_group_message(%L, %L)', 'c0000006-0000-4000-8000-0000000000a1', repeat('a', 501))), 'bad_message');
select pg_temp.expect('a message to a missing group is refused',
  pg_temp.refusal(format('select public.send_group_message(%L, %L)', gen_random_uuid(), 'ola')), 'not_member');
insert into t_ids (key, id) values ('m_o', public.send_group_message('c0000006-0000-4000-8000-0000000000a1', '  Do dono  '));
select pg_temp.as_user('ad000006-0000-4000-8000-0000000000c1');
insert into t_ids (key, id) values ('m_b', public.send_group_message('c0000006-0000-4000-8000-0000000000a1', 'Do bloqueado'));
select pg_temp.as_user('ad000006-0000-4000-8000-0000000000b1');
insert into t_ids (key, id) values ('m_m', public.send_group_message('c0000006-0000-4000-8000-0000000000a1', 'Do membro'));
select pg_temp.expect('a place that does not exist is refused',
  pg_temp.refusal('select public.share_place_with_group(''c0000006-0000-4000-8000-0000000000a1'', ''nao-existe'')'), 'place_not_found');
insert into t_ids (key, id)
values ('m_local', public.share_place_with_group('c0000006-0000-4000-8000-0000000000a1', (select id from public.place order by id limit 1)));

-- Everything above was sent at the same now(): spread them out so the order is known.
reset role;
update public.group_message as m set created_at = now() - make_interval(mins => t.n)
from (values ('m_o', 4), ('m_b', 3), ('m_m', 2), ('m_local', 1)) as t (key, n)
where m.id = pg_temp.id(t.key);
set local role authenticated;
select pg_temp.as_user('ad000006-0000-4000-8000-0000000000b1');

-- 4. Reading: M sees the chat without B's texts (but with B's plan card), O sees everything.
select pg_temp.expect('M sees the chat, minus what the blocked B wrote',
  (select string_agg(kind, ',' order by created_at, id) from public.group_messages('c0000006-0000-4000-8000-0000000000a1')),
  'plano,texto,texto,local');
select pg_temp.expect('the text is trimmed and in order',
  (select string_agg(body, ',' order by created_at, id) from public.group_messages('c0000006-0000-4000-8000-0000000000a1') where kind = 'texto'),
  'Do dono,Do membro');
select pg_temp.expect('M may remove only M''s own messages',
  (select string_agg(kind || ':' || can_remove::text, ',' order by created_at, id)
   from public.group_messages('c0000006-0000-4000-8000-0000000000a1')),
  'plano:false,texto:false,texto:true,local:true');
select pg_temp.expect('M''s unread excludes M''s own and B''s', pg_temp.unread(), 2);
select public.mark_group_messages_read('c0000006-0000-4000-8000-0000000000a1');
select pg_temp.expect('after reading, nothing unread', pg_temp.unread(), 0);
select pg_temp.as_user('ad000006-0000-4000-8000-0000000000a1');
select pg_temp.expect('O sees all five', (select count(*)::integer from public.group_messages('c0000006-0000-4000-8000-0000000000a1')), 5);
select pg_temp.expect('O may remove every message',
  (select bool_and(can_remove) from public.group_messages('c0000006-0000-4000-8000-0000000000a1')), true);
select pg_temp.expect('limit 1 gives the newest',
  (select kind from public.group_messages('c0000006-0000-4000-8000-0000000000a1', null, 1)), 'local');
select pg_temp.expect('limit 0 still gives one',
  (select count(*)::integer from public.group_messages('c0000006-0000-4000-8000-0000000000a1', null, 0)), 1);
select pg_temp.expect('before the plan card there is nothing',
  (select count(*)::integer from public.group_messages('c0000006-0000-4000-8000-0000000000a1', now() - interval '10 hours')), 0);

-- 5. Outsiders and admins read and write nothing.
select pg_temp.as_user('ad000006-0000-4000-8000-0000000000e1');
select pg_temp.expect('X reads nothing', (select count(*)::integer from public.group_messages('c0000006-0000-4000-8000-0000000000a1')), 0);
select pg_temp.expect('X has no inbox entry', (select count(*)::integer from public.my_group_inbox()), 0);
select pg_temp.expect('X cannot send',
  pg_temp.refusal('select public.send_group_message(''c0000006-0000-4000-8000-0000000000a1'', ''Intruso'')'), 'not_member');
select pg_temp.expect('X cannot share a place',
  pg_temp.refusal(format('select public.share_place_with_group(%L, %L)', 'c0000006-0000-4000-8000-0000000000a1', (select id from public.place order by id limit 1))),
  'not_member');
select pg_temp.expect('X cannot mark read', pg_temp.refusal('select public.mark_group_messages_read(''c0000006-0000-4000-8000-0000000000a1'')'), 'not_member');
select pg_temp.expect('X cannot remove a message', pg_temp.refusal(format('select public.remove_group_message(%L)', pg_temp.id('m_m'))), 'not_yours');
select pg_temp.expect('X cannot listen to the group''s realtime topic',
  public.can_use_group_topic('group:c0000006-0000-4000-8000-0000000000a1'), false);
select pg_temp.as_user('ad000006-0000-4000-8000-0000000000d1');
select pg_temp.expect('the admin reads nothing', (select count(*)::integer from public.group_messages('c0000006-0000-4000-8000-0000000000a1')), 0);
select pg_temp.expect('the admin cannot remove a message', pg_temp.refusal(format('select public.remove_group_message(%L)', pg_temp.id('m_m'))), 'not_yours');
select pg_temp.expect('the admin cannot listen either',
  public.can_use_group_topic('group:c0000006-0000-4000-8000-0000000000a1'), false);

-- 6. The realtime topic: only members, only group topics.
select pg_temp.as_user('ad000006-0000-4000-8000-0000000000b1');
select pg_temp.expect('a member can listen to the group topic', public.can_use_group_topic('group:c0000006-0000-4000-8000-0000000000a1'), true);
select pg_temp.expect('a made-up topic is refused', public.can_use_group_topic('group:nao-e-um-uuid'), false);
select pg_temp.expect('a non-group topic is refused', public.can_use_group_topic('ride:c0000006-0000-4000-8000-0000000000a1'), false);
select pg_temp.expect('a group topic with a suffix is refused',
  public.can_use_group_topic('group:c0000006-0000-4000-8000-0000000000a1:x'), false);

-- 7. Removing.
select pg_temp.expect('M cannot remove O''s message', pg_temp.refusal(format('select public.remove_group_message(%L)', pg_temp.id('m_o'))), 'not_yours');
select public.remove_group_message(pg_temp.id('m_m'));
select pg_temp.expect('removing twice is refused', pg_temp.refusal(format('select public.remove_group_message(%L)', pg_temp.id('m_m'))), 'not_yours');
select pg_temp.as_user('ad000006-0000-4000-8000-0000000000a1');
select public.remove_group_message(pg_temp.id('m_b'));
select pg_temp.expect('O removed B''s message, M removed their own',
  (select string_agg(kind, ',' order by created_at, id) from public.group_messages('c0000006-0000-4000-8000-0000000000a1')),
  'plano,texto,local');

-- 8. Hidden messages disappear for everyone and don't count as unread.
reset role;
update public.group_message set hidden_at = now() where id = pg_temp.id('m_o');
set local role authenticated;
select pg_temp.as_user('ad000006-0000-4000-8000-0000000000c1');
select pg_temp.expect('a hidden message is gone, even for B', (select count(*)::integer from public.group_messages('c0000006-0000-4000-8000-0000000000a1')), 2);
select pg_temp.expect('B''s unread counts only what is still there', pg_temp.unread(), 1);

-- 9. A new member does not see older messages as unread; a removed member loses the chat.
reset role;
insert into public.fan_group_member (group_id, profile_id) values ('c0000006-0000-4000-8000-0000000000a1', 'ad000006-0000-4000-8000-0000000000e1');
set local role authenticated;
select pg_temp.as_user('ad000006-0000-4000-8000-0000000000e1');
select pg_temp.expect('a new member reads the history', (select count(*)::integer from public.group_messages('c0000006-0000-4000-8000-0000000000a1')), 2);
select pg_temp.expect('but nothing from before joining is unread', pg_temp.unread(), 0);
select pg_temp.as_user('ad000006-0000-4000-8000-0000000000a1');
select public.remove_group_member('c0000006-0000-4000-8000-0000000000a1', 'ad000006-0000-4000-8000-0000000000e1');
select pg_temp.as_user('ad000006-0000-4000-8000-0000000000e1');
select pg_temp.expect('a removed member reads nothing', (select count(*)::integer from public.group_messages('c0000006-0000-4000-8000-0000000000a1')), 0);
select pg_temp.expect('a removed member cannot send',
  pg_temp.refusal('select public.send_group_message(''c0000006-0000-4000-8000-0000000000a1'', ''Ainda ca estou'')'), 'not_member');
select pg_temp.expect('a removed member cannot listen', public.can_use_group_topic('group:c0000006-0000-4000-8000-0000000000a1'), false);

-- 10. 300 messages a day.
reset role;
insert into public.rate_limit_hit (profile_id, bucket)
select 'ad000006-0000-4000-8000-0000000000b1', 'group-message' from generate_series(1, 300);
set local role authenticated;
select pg_temp.as_user('ad000006-0000-4000-8000-0000000000b1');
select pg_temp.expect('301st message of the day refused',
  pg_temp.refusal('select public.send_group_message(''c0000006-0000-4000-8000-0000000000a1'', ''Mais uma'')'), 'rate_limited');

reset role;
select pg_temp.expect('read-marks only for who read',
  (select string_agg(profile_id::text, ',') from public.group_message_read where group_id = 'c0000006-0000-4000-8000-0000000000a1'),
  'ad000006-0000-4000-8000-0000000000b1');

select count(*) as checks_passed from expect_log;

rollback;
