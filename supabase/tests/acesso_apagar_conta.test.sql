-- Account deletion: what goes with the account, and what stays for everyone else.
-- The delete-account edge function calls auth.admin.deleteUser; the database does the rest by cascade. Here the
-- auth user is deleted directly, which is what deleteUser does in the database.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_apagar_conta.test.sql
--
-- People: A deletes the account. B and C stay. A is a member of B's group G2; C owns G1 where A and B are members.
-- (When the owner of a group deletes the account, see acesso_falhas_pessoas.test.sql.)

begin;

create temporary table expect_log (name text) on commit drop;
create temporary table t_ids (key text primary key, id uuid, txt text) on commit drop;
grant insert, select, update on expect_log, t_ids to authenticated;

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

-- How many rows of A are left in a table, by its column naming A.
create function pg_temp.rows_of_a(p_table text, p_column text)
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  execute format('select count(*)::integer from public.%I where %I = %L', p_table, p_column, 'ad000008-0000-4000-8000-0000000000a1')
  into n;
  return n;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('ad000008-0000-4000-8000-0000000000a1', 'acesso-conta-a@test.invalid', '{"display_name":"Conta A"}', 'authenticated', 'authenticated'),
  ('ad000008-0000-4000-8000-0000000000b1', 'acesso-conta-b@test.invalid', '{"display_name":"Conta B"}', 'authenticated', 'authenticated'),
  ('ad000008-0000-4000-8000-0000000000c1', 'acesso-conta-c@test.invalid', '{"display_name":"Conta C"}', 'authenticated', 'authenticated');

insert into public.fan_group (id, name, created_by, invite_code)
values
  ('c0000008-0000-4000-8000-0000000000a1', 'Grupo Conta Um', 'ad000008-0000-4000-8000-0000000000c1', 'acconta001'),
  ('c0000008-0000-4000-8000-0000000000a2', 'Grupo Conta Dois', 'ad000008-0000-4000-8000-0000000000a1', 'acconta002');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('c0000008-0000-4000-8000-0000000000a1', 'ad000008-0000-4000-8000-0000000000c1', 'owner'),
  ('c0000008-0000-4000-8000-0000000000a1', 'ad000008-0000-4000-8000-0000000000a1', 'member'),
  ('c0000008-0000-4000-8000-0000000000a1', 'ad000008-0000-4000-8000-0000000000b1', 'member'),
  ('c0000008-0000-4000-8000-0000000000a2', 'ad000008-0000-4000-8000-0000000000b1', 'owner'),
  ('c0000008-0000-4000-8000-0000000000a2', 'ad000008-0000-4000-8000-0000000000a1', 'member');
-- G2 was created by A but B owns it now.

-- Everything A has, through the app's own RPCs where there is one.
insert into t_ids (key, txt)
select 'jogo', f.id from public.fixture as f where f.kickoff_at > now() + interval '2 days' order by f.kickoff_at limit 1;
insert into t_ids (key, txt)
select 'jogo2', f.id from public.fixture as f where f.kickoff_at > now() + interval '2 days' order by f.kickoff_at offset 1 limit 1;

set local role authenticated;
select pg_temp.as_user('ad000008-0000-4000-8000-0000000000a1');
select public.set_display_name('Conta A');
select public.register_device_token('ExponentPushToken[acesso-conta-a]', 'ios');
insert into public.notification_preference (profile_id, kind, enabled) values ('ad000008-0000-4000-8000-0000000000a1', 'friends', false);
insert into public.profile_club (profile_id, relation, club_id)
values ('ad000008-0000-4000-8000-0000000000a1', 'supporter', (select id from public.club order by id limit 1));
insert into public.profile_home (profile_id, municipality_id) values ('ad000008-0000-4000-8000-0000000000a1', '0603');
insert into public.mission_photo (profile_id, mission_id, storage_path)
values ('ad000008-0000-4000-8000-0000000000a1', 'cinco-jogos', 'ad000008-0000-4000-8000-0000000000a1/f.jpg');
insert into t_ids (key, id) values ('fb', public.send_feedback('erro', 'outro', 'Isto falhou ao abrir'));
insert into t_ids (key, id) values ('msg_a', public.send_group_message('c0000008-0000-4000-8000-0000000000a1', 'Mensagem da A'));
select public.mark_group_messages_read('c0000008-0000-4000-8000-0000000000a1');
select public.send_friend_request('ad000008-0000-4000-8000-0000000000b1');
select public.block_user('ad000008-0000-4000-8000-0000000000c1');
-- A's own plan in G1, and A's answer to B's plan in G1.
insert into t_ids (key, id) values ('plano_a', public.invite_group_to_fixture('c0000008-0000-4000-8000-0000000000a1', (select txt from t_ids where key = 'jogo')));
select pg_temp.as_user('ad000008-0000-4000-8000-0000000000b1');
select public.accept_friend_request('ad000008-0000-4000-8000-0000000000a1');
insert into t_ids (key, id) values ('msg_b', public.send_group_message('c0000008-0000-4000-8000-0000000000a1', 'Mensagem do B'));
insert into t_ids (key, id) values ('plano_b', public.invite_group_to_fixture('c0000008-0000-4000-8000-0000000000a2', (select txt from t_ids where key = 'jogo2')));
select pg_temp.as_user('ad000008-0000-4000-8000-0000000000a1');
select public.answer_fixture_plan(pg_temp.id('plano_b'), 'vou');
-- A invited C to G2; the server wrote AI tips, a recap and coach state for A.
reset role;
insert into public.group_invite (group_id, profile_id, invited_by)
values
  ('c0000008-0000-4000-8000-0000000000a2', 'ad000008-0000-4000-8000-0000000000c1', 'ad000008-0000-4000-8000-0000000000a1');
insert into public.nudge (profile_id, kind, local_date, facts, body, source)
values ('ad000008-0000-4000-8000-0000000000a1', 'estadio_novo', current_date, '{}', 'Ola', 'template');
insert into public.season_recap (profile_id, season_id, stats, headline, body, source)
values ('ad000008-0000-4000-8000-0000000000a1', '2026-27', '{}', 'Epoca', 'Texto', 'template');
insert into public.coach_state (profile_id) values ('ad000008-0000-4000-8000-0000000000a1');

-- Before: A has something in every table.
select pg_temp.expect('A has rows everywhere before',
  pg_temp.rows_of_a('profile', 'id') + pg_temp.rows_of_a('profile_club', 'profile_id') + pg_temp.rows_of_a('profile_home', 'profile_id')
  + pg_temp.rows_of_a('device_token', 'profile_id') + pg_temp.rows_of_a('notification_preference', 'profile_id')
  + pg_temp.rows_of_a('mission_photo', 'profile_id') + pg_temp.rows_of_a('feedback', 'profile_id')
  + pg_temp.rows_of_a('group_message', 'profile_id') + pg_temp.rows_of_a('group_message_read', 'profile_id')
  + pg_temp.rows_of_a('friendship', 'requester_id') + pg_temp.rows_of_a('user_block', 'blocker_id')
  + pg_temp.rows_of_a('fixture_plan', 'created_by') + pg_temp.rows_of_a('fixture_plan_answer', 'profile_id')
  + pg_temp.rows_of_a('fan_group_member', 'profile_id') + pg_temp.rows_of_a('group_invite', 'invited_by')
  + pg_temp.rows_of_a('nudge', 'profile_id') + pg_temp.rows_of_a('season_recap', 'profile_id')
  + pg_temp.rows_of_a('coach_state', 'profile_id') + pg_temp.rows_of_a('rate_limit_hit', 'profile_id') > 20,
  true);
select pg_temp.expect('A has a group created_by', pg_temp.rows_of_a('fan_group', 'created_by'), 1);

-- Delete the account.
delete from auth.users where id = 'ad000008-0000-4000-8000-0000000000a1';

-- 1. Everything personal is gone.
select pg_temp.expect('profile gone', pg_temp.rows_of_a('profile', 'id'), 0);
select pg_temp.expect('clubs gone', pg_temp.rows_of_a('profile_club', 'profile_id'), 0);
select pg_temp.expect('home gone', pg_temp.rows_of_a('profile_home', 'profile_id'), 0);
select pg_temp.expect('devices gone (no more pushes)', pg_temp.rows_of_a('device_token', 'profile_id'), 0);
select pg_temp.expect('notification settings gone', pg_temp.rows_of_a('notification_preference', 'profile_id'), 0);
select pg_temp.expect('mission photos gone', pg_temp.rows_of_a('mission_photo', 'profile_id'), 0);
select pg_temp.expect('AI nudges gone', pg_temp.rows_of_a('nudge', 'profile_id'), 0);
select pg_temp.expect('season recap gone', pg_temp.rows_of_a('season_recap', 'profile_id'), 0);
select pg_temp.expect('coach state gone', pg_temp.rows_of_a('coach_state', 'profile_id'), 0);
select pg_temp.expect('rate limits gone', pg_temp.rows_of_a('rate_limit_hit', 'profile_id'), 0);
select pg_temp.expect('memberships gone', pg_temp.rows_of_a('fan_group_member', 'profile_id'), 0);
select pg_temp.expect('read-marks gone', pg_temp.rows_of_a('group_message_read', 'profile_id'), 0);
select pg_temp.expect('A''s messages gone', pg_temp.rows_of_a('group_message', 'profile_id'), 0);
select pg_temp.expect('friendships gone (both sides)',
  pg_temp.rows_of_a('friendship', 'requester_id') + pg_temp.rows_of_a('friendship', 'addressee_id'), 0);
select pg_temp.expect('blocks gone', pg_temp.rows_of_a('user_block', 'blocker_id'), 0);
select pg_temp.expect('A''s answers gone', pg_temp.rows_of_a('fixture_plan_answer', 'profile_id'), 0);
select pg_temp.expect('the auth user and its email are gone',
  (select count(*)::integer from auth.users where email = 'acesso-conta-a@test.invalid'), 0);

-- 2. What other people need stays, without A's name on it.
select pg_temp.expect('feedback stays, anonymous', (select profile_id from public.feedback where id = pg_temp.id('fb')), null::uuid);
select pg_temp.expect('the invite A sent stays, without the inviter',
  (select count(*)::integer from public.group_invite where profile_id = 'ad000008-0000-4000-8000-0000000000c1' and invited_by is null), 1);
select pg_temp.expect('the group A created stays, without the creator',
  (select count(*)::integer from public.fan_group where id = 'c0000008-0000-4000-8000-0000000000a2' and created_by is null), 1);
select pg_temp.expect('B''s message stays', (select count(*)::integer from public.group_message where id = pg_temp.id('msg_b')), 1);
select pg_temp.expect('B''s plan stays, with only B going',
  (select string_agg(profile_id::text, ',') from public.fixture_plan_answer where plan_id = pg_temp.id('plano_b')),
  'ad000008-0000-4000-8000-0000000000b1');
select pg_temp.expect('the groups keep their other members',
  (select count(*)::integer from public.fan_group_member where group_id::text like 'c0000008-%'), 3);
-- A plan belongs to its creator: it goes with the account, with its card in the chat.
select pg_temp.expect('A''s plan went with A', (select count(*)::integer from public.fixture_plan where id = pg_temp.id('plano_a')), 0);
select pg_temp.expect('and its card left the chat', (select count(*)::integer from public.group_message where plan_id = pg_temp.id('plano_a')), 0);

-- 3. For B, A has disappeared.
set local role authenticated;
select pg_temp.as_user('ad000008-0000-4000-8000-0000000000b1');
select pg_temp.expect('B has no friend left', (select count(*)::integer from public.my_friends()), 0);
select pg_temp.expect('B sees only B and C in G1',
  (select string_agg(display_name, ',' order by display_name) from public.group_members('c0000008-0000-4000-8000-0000000000a1')),
  'Conta B,Conta C');
select pg_temp.expect('B sees no card for A',
  (select count(*)::integer from public.profile_cards(array['ad000008-0000-4000-8000-0000000000a1'::uuid])), 0);
select pg_temp.expect('the chat has only B''s message',
  (select string_agg(body, ',') from public.group_messages('c0000008-0000-4000-8000-0000000000a1')), 'Mensagem do B');

reset role;
select count(*) as checks_passed from expect_log;

rollback;
