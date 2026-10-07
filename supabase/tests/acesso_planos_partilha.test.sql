-- Tests for sending a plan to another group in the open, and taking it back (share/unshare, notices).
--
-- People: O owns group G1 (where the plan is) and is also in G2; A is in G1; S and T are in G2, where the plan is
-- sent; T has a bed in the plan's house; X is an outsider.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_planos_partilha.test.sql

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
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- The messages of a kind in a group, about the plan, as one line.
create function pg_temp.msgs(p_group text, p_kind text)
returns text
language sql
as $$
  select string_agg(body, ' | ' order by created_at)
  from public.group_message
  where group_id = p_group::uuid and kind = p_kind and plan_id = pg_temp.id('plano');
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('e8200000-0000-4000-8000-000000000001', 'part-o@test.invalid', '{"display_name":"Ana Partilha"}', 'authenticated', 'authenticated'),
  ('e8200000-0000-4000-8000-000000000002', 'part-a@test.invalid', '{"display_name":"Rui Partilha"}', 'authenticated', 'authenticated'),
  ('e8200000-0000-4000-8000-000000000003', 'part-s@test.invalid', '{"display_name":"Sara Partilha"}', 'authenticated', 'authenticated'),
  ('e8200000-0000-4000-8000-000000000004', 'part-t@test.invalid', '{"display_name":"Tó Partilha"}', 'authenticated', 'authenticated'),
  ('e8200000-0000-4000-8000-000000000005', 'part-x@test.invalid', '{"display_name":"Xico Partilha"}', 'authenticated', 'authenticated');

insert into public.fan_group (id, name, created_by, invite_code)
values
  ('e8200000-0000-4000-8000-0000000000a1', 'Malta Partilha', 'e8200000-0000-4000-8000-000000000001', 'tpart00001'),
  ('e8200000-0000-4000-8000-0000000000a2', 'Primos Partilha', 'e8200000-0000-4000-8000-000000000003', 'tpart00002');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('e8200000-0000-4000-8000-0000000000a1', 'e8200000-0000-4000-8000-000000000001', 'owner'),
  ('e8200000-0000-4000-8000-0000000000a1', 'e8200000-0000-4000-8000-000000000002', 'member'),
  ('e8200000-0000-4000-8000-0000000000a2', 'e8200000-0000-4000-8000-000000000003', 'owner'),
  ('e8200000-0000-4000-8000-0000000000a2', 'e8200000-0000-4000-8000-000000000004', 'member'),
  ('e8200000-0000-4000-8000-0000000000a2', 'e8200000-0000-4000-8000-000000000001', 'member');

insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at)
select 'teste-partilha-plano', f.competition_id, f.stage, f.home_club_id, f.away_club_id, f.venue_id, now() + interval '6 days'
from public.fixture as f order by f.id limit 1;

insert into t_ids (key, id) values ('plano', gen_random_uuid()), ('casa', gen_random_uuid());
insert into public.stay_plan (id, fixture_id, profile_id, nights, commitment, spare_places, total_cents, group_id, visibility)
values (pg_temp.id('casa'), 'teste-partilha-plano', 'e8200000-0000-4000-8000-000000000001', 2, 'certo', 4, 30000,
  'e8200000-0000-4000-8000-0000000000a1', 'grupo');
insert into public.fixture_plan (id, group_id, fixture_id, created_by, stay_plan_id)
values (pg_temp.id('plano'), 'e8200000-0000-4000-8000-0000000000a1', 'teste-partilha-plano',
  'e8200000-0000-4000-8000-000000000001', pg_temp.id('casa'));
insert into public.fixture_plan_answer (plan_id, profile_id, answer)
values (pg_temp.id('plano'), 'e8200000-0000-4000-8000-000000000001', 'vou');

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Sending: the card goes to the other group, and the home group is told.

set local role authenticated;
select pg_temp.as_user('e8200000-0000-4000-8000-000000000001');
select public.share_fixture_plan(pg_temp.id('plano'), 'e8200000-0000-4000-8000-0000000000a2');

reset role;
select pg_temp.expect('the card is in the other group''s chat',
  (select count(*)::integer from public.group_message
   where group_id = 'e8200000-0000-4000-8000-0000000000a2' and kind = 'plano' and plan_id = pg_temp.id('plano')), 1);
select pg_temp.expect('the home group gets a notice saying where it went',
  pg_temp.msgs('e8200000-0000-4000-8000-0000000000a1', 'aviso') like 'Ana Partilha mandou o plano % ao grupo «Primos Partilha». Eles veem a boleia e a casa e podem pedir lugar.',
  true);
select pg_temp.expect('the other group gets no notice, only the card',
  pg_temp.msgs('e8200000-0000-4000-8000-0000000000a2', 'aviso'), null::text);

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Who sees where it went.

set local role authenticated;
select pg_temp.as_user('e8200000-0000-4000-8000-000000000002');
select pg_temp.expect('someone in the home group sees the groups it was sent to',
  (select string_agg(group_name, ',') from public.fixture_plan_shared_groups(pg_temp.id('plano'))), 'Primos Partilha');
select pg_temp.as_user('e8200000-0000-4000-8000-000000000003');
select pg_temp.expect('someone in the other group does not get the list',
  (select count(*)::integer from public.fixture_plan_shared_groups(pg_temp.id('plano'))), 0);
select pg_temp.expect('but sees the plan, and which group it comes from',
  (select group_name from public.fixture_plan_summaries(array[pg_temp.id('plano')])), 'Malta Partilha');
select pg_temp.as_user('e8200000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider sees neither',
  (select count(*)::integer from public.fixture_plan_shared_groups(pg_temp.id('plano')))
  + (select count(*)::integer from public.fixture_plan_summaries(array[pg_temp.id('plano')])), 0);

-- Nobody writes a notice by hand.
select pg_temp.as_user('e8200000-0000-4000-8000-000000000002');
select pg_temp.expect('nobody calls the notice writer',
  pg_temp.refusal(format('select public.post_plan_notice(%L, %L, %L, %L)', 'e8200000-0000-4000-8000-0000000000a1',
    'e8200000-0000-4000-8000-000000000002', pg_temp.id('plano'), 'Aviso falso')) <> 'accepted', true);
select pg_temp.expect('nobody writes into the messages table',
  pg_temp.refusal(format('insert into public.group_message (group_id, profile_id, kind, body, plan_id) values (%L, %L, %L, %L, %L)',
    'e8200000-0000-4000-8000-0000000000a1', 'e8200000-0000-4000-8000-000000000002', 'aviso', 'Aviso falso',
    pg_temp.id('plano'))) <> 'accepted', true);
reset role;
select pg_temp.expect('a notice always names its plan',
  pg_temp.refusal(format('insert into public.group_message (group_id, profile_id, kind, body) values (%L, %L, %L, %L)',
    'e8200000-0000-4000-8000-0000000000a1', 'e8200000-0000-4000-8000-000000000002', 'aviso', 'Sem plano'))
  like '%group_message_notice_needs_plan%', true);

-- People from the other group join: S says she goes, T takes a bed in the house.
insert into public.fixture_plan_answer (plan_id, profile_id, answer)
values (pg_temp.id('plano'), 'e8200000-0000-4000-8000-000000000003', 'vou');
insert into public.stay_place (plan_id, profile_id, status)
values (pg_temp.id('casa'), 'e8200000-0000-4000-8000-000000000004', 'aceite');

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Taking it back.

set local role authenticated;
select pg_temp.as_user('e8200000-0000-4000-8000-000000000002');
select pg_temp.expect('only who invited takes it back',
  pg_temp.refusal(format('select public.unshare_fixture_plan(%L, %L)', pg_temp.id('plano'), 'e8200000-0000-4000-8000-0000000000a2')),
  'not_owner');
select pg_temp.as_user('e8200000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider cannot even find it',
  pg_temp.refusal(format('select public.unshare_fixture_plan(%L, %L)', pg_temp.id('plano'), 'e8200000-0000-4000-8000-0000000000a2')),
  'plan_not_found');

select pg_temp.as_user('e8200000-0000-4000-8000-000000000001');
select public.unshare_fixture_plan(pg_temp.id('plano'), 'e8200000-0000-4000-8000-0000000000a2');

reset role;
select pg_temp.expect('the card leaves the other group''s chat',
  pg_temp.msgs('e8200000-0000-4000-8000-0000000000a2', 'plano'), null::text);
select pg_temp.expect('the other group is told it was taken back',
  pg_temp.msgs('e8200000-0000-4000-8000-0000000000a2', 'aviso') like 'Ana Partilha deixou de abrir o plano % a este grupo.', true);
-- (Everything here runs in one transaction, so both notices share a timestamp: count them, do not order them.)
select pg_temp.expect('the home group is told too, next to the first notice',
  (select count(*)::integer from public.group_message
   where group_id = 'e8200000-0000-4000-8000-0000000000a1' and kind = 'aviso' and plan_id = pg_temp.id('plano')
     and body like 'Ana Partilha deixou de abrir o plano % ao grupo «Primos Partilha». Os lugares já aceites ficam como estão.'),
  1);
select pg_temp.expect('who no longer sees the plan loses their answer; who still sees it keeps it',
  (select string_agg(p.display_name, ',' order by p.display_name)
   from public.fixture_plan_answer as a join public.profile as p on p.id = a.profile_id
   where a.plan_id = pg_temp.id('plano')), 'Ana Partilha');
select pg_temp.expect('a bed already accepted stays',
  (select status from public.stay_place where plan_id = pg_temp.id('casa') and profile_id = 'e8200000-0000-4000-8000-000000000004'),
  'aceite');

set local role authenticated;
select pg_temp.as_user('e8200000-0000-4000-8000-000000000003');
select pg_temp.expect('the other group no longer sees the plan',
  (select count(*)::integer from public.fixture_plan_summaries(array[pg_temp.id('plano')]))
  + (select count(*)::integer from public.group_fixture_plans('e8200000-0000-4000-8000-0000000000a2')), 0);
select pg_temp.as_user('e8200000-0000-4000-8000-000000000002');
select pg_temp.expect('the home group no longer lists that group',
  (select count(*)::integer from public.fixture_plan_shared_groups(pg_temp.id('plano'))), 0);

select pg_temp.as_user('e8200000-0000-4000-8000-000000000001');
select pg_temp.expect('taking it back twice says it was not shared',
  pg_temp.refusal(format('select public.unshare_fixture_plan(%L, %L)', pg_temp.id('plano'), 'e8200000-0000-4000-8000-0000000000a2')),
  'not_shared');
select public.share_fixture_plan(pg_temp.id('plano'), 'e8200000-0000-4000-8000-0000000000a2');
reset role;
select pg_temp.expect('it can be sent again',
  (select count(*)::integer from public.group_message
   where group_id = 'e8200000-0000-4000-8000-0000000000a2' and kind = 'plano' and plan_id = pg_temp.id('plano')), 1);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
