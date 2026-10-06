-- Tests for one invite per game in each group (migration 20261006114657_one_invite_per_game.sql).
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/one_invite.test.sql

begin;

create temporary table expect_log (name text) on commit drop;
create temporary table t_ids (jogo text, plano uuid, mensagens integer) on commit drop;
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

-- Runs a call that must be refused, and returns "<message>|<detail>".
create function pg_temp.refusal(p_sql text)
returns text
language plpgsql
as $$
declare
  mensagem text;
  detalhe text;
begin
  execute p_sql;
  return 'accepted';
exception when others then
  get stacked diagnostics mensagem = message_text, detalhe = pg_exception_detail;
  return mensagem || '|' || coalesce(detalhe, '');
end;
$$;

-- One person in two groups, and a game still to be played.
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values ('a0000000-0000-4000-8000-0000000000c1', 'convite-a@test.invalid', '{"display_name":"Convite A"}', 'authenticated', 'authenticated');

insert into public.fan_group (id, name, created_by, invite_code)
values
  ('c0000000-0000-4000-8000-0000000000a1', 'Grupo Um', 'a0000000-0000-4000-8000-0000000000c1', 'testeum001'),
  ('c0000000-0000-4000-8000-0000000000a2', 'Grupo Dois', 'a0000000-0000-4000-8000-0000000000c1', 'testedois1'),
  ('c0000000-0000-4000-8000-0000000000a3', 'Grupo Tres', 'a0000000-0000-4000-8000-0000000000c1', 'testetres1');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('c0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-0000000000c1', 'owner'),
  ('c0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000c1', 'owner'),
  ('c0000000-0000-4000-8000-0000000000a3', 'a0000000-0000-4000-8000-0000000000c1', 'owner');

insert into t_ids (jogo)
select f.id from public.fixture as f where f.kickoff_at > now() + interval '2 days' order by f.kickoff_at limit 1;
select pg_temp.expect('there is a game to invite to', (select jogo is not null from t_ids), true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);

-- 1. The first invite goes through and lands in the chat once.
update t_ids set plano = public.invite_group_to_fixture('c0000000-0000-4000-8000-0000000000a1', (select jogo from t_ids));
select pg_temp.expect('first invite creates a plan', (select plano is not null from t_ids), true);
reset role;
select pg_temp.expect('one card in the chat',
  (select count(*)::integer from public.group_message
   where group_id = 'c0000000-0000-4000-8000-0000000000a1' and plan_id = (select plano from t_ids)), 1);
set local role authenticated;

-- 2. Inviting the same group again is refused, says which plan, and posts nothing.
select pg_temp.expect('second invite refused with the plan',
  pg_temp.refusal(format('select public.invite_group_to_fixture(%L, %L)',
    'c0000000-0000-4000-8000-0000000000a1', (select jogo from t_ids))),
  'plan_exists|' || (select plano from t_ids)::text);
reset role;
select pg_temp.expect('still one card in the chat',
  (select count(*)::integer from public.group_message
   where group_id = 'c0000000-0000-4000-8000-0000000000a1' and plan_id = (select plano from t_ids)), 1);
set local role authenticated;

-- 3. Sending it to another group works once; again is refused.
select public.share_fixture_plan((select plano from t_ids), 'c0000000-0000-4000-8000-0000000000a2');
select pg_temp.expect('sending the same plan twice is refused',
  pg_temp.refusal(format('select public.share_fixture_plan(%L, %L)',
    (select plano from t_ids), 'c0000000-0000-4000-8000-0000000000a2')),
  'plan_exists|' || (select plano from t_ids)::text);
reset role;
select pg_temp.expect('one card in the other group',
  (select count(*)::integer from public.group_message
   where group_id = 'c0000000-0000-4000-8000-0000000000a2' and plan_id = (select plano from t_ids)), 1);
set local role authenticated;

-- 4. The group that received it cannot start its own invite for the same game.
select pg_temp.expect('a group with a shared plan cannot invite again',
  pg_temp.refusal(format('select public.invite_group_to_fixture(%L, %L)',
    'c0000000-0000-4000-8000-0000000000a2', (select jogo from t_ids))),
  'plan_exists|' || (select plano from t_ids)::text);

-- 5. A group with its own plan for the game does not get a second one sent to it.
select public.invite_group_to_fixture('c0000000-0000-4000-8000-0000000000a3', (select jogo from t_ids));
select pg_temp.expect('a group with its own plan refuses another',
  split_part(pg_temp.refusal(format('select public.share_fixture_plan(%L, %L)',
    (select plano from t_ids), 'c0000000-0000-4000-8000-0000000000a3')), '|', 1),
  'plan_exists');

-- 6. Once cancelled, the game can be invited to again.
reset role;
update public.fixture_plan set status = 'cancelado' where id = (select plano from t_ids);
set local role authenticated;
select pg_temp.expect('after cancelling, a new invite is fine',
  split_part(pg_temp.refusal(format('select public.invite_group_to_fixture(%L, %L)',
    'c0000000-0000-4000-8000-0000000000a1', (select jogo from t_ids))), '|', 1),
  'accepted');

reset role;
select count(*) as checks_passed from expect_log;

rollback;
