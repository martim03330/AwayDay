-- Tests for retries of money writes in the trip accounts: add_trip_expense and add_trip_settlement with p_client_id
-- (migration 20261009100000). The same client_id twice gives the same row and writes one; nobody else can use
-- someone's client_id to get at their row.
--
-- People: A, B and C are a group with shared accounts; O is an outsider.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_contas_idempotencia.test.sql

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

create function pg_temp.as_anon()
returns void
language sql
as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;

-- Rows with this client_id in each table (read as postgres).
create function pg_temp.expenses_with(p_client_id uuid)
returns integer
language sql
as $$
  select count(*)::integer from public.trip_expense where client_id = p_client_id;
$$;

create function pg_temp.settlements_with(p_client_id uuid)
returns integer
language sql
as $$
  select count(*)::integer from public.trip_settlement where client_id = p_client_id;
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('e9500000-0000-4000-8000-000000000001', 'idem-a@test.invalid', '{"display_name":"Idem A"}', 'authenticated', 'authenticated'),
  ('e9500000-0000-4000-8000-000000000002', 'idem-b@test.invalid', '{"display_name":"Idem B"}', 'authenticated', 'authenticated'),
  ('e9500000-0000-4000-8000-000000000003', 'idem-c@test.invalid', '{"display_name":"Idem C"}', 'authenticated', 'authenticated'),
  ('e9500000-0000-4000-8000-000000000004', 'idem-o@test.invalid', '{"display_name":"Idem O"}', 'authenticated', 'authenticated');

insert into public.fan_group (id, name, created_by, invite_code)
values ('e9500000-0000-4000-8000-0000000000a1', 'Malta Idem', 'e9500000-0000-4000-8000-000000000001', 'tidem00001');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('e9500000-0000-4000-8000-0000000000a1', 'e9500000-0000-4000-8000-000000000001', 'owner'),
  ('e9500000-0000-4000-8000-0000000000a1', 'e9500000-0000-4000-8000-000000000002', 'member'),
  ('e9500000-0000-4000-8000-0000000000a1', 'e9500000-0000-4000-8000-000000000003', 'member');

insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at)
select 'teste-idempotencia', f.competition_id, f.stage, f.home_club_id, f.away_club_id, f.venue_id, now() + interval '1 day'
from public.fixture as f order by f.id limit 1;

insert into t_ids (key, id)
values ('k1', gen_random_uuid()), ('k2', gen_random_uuid()), ('k3', gen_random_uuid()), ('k4', gen_random_uuid());

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. The new signatures: old ones gone, signed-in people only.

select pg_temp.expect('the old add_trip_expense is gone',
  to_regprocedure('public.add_trip_expense(uuid,text,text,integer,uuid,uuid[])') is null, true);
select pg_temp.expect('the old add_trip_settlement is gone',
  to_regprocedure('public.add_trip_settlement(uuid,uuid,integer,uuid)') is null, true);
select pg_temp.expect('add_trip_expense: authenticated yes, anon no',
  has_function_privilege('authenticated', 'public.add_trip_expense(uuid,text,text,integer,uuid,uuid[],uuid)', 'execute')
  and not has_function_privilege('anon', 'public.add_trip_expense(uuid,text,text,integer,uuid,uuid[],uuid)', 'execute'),
  true);
select pg_temp.expect('add_trip_settlement: authenticated yes, anon no',
  has_function_privilege('authenticated', 'public.add_trip_settlement(uuid,uuid,integer,uuid,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.add_trip_settlement(uuid,uuid,integer,uuid,uuid)', 'execute'),
  true);
select pg_temp.expect('client_id is optional on both tables',
  (select string_agg(table_name || ':' || data_type || ':' || is_nullable, ',' order by table_name)
   from information_schema.columns
   where table_schema = 'public' and table_name in ('trip_expense', 'trip_settlement') and column_name = 'client_id'),
  'trip_expense:uuid:YES,trip_settlement:uuid:YES');

set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon cannot add an expense with a client_id',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, 100, null, null, %L)', gen_random_uuid(), 'Cerveja',
    'cerveja', pg_temp.id('k1'))), 'permission denied for function add_trip_expense');
select pg_temp.expect('anon cannot record a payment with a client_id',
  pg_temp.refusal(format('select public.add_trip_settlement(%L, %L, 100, null, %L)', gen_random_uuid(), gen_random_uuid(),
    pg_temp.id('k1'))), 'permission denied for function add_trip_settlement');

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Expenses.

set local role authenticated;
select pg_temp.as_user('e9500000-0000-4000-8000-000000000001');
insert into t_ids (key, id) values ('s', public.open_trip_session('e9500000-0000-4000-8000-0000000000a1', 'teste-idempotencia'));
insert into t_ids (key, id) values ('avulsa', public.start_trip_session('teste-idempotencia', 'Só eu'));

insert into t_ids (key, id)
values ('e1', public.add_trip_expense(pg_temp.id('s'), 'Cervejas', 'cerveja', 900, null, null, pg_temp.id('k1')));
select pg_temp.expect('the same client_id again gives the same expense',
  public.add_trip_expense(pg_temp.id('s'), 'Cervejas', 'cerveja', 900, null, null, pg_temp.id('k1')), pg_temp.id('e1'));
select pg_temp.expect('a retry with other values still gives the first expense, unchanged',
  public.add_trip_expense(pg_temp.id('s'), 'Cervejas e tremoços', 'petiscos', 1500, null, null, pg_temp.id('k1')),
  pg_temp.id('e1'));
reset role;
select pg_temp.expect('one row was written, with its shares once',
  pg_temp.expenses_with(pg_temp.id('k1')) || ':'
  || (select count(*) from public.trip_expense_share where expense_id = pg_temp.id('e1')) || ':'
  || (select cents || '/' || description from public.trip_expense where id = pg_temp.id('e1')),
  '1:3:900/Cervejas');
set local role authenticated;
select pg_temp.as_user('e9500000-0000-4000-8000-000000000001');
select pg_temp.expect('the balances count it once (900 between three)',
  (select string_agg(display_name || ':' || balance_cents, ',' order by display_name) from public.trip_balances(pg_temp.id('s'))),
  'Idem A:600,Idem B:-300,Idem C:-300');

select pg_temp.as_user('e9500000-0000-4000-8000-000000000002');
select pg_temp.expect('someone else in the session cannot reuse A''s client_id (and does not get its id)',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, 900, null, null, %L)', pg_temp.id('s'), 'Cervejas',
    'cerveja', pg_temp.id('k1'))), 'duplicate_request');
select pg_temp.as_user('e9500000-0000-4000-8000-000000000004');
select pg_temp.expect('an outsider with A''s client_id is not even a member',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, 900, null, null, %L)', pg_temp.id('s'), 'Cervejas',
    'cerveja', pg_temp.id('k1'))), 'not_member');
reset role;
select pg_temp.expect('still one row with that client_id', pg_temp.expenses_with(pg_temp.id('k1')), 1);

set local role authenticated;
select pg_temp.as_user('e9500000-0000-4000-8000-000000000001');
select pg_temp.expect('the same client_id in another session is another request',
  public.add_trip_expense(pg_temp.id('avulsa'), 'Café', 'outro', 80, null, null, pg_temp.id('k1')) <> pg_temp.id('e1'), true);
select pg_temp.expect('a retry still checks who may write first',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, 900, null, null, %L)', gen_random_uuid(), 'Cervejas',
    'cerveja', pg_temp.id('k1'))), 'session_not_found');
select public.add_trip_expense(pg_temp.id('s'), 'Pão', 'petiscos', 300);
select public.add_trip_expense(pg_temp.id('s'), 'Pão', 'petiscos', 300);
select pg_temp.expect('a bad expense with a client_id is refused',
  pg_temp.refusal(format('select public.add_trip_expense(%L, %L, %L, 0, null, null, %L)', pg_temp.id('s'), 'Nada',
    'cerveja', pg_temp.id('k3'))), 'bad_expense');
reset role;
select pg_temp.expect('without a client_id it works as before (two calls, two rows)',
  (select count(*)::integer from public.trip_expense where session_id = pg_temp.id('s') and description = 'Pão'), 2);
select pg_temp.expect('a bad request with a new client_id writes nothing and keeps nothing',
  pg_temp.expenses_with(pg_temp.id('k3')), 0);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Payments: B and C owe A 500 each (300 of the beer + 2 x 100 of the bread). The retry comes before the "how much is owed" checks.

set local role authenticated;
select pg_temp.as_user('e9500000-0000-4000-8000-000000000002');
insert into t_ids (key, id)
values ('p1', public.add_trip_settlement(pg_temp.id('s'), 'e9500000-0000-4000-8000-000000000001', 500, null, pg_temp.id('k2')));
select pg_temp.expect('without a client_id, paying again now is refused: nothing is owed',
  pg_temp.refusal(format('select public.add_trip_settlement(%L, %L, 500)', pg_temp.id('s'),
    'e9500000-0000-4000-8000-000000000001')), 'nothing_owed');
select pg_temp.expect('with the same client_id the retry gets the same payment back',
  public.add_trip_settlement(pg_temp.id('s'), 'e9500000-0000-4000-8000-000000000001', 500, null, pg_temp.id('k2')),
  pg_temp.id('p1'));
select pg_temp.as_user('e9500000-0000-4000-8000-000000000003');
select pg_temp.expect('someone else cannot reuse B''s payment client_id',
  pg_temp.refusal(format('select public.add_trip_settlement(%L, %L, 100, null, %L)', pg_temp.id('s'),
    'e9500000-0000-4000-8000-000000000001', pg_temp.id('k2'))), 'duplicate_request');
select pg_temp.as_user('e9500000-0000-4000-8000-000000000004');
select pg_temp.expect('an outsider with B''s client_id is not a member',
  pg_temp.refusal(format('select public.add_trip_settlement(%L, %L, 100, null, %L)', pg_temp.id('s'),
    'e9500000-0000-4000-8000-000000000001', pg_temp.id('k2'))), 'not_member');

-- The receiver records it too ("Já recebi"): that one is not capped, so the client_id is what stops a double.
select pg_temp.as_user('e9500000-0000-4000-8000-000000000001');
insert into t_ids (key, id)
values ('p2', public.add_trip_settlement(pg_temp.id('s'), 'e9500000-0000-4000-8000-000000000001', 500,
  'e9500000-0000-4000-8000-000000000003', pg_temp.id('k4')));
select pg_temp.expect('the receiver''s retry gives the same payment',
  public.add_trip_settlement(pg_temp.id('s'), 'e9500000-0000-4000-8000-000000000001', 500,
    'e9500000-0000-4000-8000-000000000003', pg_temp.id('k4')), pg_temp.id('p2'));
reset role;
select pg_temp.expect('one row per payment client_id',
  pg_temp.settlements_with(pg_temp.id('k2')) || ':' || pg_temp.settlements_with(pg_temp.id('k4')), '1:1');
set local role authenticated;
select pg_temp.as_user('e9500000-0000-4000-8000-000000000001');
select pg_temp.expect('the accounts are settled once, not twice',
  (select string_agg(display_name || ':' || balance_cents, ',' order by display_name) from public.trip_balances(pg_temp.id('s'))),
  'Idem A:0,Idem B:0,Idem C:0');

reset role;
select count(*) as checks_passed from expect_log;

rollback;
