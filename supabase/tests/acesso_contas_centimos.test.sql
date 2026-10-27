-- Tests for the leftover cents of a split expense in trip_balances: totals exact to the cent, nobody more than one
-- cent away from an equal share, and the extra cents spread across expenses instead of always landing on the same
-- person (the order is md5(expense id || profile id), fixed per expense; the app mirrors it in src/lib/acerto.ts).
--
-- People: R (Rui), T (Tiago), and six more friends, all in one group with shared accounts for a game.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_contas_centimos.test.sql

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

-- A game of our own.
create function pg_temp.make_fixture(p_id text, p_kickoff timestamptz)
returns void
language sql
as $$
  insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at)
  select p_id, f.competition_id, f.stage, f.home_club_id, f.away_club_id, v.id, p_kickoff
  from public.fixture as f
  cross join lateral (
    select v.id from public.venue as v
    where v.location is not null and v.country = 'Portugal'
    order by v.id limit 1
  ) as v
  order by f.id
  limit 1;
$$;

-- Who should get the extra cents of one expense under the rule: the first `cents % n` people by
-- md5(expense id || profile id), compared byte by byte. Reads the tables directly, so it runs as postgres.
create function pg_temp.expected_owed(p_session uuid)
returns text
language sql
as $$
  with partes as (
    select sh.profile_id,
      e.cents / count(*) over (partition by e.id)
        + case when row_number() over (
              partition by e.id order by md5(e.id::text || sh.profile_id::text) collate "C", sh.profile_id
            ) <= e.cents % count(*) over (partition by e.id) then 1 else 0 end as parte
    from public.trip_expense as e
    join public.trip_expense_share as sh on sh.expense_id = e.id
    where e.session_id = p_session
  )
  select string_agg(pr.display_name || ':' || t.total, ',' order by pr.display_name)
  from (select profile_id, sum(parte)::integer as total from partes group by profile_id) as t
  join public.profile as pr on pr.id = t.profile_id;
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
select
  ('ec100000-0000-4000-8000-00000000000' || n)::uuid,
  'centimos-' || n || '@test.invalid',
  json_build_object('display_name', 'Centimos ' || n)::jsonb,
  'authenticated',
  'authenticated'
from generate_series(1, 8) as n;

insert into public.fan_group (id, name, created_by, invite_code)
values ('ec100000-0000-4000-8000-0000000000a1', 'Grupo Centimos', 'ec100000-0000-4000-8000-000000000001', 'tcentimo01');
insert into public.fan_group_member (group_id, profile_id, role)
select 'ec100000-0000-4000-8000-0000000000a1', ('ec100000-0000-4000-8000-00000000000' || n)::uuid,
  case when n = 1 then 'owner' else 'member' end
from generate_series(1, 8) as n;

select pg_temp.make_fixture('teste-acesso-centimos', now() + interval '1 day');

set local role authenticated;
select pg_temp.as_user('ec100000-0000-4000-8000-000000000001');
insert into t_ids (key, id) values ('s', public.open_trip_session('ec100000-0000-4000-8000-0000000000a1', 'teste-acesso-centimos'));
select pg_temp.expect('the whole group is in the accounts',
  (select count(*)::integer from public.trip_people(pg_temp.id('s'))), 8);

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. The test round: Rui (1) pays a ride of 136,30 € for four, then «Imperiais» of 10,01 € for all eight.

insert into t_ids (key, id) values ('boleia', public.add_trip_expense(pg_temp.id('s'), 'Boleia', 'outro', 13630, null,
  array['ec100000-0000-4000-8000-000000000001', 'ec100000-0000-4000-8000-000000000002',
        'ec100000-0000-4000-8000-000000000003', 'ec100000-0000-4000-8000-000000000004']::uuid[]));
insert into t_ids (key, id) values ('imperiais', public.add_trip_expense(pg_temp.id('s'), 'Imperiais', 'cerveja', 1001));

select pg_temp.expect('what is owed adds up to what was spent, to the cent',
  (select sum(owed_cents)::integer || '/' || sum(paid_cents)::integer from public.trip_balances(pg_temp.id('s'))), '14631/14631');
select pg_temp.expect('the balances add up to zero',
  (select sum(balance_cents)::integer from public.trip_balances(pg_temp.id('s'))), 0);
select pg_temp.expect('in the car, two owe 34,08 € and two 34,07 € of the ride (plus 1,25 € or 1,26 € of beer)',
  (select string_agg(owed_cents::text, ',' order by owed_cents) from public.trip_balances(pg_temp.id('s'))
   where profile_id in ('ec100000-0000-4000-8000-000000000001', 'ec100000-0000-4000-8000-000000000002',
                        'ec100000-0000-4000-8000-000000000003', 'ec100000-0000-4000-8000-000000000004')) in (
    '3532,3532,3533,3533', '3532,3533,3533,3533', '3532,3532,3533,3534'),
  true);
select pg_temp.expect('outside the car, each owes 1,25 € of beer, and one of the eight 1,26 €',
  (select count(*)::integer from public.trip_balances(pg_temp.id('s')) where owed_cents in (125, 126)), 4);

-- Back to postgres to read the tables; the claims stay those of Rui (1), a member, for trip_balances.
reset role;
select pg_temp.expect('the ride is shared by four, the beers by all eight',
  (select count(*) filter (where sh.expense_id = pg_temp.id('boleia')) || '/' || count(*) filter (where sh.expense_id = pg_temp.id('imperiais'))
   from public.trip_expense_share as sh where sh.expense_id in (pg_temp.id('boleia'), pg_temp.id('imperiais'))),
  '4/8');
select pg_temp.expect('who owes what is the md5 rule, cent by cent',
  pg_temp.expected_owed(pg_temp.id('s')),
  (select string_agg(b.display_name || ':' || b.owed_cents, ',' order by b.display_name)
   from public.trip_balances(pg_temp.id('s')) as b
   where b.owed_cents > 0));

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Forty rounds of 10,01 € for eight: one extra cent each. With the old order (by profile id) all forty went to the
-- same person; now they spread out. Paid by different people, to stay under the daily limit of who adds expenses.

set local role authenticated;
do $$
declare
  ronda integer;
begin
  for ronda in 1..40 loop
    perform set_config('request.jwt.claims', json_build_object('sub',
      'ec100000-0000-4000-8000-00000000000' || (1 + ronda % 8), 'role', 'authenticated', 'aal', 'aal2')::text, true);
    perform public.add_trip_expense(pg_temp.id('s'), 'Rodada ' || ronda, 'cerveja', 1001);
  end loop;
end;
$$;

select pg_temp.as_user('ec100000-0000-4000-8000-000000000001');
select pg_temp.expect('after the rounds, still exact to the cent',
  (select sum(owed_cents)::integer || '/' || sum(paid_cents)::integer || '/' || sum(balance_cents)::integer
   from public.trip_balances(pg_temp.id('s'))),
  (14631 + 40 * 1001) || '/' || (14631 + 40 * 1001) || '/0');

reset role;
-- The extra cents from the rounds alone (claims still Rui's), per person: what they owe of the rounds minus 40 × 1,25 €.
create temporary table t_extras on commit drop as
select sh.profile_id, (count(*) filter (where parte = 126))::integer as extras
from (
  select sh.profile_id, e.id,
    e.cents / 8 + case when row_number() over (
      partition by e.id order by md5(e.id::text || sh.profile_id::text) collate "C", sh.profile_id) <= e.cents % 8
      then 1 else 0 end as parte
  from public.trip_expense as e
  join public.trip_expense_share as sh on sh.expense_id = e.id
  where e.session_id = pg_temp.id('s') and e.description like 'Rodada %'
) as sh
group by sh.profile_id;

select pg_temp.expect('each round hands out exactly one extra cent', (select sum(extras)::integer from t_extras), 40);
select pg_temp.expect('the extra cents land on at least four different people',
  (select count(*)::integer from t_extras where extras > 0) >= 4, true);
select pg_temp.expect('nobody gets anywhere near all of them',
  (select max(extras) from t_extras) <= 20, true);
select pg_temp.expect('the server''s balances follow the same rule',
  pg_temp.expected_owed(pg_temp.id('s')),
  (select string_agg(b.display_name || ':' || b.owed_cents, ',' order by b.display_name)
   from public.trip_balances(pg_temp.id('s')) as b
   where b.owed_cents > 0));
select pg_temp.expect('nobody owes more than one cent per expense above an equal share',
  (select count(*)::integer
   from (
     select sh.profile_id, sum(e.cents / x.n)::integer as base, count(*)::integer as despesas
     from public.trip_expense as e
     join public.trip_expense_share as sh on sh.expense_id = e.id
     cross join lateral (select count(*)::integer as n from public.trip_expense_share where expense_id = e.id) as x
     where e.session_id = pg_temp.id('s')
     group by sh.profile_id
   ) as esperado
   join (
     select b.profile_id, b.owed_cents
     from public.trip_balances(pg_temp.id('s')) as b
   ) as servidor on servidor.profile_id = esperado.profile_id
   where servidor.owed_cents < esperado.base or servidor.owed_cents > esperado.base + esperado.despesas),
  0);

select count(*) as checks_passed from expect_log;

rollback;
