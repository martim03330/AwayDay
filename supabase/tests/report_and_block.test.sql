-- Tests for reporting and blocking (migration 20261006115624_report_and_block.sql).
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/report_and_block.test.sql
--
-- People: A reads and reports (and blocks B), B writes, C is an outsider, D is an admin.

begin;

create temporary table expect_log (name text) on commit drop;
create temporary table t_ids (key text primary key, id uuid) on commit drop;
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

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('a0000000-0000-4000-8000-0000000000d1', 'bloq-a@test.invalid', '{"display_name":"Bloq A"}', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-0000000000d2', 'bloq-b@test.invalid', '{"display_name":"Bloq B"}', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-0000000000d3', 'bloq-c@test.invalid', '{"display_name":"Bloq C"}', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-0000000000d4', 'bloq-d@test.invalid', '{"display_name":"Bloq D"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'a0000000-0000-4000-8000-0000000000d4';

-- A and B in a group; B also in a second group, which invites A.
insert into public.fan_group (id, name, created_by, invite_code)
values
  ('c0000000-0000-4000-8000-0000000000d1', 'Grupo Bloqueio', 'a0000000-0000-4000-8000-0000000000d1', 'testebloq1'),
  ('c0000000-0000-4000-8000-0000000000d2', 'Grupo do B', 'a0000000-0000-4000-8000-0000000000d2', 'testebloq2');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('c0000000-0000-4000-8000-0000000000d1', 'a0000000-0000-4000-8000-0000000000d1', 'owner'),
  ('c0000000-0000-4000-8000-0000000000d2', 'a0000000-0000-4000-8000-0000000000d2', 'owner');
insert into public.fan_group_member (group_id, profile_id)
values ('c0000000-0000-4000-8000-0000000000d1', 'a0000000-0000-4000-8000-0000000000d2');

insert into public.friendship (requester_id, addressee_id, status, responded_at)
values ('a0000000-0000-4000-8000-0000000000d2', 'a0000000-0000-4000-8000-0000000000d1', 'aceite', now());
insert into public.group_invite (group_id, profile_id, invited_by)
values ('c0000000-0000-4000-8000-0000000000d2', 'a0000000-0000-4000-8000-0000000000d1', 'a0000000-0000-4000-8000-0000000000d2');

insert into t_ids (key, id) values
  ('m_b', gen_random_uuid()), ('m_a', gen_random_uuid()), ('r_b', gen_random_uuid()), ('r_a', gen_random_uuid()),
  ('ride', gen_random_uuid());

insert into public.group_message (id, group_id, profile_id, body, created_at)
values
  (pg_temp.id('m_a'), 'c0000000-0000-4000-8000-0000000000d1', 'a0000000-0000-4000-8000-0000000000d1', 'Mensagem da A', now() - interval '2 minutes'),
  (pg_temp.id('m_b'), 'c0000000-0000-4000-8000-0000000000d1', 'a0000000-0000-4000-8000-0000000000d2', 'Mensagem feia do B', now() - interval '1 minute');

-- B drives, A has a seat.
insert into public.ride (
  id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
  total_cents
)
select
  pg_temp.id('ride'), f.id, 'a0000000-0000-4000-8000-0000000000d2', 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)',
  f.kickoff_at - interval '3 hours', 3, 'rapida', false, 100000, 3600, 0, 600, 1700, 1020, 0, 1020
from public.fixture as f
where f.kickoff_at > now() + interval '2 days'
order by f.kickoff_at
limit 1;
select pg_temp.expect('there is a ride', (select count(*)::integer from public.ride where id = pg_temp.id('ride')), 1);
insert into public.ride_passenger (ride_id, profile_id, status)
values (pg_temp.id('ride'), 'a0000000-0000-4000-8000-0000000000d1', 'accepted');
insert into public.ride_message (id, ride_id, profile_id, body, created_at)
values
  (pg_temp.id('r_a'), pg_temp.id('ride'), 'a0000000-0000-4000-8000-0000000000d1', 'Do carro, da A', now() - interval '2 minutes'),
  (pg_temp.id('r_b'), pg_temp.id('ride'), 'a0000000-0000-4000-8000-0000000000d2', 'Do carro, feia do B', now() - interval '1 minute');

set local role authenticated;

-- 1. C can't report what C can't see.
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000d3');
select pg_temp.expect('outsider cannot report a group message',
  pg_temp.refusal(format('select public.report_content(%L, %L, %L)', 'message', pg_temp.id('m_b'), 'ofensivo')), 'not_found');
select pg_temp.expect('outsider cannot report a car message',
  pg_temp.refusal(format('select public.report_content(%L, %L, %L)', 'ride_message', pg_temp.id('r_b'), 'ofensivo')), 'not_found');
select pg_temp.expect('outsider cannot report a group',
  pg_temp.refusal(format('select public.report_content(%L, %L, %L)', 'group', 'c0000000-0000-4000-8000-0000000000d1', 'spam')), 'not_found');
select pg_temp.expect('outsider cannot report a stranger''s profile',
  pg_temp.refusal(format('select public.report_content(%L, %L, %L)', 'profile', 'a0000000-0000-4000-8000-0000000000d1', 'spam')), 'not_found');
select pg_temp.expect('outsider sees no reports', (select count(*)::integer from public.pending_content_reports()), 0);

-- 2. A reports what A sees, but not A's own, and only with a known reason.
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000d1');
insert into t_ids (key, id) values ('rep_m', public.report_content('message', pg_temp.id('m_b'), 'ofensivo', '  Insultou a malta toda  '));
insert into t_ids (key, id) values ('rep_r', public.report_content('ride_message', pg_temp.id('r_b'), 'assedio'));
select pg_temp.expect('reporting again updates the same report',
  public.report_content('message', pg_temp.id('m_b'), 'spam'), pg_temp.id('rep_m'));
select pg_temp.expect('own message cannot be reported',
  pg_temp.refusal(format('select public.report_content(%L, %L, %L)', 'message', pg_temp.id('m_a'), 'spam')), 'own_content');
select pg_temp.expect('unknown reason refused',
  pg_temp.refusal(format('select public.report_content(%L, %L, %L)', 'message', pg_temp.id('m_b'), 'chato')), 'bad_reason');
select pg_temp.expect('note over 500 refused',
  pg_temp.refusal(format('select public.report_content(%L, %L, %L, %L)', 'message', pg_temp.id('m_b'), 'spam', repeat('x', 501))), 'bad_note');
select pg_temp.expect('a group member can report the group',
  pg_temp.refusal(format('select public.report_content(%L, %L, %L)', 'group', 'c0000000-0000-4000-8000-0000000000d1', 'outro')), 'accepted');

-- 3. Nobody but admins reads reports, and nobody writes them directly.
select pg_temp.expect('reporter cannot read reports, even their own', (select count(*)::integer from public.content_report), 0);
select pg_temp.expect('reporter gets nothing from the admin list', (select count(*)::integer from public.pending_content_reports()), 0);
select pg_temp.expect('reports cannot be inserted directly',
  pg_temp.refusal(format(
    'insert into public.content_report (reporter_id, kind, target_id, reason) values (%L, %L, %L, %L)',
    'a0000000-0000-4000-8000-0000000000d1', 'profile', 'a0000000-0000-4000-8000-0000000000d2', 'spam')),
  'permission denied for table content_report');
select pg_temp.expect('non-admin cannot resolve',
  pg_temp.refusal(format('select public.resolve_content_report(%L, %L)', pg_temp.id('rep_m'), 'rejeitar')), 'not_admin');

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000d4');
select pg_temp.expect('admin reads the reports', (select count(*)::integer from public.content_report), 3);
select pg_temp.expect('admin sees one row per thing reported', (select count(*)::integer from public.pending_content_reports()), 3);
select pg_temp.expect('admin sees the message and the note',
  (select content || ' / ' || array_to_string(notes, ',') || ' / ' || array_to_string(reasons, ',')
   from public.pending_content_reports() where target_id = pg_temp.id('m_b')),
  'Mensagem feia do B /  / spam');
select pg_temp.expect('admin sees where it was said',
  (select context from public.pending_content_reports() where target_id = pg_temp.id('m_b')),
  'Conversa do grupo «Grupo Bloqueio»');

-- 4. Blocking: B's messages disappear for A, in the group and in the car, and nowhere else.
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000d1');
select pg_temp.expect('before: A sees both group messages',
  (select count(*)::integer from public.group_messages('c0000000-0000-4000-8000-0000000000d1')), 2);
select pg_temp.expect('cannot block yourself',
  pg_temp.refusal('select public.block_user(''a0000000-0000-4000-8000-0000000000d1'')'), 'bad_request');
select pg_temp.expect('cannot insert a self-block either',
  split_part(pg_temp.refusal('insert into public.user_block (blocker_id, blocked_id) values (''a0000000-0000-4000-8000-0000000000d1'', ''a0000000-0000-4000-8000-0000000000d1'')'), ' ', 1),
  'new');
select pg_temp.expect('cannot block on behalf of someone else',
  split_part(pg_temp.refusal('insert into public.user_block (blocker_id, blocked_id) values (''a0000000-0000-4000-8000-0000000000d3'', ''a0000000-0000-4000-8000-0000000000d2'')'), ' ', 1),
  'new');

select public.block_user('a0000000-0000-4000-8000-0000000000d2');
select public.block_user('a0000000-0000-4000-8000-0000000000d2');
select pg_temp.expect('A sees the block', (select count(*)::integer from public.my_blocked_people()), 1);
select pg_temp.expect('group chat hides B for A',
  (select string_agg(body, ',') from public.group_messages('c0000000-0000-4000-8000-0000000000d1')), 'Mensagem da A');
select pg_temp.expect('car chat hides B for A',
  (select string_agg(body, ',') from public.ride_messages(pg_temp.id('ride'))), 'Do carro, da A');
select pg_temp.expect('group inbox does not show B''s last message',
  (select last_body from public.my_group_inbox() where group_id = 'c0000000-0000-4000-8000-0000000000d1'), 'Mensagem da A');
select pg_temp.expect('car chat list does not show B''s last message',
  (select last_body || ':' || unread from public.my_ride_chats() where ride_id = pg_temp.id('ride')), 'Do carro, da A:0');
select pg_temp.expect('A is not told B can be befriended',
  (select state from public.friendship_states(array['a0000000-0000-4000-8000-0000000000d2'::uuid])), 'nada');
select pg_temp.expect('block helper is not callable by clients',
  split_part(pg_temp.refusal('select public.has_blocked(''a0000000-0000-4000-8000-0000000000d1'', ''a0000000-0000-4000-8000-0000000000d2'')'), ' ', 1),
  'permission');

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000d2');
select pg_temp.expect('B still sees everything in the group',
  (select count(*)::integer from public.group_messages('c0000000-0000-4000-8000-0000000000d1')), 2);
select pg_temp.expect('B still sees everything in the car',
  (select count(*)::integer from public.ride_messages(pg_temp.id('ride'))), 2);
select pg_temp.expect('B cannot see the block', (select count(*)::integer from public.user_block), 0);
select pg_temp.expect('friend request from B looks sent', public.send_friend_request('a0000000-0000-4000-8000-0000000000d1'), 'pedido');
select pg_temp.expect('B cannot invite A to a group',
  pg_temp.refusal('select public.invite_friend_to_group(''c0000000-0000-4000-8000-0000000000d2'', ''a0000000-0000-4000-8000-0000000000d1'')'),
  'not_friends');

reset role;
select pg_temp.expect('B is still in the group', public.is_group_member('c0000000-0000-4000-8000-0000000000d1', 'a0000000-0000-4000-8000-0000000000d2'), true);
select pg_temp.expect('the ride keeps its passenger', public.in_ride(pg_temp.id('ride'), 'a0000000-0000-4000-8000-0000000000d1'), true);
select pg_temp.expect('the friendship ended and no request was stored',
  (select count(*)::integer from public.friendship
   where 'a0000000-0000-4000-8000-0000000000d1' in (requester_id, addressee_id)), 0);
select pg_temp.expect('B''s pending group invite to A was dropped',
  (select count(*)::integer from public.group_invite where profile_id = 'a0000000-0000-4000-8000-0000000000d1'), 0);
set local role authenticated;

-- 5. Unblocking brings the messages back.
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000d1');
select public.unblock_user('a0000000-0000-4000-8000-0000000000d2');
select pg_temp.expect('A has nobody blocked', (select count(*)::integer from public.my_blocked_people()), 0);
select pg_temp.expect('group chat restored',
  (select count(*)::integer from public.group_messages('c0000000-0000-4000-8000-0000000000d1')), 2);
select pg_temp.expect('car chat restored',
  (select count(*)::integer from public.ride_messages(pg_temp.id('ride'))), 2);

-- 6. The admin hides the group message (gone for everyone) and dismisses the car report (stays).
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000d4');
select public.resolve_content_report(pg_temp.id('rep_m'), 'esconder');
select public.resolve_content_report(pg_temp.id('rep_r'), 'rejeitar');
select pg_temp.expect('hiding a car report as a photo is refused',
  pg_temp.refusal(format('select public.resolve_content_report(%L, %L)', pg_temp.id('rep_r'), 'tirar_foto')), 'bad_action');
select pg_temp.expect('one report left open', (select count(*)::integer from public.pending_content_reports()), 1);
select pg_temp.expect('statuses recorded',
  (select string_agg(status, ',' order by kind) from public.content_report where kind in ('message', 'ride_message')),
  'resolvida,rejeitada');

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000d1');
select pg_temp.expect('hidden message gone for A',
  (select string_agg(body, ',') from public.group_messages('c0000000-0000-4000-8000-0000000000d1')), 'Mensagem da A');
select pg_temp.expect('dismissed car message still there',
  (select count(*)::integer from public.ride_messages(pg_temp.id('ride'))), 2);
select pg_temp.expect('a hidden message cannot be reported again',
  pg_temp.refusal(format('select public.report_content(%L, %L, %L)', 'message', pg_temp.id('m_b'), 'spam')), 'not_found');
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000d2');
select pg_temp.expect('hidden message gone for its author too',
  (select count(*)::integer from public.group_messages('c0000000-0000-4000-8000-0000000000d1')), 1);

-- 7. Rate limit: 20 reports a day.
reset role;
insert into public.rate_limit_hit (profile_id, bucket)
select 'a0000000-0000-4000-8000-0000000000d1', 'content-report' from generate_series(1, 20);
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000d1');
select pg_temp.expect('21st report of the day refused',
  pg_temp.refusal(format('select public.report_content(%L, %L, %L)', 'ride_message', pg_temp.id('r_b'), 'spam')), 'rate_limited');

reset role;
select count(*) as checks_passed from expect_log;

rollback;
