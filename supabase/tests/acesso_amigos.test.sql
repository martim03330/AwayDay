-- Access tests for friendships (table friendship and the friend RPCs).
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_amigos.test.sql
--
-- People: A, B and C share a group (so they have crossed paths), X is an outsider, Z is blocked by A.

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

-- The state A sees for someone.
create function pg_temp.state(p_other text)
returns text
language sql
as $$
  select state from public.friendship_states(array[p_other::uuid]);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('ad000004-0000-4000-8000-0000000000a1', 'acesso-amigos-a@test.invalid', '{"display_name":"Amigo A"}', 'authenticated', 'authenticated'),
  ('ad000004-0000-4000-8000-0000000000b1', 'acesso-amigos-b@test.invalid', '{"display_name":"Amigo B"}', 'authenticated', 'authenticated'),
  ('ad000004-0000-4000-8000-0000000000c1', 'acesso-amigos-c@test.invalid', '{"display_name":"Amigo C"}', 'authenticated', 'authenticated'),
  ('ad000004-0000-4000-8000-0000000000e1', 'acesso-amigos-x@test.invalid', '{"display_name":"Amigo X"}', 'authenticated', 'authenticated'),
  ('ad000004-0000-4000-8000-0000000000f1', 'acesso-amigos-z@test.invalid', '{"display_name":"Amigo Z"}', 'authenticated', 'authenticated');

insert into public.fan_group (id, name, created_by, invite_code)
values ('c0000004-0000-4000-8000-0000000000a1', 'Grupo Amigos', 'ad000004-0000-4000-8000-0000000000a1', 'acamigos01');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('c0000004-0000-4000-8000-0000000000a1', 'ad000004-0000-4000-8000-0000000000a1', 'owner'),
  ('c0000004-0000-4000-8000-0000000000a1', 'ad000004-0000-4000-8000-0000000000b1', 'member'),
  ('c0000004-0000-4000-8000-0000000000a1', 'ad000004-0000-4000-8000-0000000000c1', 'member'),
  ('c0000004-0000-4000-8000-0000000000a1', 'ad000004-0000-4000-8000-0000000000f1', 'member');
insert into public.user_block (blocker_id, blocked_id)
values ('ad000004-0000-4000-8000-0000000000a1', 'ad000004-0000-4000-8000-0000000000f1');

-- 1. Anon.
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon cannot read friendships',
  pg_temp.refusal('select count(*) from public.friendship'), 'permission denied for table friendship');
select pg_temp.expect('anon cannot send a request',
  pg_temp.refusal('select public.send_friend_request(''ad000004-0000-4000-8000-0000000000a1'')'),
  'permission denied for function send_friend_request');
select pg_temp.expect('anon cannot list friends',
  pg_temp.refusal('select count(*) from public.my_friends()'), 'permission denied for function my_friends');
select pg_temp.expect('anon cannot list requests',
  pg_temp.refusal('select count(*) from public.my_friend_requests()'), 'permission denied for function my_friend_requests');
select pg_temp.expect('anon cannot ask friendship states',
  pg_temp.refusal('select count(*) from public.friendship_states(array[''ad000004-0000-4000-8000-0000000000a1''::uuid])'),
  'permission denied for function friendship_states');
select pg_temp.expect('anon cannot accept',
  pg_temp.refusal('select public.accept_friend_request(''ad000004-0000-4000-8000-0000000000a1'')'),
  'permission denied for function accept_friend_request');
select pg_temp.expect('anon cannot remove',
  pg_temp.refusal('select public.remove_friend(''ad000004-0000-4000-8000-0000000000a1'')'),
  'permission denied for function remove_friend');

-- 2. The table is closed to clients: everything goes through the RPCs.
set local role authenticated;
select pg_temp.as_user('ad000004-0000-4000-8000-0000000000a1');
select pg_temp.expect('A cannot read the table',
  pg_temp.refusal('select count(*) from public.friendship'), 'permission denied for table friendship');
select pg_temp.expect('A cannot make a friendship directly',
  pg_temp.refusal('insert into public.friendship (requester_id, addressee_id, status) values (''ad000004-0000-4000-8000-0000000000a1'', ''ad000004-0000-4000-8000-0000000000e1'', ''aceite'')'),
  'permission denied for table friendship');

-- 3. Who can ask whom.
select pg_temp.expect('not to yourself', pg_temp.refusal('select public.send_friend_request(''ad000004-0000-4000-8000-0000000000a1'')'), 'bad_request');
select pg_temp.expect('not to nobody', pg_temp.refusal('select public.send_friend_request(null)'), 'bad_request');
select pg_temp.expect('not to a missing profile',
  pg_temp.refusal(format('select public.send_friend_request(%L)', gen_random_uuid())), 'profile_not_found');
select pg_temp.expect('not to someone never met',
  pg_temp.refusal('select public.send_friend_request(''ad000004-0000-4000-8000-0000000000e1'')'), 'never_met');
select pg_temp.expect('not to someone you blocked',
  pg_temp.refusal('select public.send_friend_request(''ad000004-0000-4000-8000-0000000000f1'')'), 'blocked');
select pg_temp.expect('A can ask B (same group)', pg_temp.state('ad000004-0000-4000-8000-0000000000b1'), 'pode_pedir');
select pg_temp.expect('A sees X as nothing', pg_temp.state('ad000004-0000-4000-8000-0000000000e1'), 'nada');
select pg_temp.expect('A sees the blocked Z as nothing', pg_temp.state('ad000004-0000-4000-8000-0000000000f1'), 'nada');
select pg_temp.expect('friendship_states leaves me out',
  (select count(*)::integer from public.friendship_states(array['ad000004-0000-4000-8000-0000000000a1'::uuid])), 0);

select pg_temp.expect('A asks B', public.send_friend_request('ad000004-0000-4000-8000-0000000000b1'), 'pedido');
select pg_temp.expect('asking again changes nothing', public.send_friend_request('ad000004-0000-4000-8000-0000000000b1'), 'pedido');
select pg_temp.expect('A sees the sent request',
  (select direction || ':' || display_name from public.my_friend_requests()), 'enviado:Amigo B');
select pg_temp.expect('A sees it as sent', pg_temp.state('ad000004-0000-4000-8000-0000000000b1'), 'pedido_enviado');
select pg_temp.expect('A cannot accept their own request',
  pg_temp.refusal('select public.accept_friend_request(''ad000004-0000-4000-8000-0000000000b1'')'), 'not_yours');

-- 4. X, the outsider, can't touch it.
select pg_temp.as_user('ad000004-0000-4000-8000-0000000000e1');
select pg_temp.expect('X sees no requests', (select count(*)::integer from public.my_friend_requests()), 0);
select pg_temp.expect('X cannot accept A''s request to B',
  pg_temp.refusal('select public.accept_friend_request(''ad000004-0000-4000-8000-0000000000a1'')'), 'not_yours');
select pg_temp.expect('X cannot cancel A''s request to B',
  pg_temp.refusal('select public.remove_friend(''ad000004-0000-4000-8000-0000000000a1'')'), 'not_yours');
select pg_temp.expect('X learns nothing about A', pg_temp.state('ad000004-0000-4000-8000-0000000000a1'), 'nada');

-- 5. B accepts; both see it.
select pg_temp.as_user('ad000004-0000-4000-8000-0000000000b1');
select pg_temp.expect('B sees the received request',
  (select direction || ':' || display_name from public.my_friend_requests()), 'recebido:Amigo A');
select pg_temp.expect('B sees it as received', pg_temp.state('ad000004-0000-4000-8000-0000000000a1'), 'pedido_recebido');
select public.accept_friend_request('ad000004-0000-4000-8000-0000000000a1');
select pg_temp.expect('accepting twice is refused',
  pg_temp.refusal('select public.accept_friend_request(''ad000004-0000-4000-8000-0000000000a1'')'), 'not_yours');
select pg_temp.expect('B has A as friend', (select string_agg(display_name, ',') from public.my_friends()), 'Amigo A');
select pg_temp.as_user('ad000004-0000-4000-8000-0000000000a1');
select pg_temp.expect('A has B as friend', (select string_agg(display_name, ',') from public.my_friends()), 'Amigo B');
select pg_temp.expect('A sees B as friend', pg_temp.state('ad000004-0000-4000-8000-0000000000b1'), 'amigos');
select pg_temp.expect('asking a friend says friends', public.send_friend_request('ad000004-0000-4000-8000-0000000000b1'), 'amigos');
select pg_temp.expect('no requests left', (select count(*)::integer from public.my_friend_requests()), 0);

-- 6. Crossed requests become a friendship.
select pg_temp.as_user('ad000004-0000-4000-8000-0000000000c1');
select pg_temp.expect('C asks A', public.send_friend_request('ad000004-0000-4000-8000-0000000000a1'), 'pedido');
select pg_temp.as_user('ad000004-0000-4000-8000-0000000000a1');
select pg_temp.expect('A asking C back makes them friends', public.send_friend_request('ad000004-0000-4000-8000-0000000000c1'), 'amigos');
select pg_temp.expect('A has two friends', (select count(*)::integer from public.my_friends()), 2);

-- 7. C sees only C's friendships, never A–B.
select pg_temp.as_user('ad000004-0000-4000-8000-0000000000c1');
select pg_temp.expect('C sees only A', (select string_agg(display_name, ',') from public.my_friends()), 'Amigo A');
select pg_temp.expect('C cannot end A and B''s friendship',
  pg_temp.refusal('select public.remove_friend(''ad000004-0000-4000-8000-0000000000b1'')'), 'not_yours');

-- 8. Ending a friendship.
select pg_temp.as_user('ad000004-0000-4000-8000-0000000000b1');
select public.remove_friend('ad000004-0000-4000-8000-0000000000a1');
select pg_temp.expect('removing twice is refused',
  pg_temp.refusal('select public.remove_friend(''ad000004-0000-4000-8000-0000000000a1'')'), 'not_yours');
select pg_temp.as_user('ad000004-0000-4000-8000-0000000000a1');
select pg_temp.expect('A no longer has B', (select string_agg(display_name, ',') from public.my_friends()), 'Amigo C');

-- 9. 30 requests a day.
reset role;
insert into public.rate_limit_hit (profile_id, bucket)
select 'ad000004-0000-4000-8000-0000000000a1', 'friend-request' from generate_series(1, 30);
set local role authenticated;
select pg_temp.as_user('ad000004-0000-4000-8000-0000000000a1');
select pg_temp.expect('31st request of the day refused',
  pg_temp.refusal('select public.send_friend_request(''ad000004-0000-4000-8000-0000000000b1'')'), 'rate_limited');

reset role;
select pg_temp.expect('rows left: A–C friends only',
  (select string_agg(requester_id::text || '>' || addressee_id::text || ':' || status, ',') from public.friendship
   where requester_id::text like 'ad000004-%'),
  'ad000004-0000-4000-8000-0000000000c1>ad000004-0000-4000-8000-0000000000a1:aceite');

select count(*) as checks_passed from expect_log;

rollback;
