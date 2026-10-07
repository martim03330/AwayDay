-- Tests for the house in the trip accounts (sync_stay_trip_expense and its triggers).
--
-- People: A proposes and books the house; B, C and D go too; O is an outsider. The plan's session has A, B, C, D.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_casa_contas.test.sql

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
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- The house expense of the session, as one line: payer:cents:who shares it.
create function pg_temp.casa(p_session uuid)
returns text
language sql
as $$
  select p.display_name || ':' || e.cents || ':' || coalesce((
    select string_agg(q.display_name, ',' order by q.display_name)
    from public.trip_expense_share as sh join public.profile as q on q.id = sh.profile_id
    where sh.expense_id = e.id
  ), '')
  from public.trip_expense as e join public.profile as p on p.id = e.payer_id
  where e.session_id = p_session and e.source = 'casa';
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('e8100000-0000-4000-8000-000000000001', 'casa-a@test.invalid', '{"display_name":"Casa A"}', 'authenticated', 'authenticated'),
  ('e8100000-0000-4000-8000-000000000002', 'casa-b@test.invalid', '{"display_name":"Casa B"}', 'authenticated', 'authenticated'),
  ('e8100000-0000-4000-8000-000000000003', 'casa-c@test.invalid', '{"display_name":"Casa C"}', 'authenticated', 'authenticated'),
  ('e8100000-0000-4000-8000-000000000004', 'casa-d@test.invalid', '{"display_name":"Casa D"}', 'authenticated', 'authenticated'),
  ('e8100000-0000-4000-8000-000000000005', 'casa-o@test.invalid', '{"display_name":"Casa O"}', 'authenticated', 'authenticated');

insert into public.fan_group (id, name, created_by, invite_code)
values ('e8100000-0000-4000-8000-0000000000a1', 'Grupo Casa', 'e8100000-0000-4000-8000-000000000001', 'tcasa00001');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('e8100000-0000-4000-8000-0000000000a1', 'e8100000-0000-4000-8000-000000000001', 'owner'),
  ('e8100000-0000-4000-8000-0000000000a1', 'e8100000-0000-4000-8000-000000000002', 'member'),
  ('e8100000-0000-4000-8000-0000000000a1', 'e8100000-0000-4000-8000-000000000003', 'member'),
  ('e8100000-0000-4000-8000-0000000000a1', 'e8100000-0000-4000-8000-000000000004', 'member');

-- A game far away, a plan for it, and a house of 360,01 € (an odd number of cents on purpose).
insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at)
select 'teste-casa-contas', f.competition_id, f.stage, f.home_club_id, f.away_club_id, f.venue_id, now() + interval '5 days'
from public.fixture as f order by f.id limit 1;

insert into t_ids (key, id) values ('plano', gen_random_uuid()), ('casa', gen_random_uuid());
insert into public.stay_plan (id, fixture_id, profile_id, nights, commitment, spare_places, total_cents, group_id, visibility)
values (pg_temp.id('casa'), 'teste-casa-contas', 'e8100000-0000-4000-8000-000000000001', 2, 'certo', 5, 36001,
  'e8100000-0000-4000-8000-0000000000a1', 'grupo');
insert into public.fixture_plan (id, group_id, fixture_id, created_by, stay_plan_id)
values (pg_temp.id('plano'), 'e8100000-0000-4000-8000-0000000000a1', 'teste-casa-contas',
  'e8100000-0000-4000-8000-000000000001', pg_temp.id('casa'));
insert into public.fixture_plan_answer (plan_id, profile_id, answer)
select pg_temp.id('plano'), p, 'vou'
from unnest(array['e8100000-0000-4000-8000-000000000001', 'e8100000-0000-4000-8000-000000000002',
  'e8100000-0000-4000-8000-000000000003', 'e8100000-0000-4000-8000-000000000004']::uuid[]) as p;
insert into t_ids (key, id) values ('sessao', public.ensure_plan_session(pg_temp.id('plano')));

select pg_temp.expect('the session has the four who go',
  (select count(*)::integer from public.trip_session_member where session_id = pg_temp.id('sessao')), 4);

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Only a booked house enters the accounts.

select pg_temp.expect('a house not yet booked is not in the accounts', pg_temp.casa(pg_temp.id('sessao')), null::text);

set local role authenticated;
select pg_temp.as_user('e8100000-0000-4000-8000-000000000002');
select pg_temp.expect('only who proposed the house can mark it booked',
  pg_temp.refusal(format('select public.mark_stay_house(%L, true)', pg_temp.id('casa'))), 'not_owner');

select pg_temp.as_user('e8100000-0000-4000-8000-000000000001');
select public.mark_stay_house(pg_temp.id('casa'), true);
reset role;
insert into t_ids (key, id)
select 'despesa', id from public.trip_expense where session_id = pg_temp.id('sessao') and source = 'casa';
select pg_temp.expect('booked: the whole house, paid by who proposed it, shared by the session (no beds marked)',
  pg_temp.casa(pg_temp.id('sessao')), 'Casa A:36001:Casa A,Casa B,Casa C,Casa D');
select pg_temp.expect('the accounts add up to zero, cents and all',
  (select sum(balance_cents)::integer from public.trip_balances(pg_temp.id('sessao'))), 0);
set local role authenticated;
select pg_temp.as_user('e8100000-0000-4000-8000-000000000001');
select pg_temp.expect('the house shows in the expenses list as the house''s',
  (select source || ':' || category || ':' || mine from public.trip_expenses(pg_temp.id('sessao'))), 'casa:casa:false');

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Nobody writes or deletes it by hand.

select pg_temp.expect('who paid cannot delete the house expense',
  pg_temp.refusal(format('select public.remove_trip_expense(%L)', pg_temp.id('despesa'))), 'stay_expense');
select pg_temp.as_user('e8100000-0000-4000-8000-000000000003');
select pg_temp.expect('nor anyone else in the trip',
  pg_temp.refusal(format('select public.remove_trip_expense(%L)', pg_temp.id('despesa'))), 'stay_expense');
select pg_temp.expect('nobody writes a house expense straight into the table',
  pg_temp.refusal(format(
    'insert into public.trip_expense (session_id, payer_id, description, category, cents, created_by, source) values (%L, %L, %L, %L, 100, %L, %L)',
    pg_temp.id('sessao'), 'e8100000-0000-4000-8000-000000000003', 'Casa falsa', 'casa',
    'e8100000-0000-4000-8000-000000000003', 'casa')) <> 'accepted', true);
select pg_temp.expect('nobody calls the sync by hand',
  pg_temp.refusal(format('select public.sync_stay_trip_expense(%L)', pg_temp.id('sessao'))) <> 'accepted', true);

select pg_temp.as_user('e8100000-0000-4000-8000-000000000005');
select pg_temp.expect('an outsider sees nothing of the trip''s expenses',
  (select count(*)::integer from public.trip_expenses(pg_temp.id('sessao'))), 0);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. It follows the house: beds, price, people, booking.

reset role;
select pg_temp.as_user('e8100000-0000-4000-8000-000000000001');   -- the balances answer only to someone in the trip
insert into public.stay_place (plan_id, profile_id, status)
values (pg_temp.id('casa'), 'e8100000-0000-4000-8000-000000000002', 'aceite');
select pg_temp.expect('with a bed marked, only who has a bed shares it (and who proposed it)',
  pg_temp.casa(pg_temp.id('sessao')), 'Casa A:36001:Casa A,Casa B');

insert into public.stay_place (plan_id, profile_id, status)
values (pg_temp.id('casa'), 'e8100000-0000-4000-8000-000000000003', 'pedido');
select pg_temp.expect('a bed only asked for does not count', pg_temp.casa(pg_temp.id('sessao')), 'Casa A:36001:Casa A,Casa B');
update public.stay_place set status = 'aceite'
where plan_id = pg_temp.id('casa') and profile_id = 'e8100000-0000-4000-8000-000000000003';
select pg_temp.expect('a bed accepted joins the house expense', pg_temp.casa(pg_temp.id('sessao')), 'Casa A:36001:Casa A,Casa B,Casa C');
select pg_temp.expect('three-way split still adds up to zero',
  (select sum(balance_cents)::integer from public.trip_balances(pg_temp.id('sessao'))), 0);
select pg_temp.expect('no one is owed a cent more than a third, rounded',
  (select string_agg(display_name || ':' || owed_cents, ',' order by display_name)
   from public.trip_balances(pg_temp.id('sessao')) where owed_cents > 0),
  'Casa A:12001,Casa B:12000,Casa C:12000');

update public.stay_place set status = 'saiu'
where plan_id = pg_temp.id('casa') and profile_id = 'e8100000-0000-4000-8000-000000000003';
select pg_temp.expect('who leaves the house leaves its expense', pg_temp.casa(pg_temp.id('sessao')), 'Casa A:36001:Casa A,Casa B');

update public.stay_plan set total_cents = 40000 where id = pg_temp.id('casa');
select pg_temp.expect('a new price redoes the expense', pg_temp.casa(pg_temp.id('sessao')), 'Casa A:40000:Casa A,Casa B');

set local role authenticated;
select pg_temp.as_user('e8100000-0000-4000-8000-000000000001');
select public.remove_trip_person(pg_temp.id('sessao'), 'e8100000-0000-4000-8000-000000000002');
reset role;
select pg_temp.expect('who leaves the trip leaves the house expense', pg_temp.casa(pg_temp.id('sessao')), 'Casa A:40000:Casa A');

set local role authenticated;
select pg_temp.as_user('e8100000-0000-4000-8000-000000000001');
select public.mark_stay_house(pg_temp.id('casa'), false);
reset role;
select pg_temp.expect('no longer booked: the expense leaves the accounts', pg_temp.casa(pg_temp.id('sessao')), null::text);
set local role authenticated;
select pg_temp.as_user('e8100000-0000-4000-8000-000000000001');
select public.mark_stay_house(pg_temp.id('casa'), true);
reset role;
select pg_temp.expect('booked again: it comes back', pg_temp.casa(pg_temp.id('sessao')), 'Casa A:40000:Casa A');

update public.fixture_plan set stay_plan_id = null where id = pg_temp.id('plano');
select pg_temp.expect('the plan drops the house: the expense leaves', pg_temp.casa(pg_temp.id('sessao')), null::text);
update public.fixture_plan set stay_plan_id = pg_temp.id('casa') where id = pg_temp.id('plano');
select pg_temp.expect('the plan takes it back: it comes back', pg_temp.casa(pg_temp.id('sessao')), 'Casa A:40000:Casa A');

delete from public.trip_session_member
where session_id = pg_temp.id('sessao') and profile_id = 'e8100000-0000-4000-8000-000000000001';
select pg_temp.expect('who booked it is no longer in the trip: the expense leaves', pg_temp.casa(pg_temp.id('sessao')), null::text);

delete from public.trip_session where id = pg_temp.id('sessao');
select pg_temp.expect('deleting the whole trip leaves nothing behind',
  (select count(*)::integer from public.trip_expense where session_id = pg_temp.id('sessao')), 0);

select pg_temp.expect('the ride expense still has its own rule (one per session)',
  (select count(*)::integer from pg_indexes where indexname in ('trip_expense_ride_idx', 'trip_expense_stay_idx')), 2);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
