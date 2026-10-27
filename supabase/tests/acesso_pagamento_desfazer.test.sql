-- Tests for taking a payment back (remove_trip_settlement): the payer can always; the receiver only within 10 minutes
-- of confirming; nobody else; and trip_settlements tells the receiver until when.
--
-- People: R (Rui, receives), T (Tiago, pays), A (Ana, in the group but not in the payment).
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_pagamento_desfazer.test.sql

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

-- The error a call raises, or 'ok'.
create function pg_temp.remove_error(p_settlement uuid)
returns text
language plpgsql
as $$
begin
  perform public.remove_trip_settlement(p_settlement);
  return 'ok';
exception when others then
  return sqlerrm;
end;
$$;

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

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('ed100000-0000-4000-8000-000000000001', 'desfazer-r@test.invalid', '{"display_name":"Rui"}', 'authenticated', 'authenticated'),
  ('ed100000-0000-4000-8000-000000000002', 'desfazer-t@test.invalid', '{"display_name":"Tiago"}', 'authenticated', 'authenticated'),
  ('ed100000-0000-4000-8000-000000000003', 'desfazer-a@test.invalid', '{"display_name":"Ana"}', 'authenticated', 'authenticated');

insert into public.fan_group (id, name, created_by, invite_code)
values ('ed100000-0000-4000-8000-0000000000a1', 'Grupo Desfazer', 'ed100000-0000-4000-8000-000000000001', 'tdesfaz001');
insert into public.fan_group_member (group_id, profile_id, role)
values
  ('ed100000-0000-4000-8000-0000000000a1', 'ed100000-0000-4000-8000-000000000001', 'owner'),
  ('ed100000-0000-4000-8000-0000000000a1', 'ed100000-0000-4000-8000-000000000002', 'member'),
  ('ed100000-0000-4000-8000-0000000000a1', 'ed100000-0000-4000-8000-000000000003', 'member');

select pg_temp.make_fixture('teste-acesso-desfazer', now() + interval '1 day');

set local role authenticated;
select pg_temp.as_user('ed100000-0000-4000-8000-000000000001');
insert into t_ids (key, id) values ('s', public.open_trip_session('ed100000-0000-4000-8000-0000000000a1', 'teste-acesso-desfazer'));
insert into t_ids (key, id) values ('jantar', public.add_trip_expense(pg_temp.id('s'), 'Jantar', 'refeicao', 3000));

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Rui says Tiago paid him (confirmed at once). Within 10 minutes Rui can take it back.

insert into t_ids (key, id) values ('p1', public.add_trip_settlement(pg_temp.id('s'),
  'ed100000-0000-4000-8000-000000000001', 1000, 'ed100000-0000-4000-8000-000000000002'));
select pg_temp.expect('the receiver sees until when he can undo',
  (select receiver_undo_until is not null and receiver_undo_until > now()
   from public.trip_settlements(pg_temp.id('s')) where id = pg_temp.id('p1')), true);

select pg_temp.as_user('ed100000-0000-4000-8000-000000000002');
select pg_temp.expect('the payer has no receiver deadline',
  (select receiver_undo_until from public.trip_settlements(pg_temp.id('s')) where id = pg_temp.id('p1')),
  null::timestamptz);

select pg_temp.as_user('ed100000-0000-4000-8000-000000000003');
select pg_temp.expect('someone else in the group cannot undo it',
  pg_temp.remove_error(pg_temp.id('p1')), 'not_yours');

select pg_temp.as_user('ed100000-0000-4000-8000-000000000001');
select pg_temp.expect('the receiver undoes his own confirmation within 10 minutes',
  pg_temp.remove_error(pg_temp.id('p1')), 'ok');
select pg_temp.expect('and it is gone',
  (select count(*)::integer from public.trip_settlements(pg_temp.id('s')) where id = pg_temp.id('p1')), 0);

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. After 10 minutes the receiver can no longer take it back; the payer still can.

insert into t_ids (key, id) values ('p2', public.add_trip_settlement(pg_temp.id('s'),
  'ed100000-0000-4000-8000-000000000001', 1000, 'ed100000-0000-4000-8000-000000000002'));
reset role;
update public.trip_settlement set confirmed_at = now() - interval '11 minutes' where id = pg_temp.id('p2');
set local role authenticated;

select pg_temp.as_user('ed100000-0000-4000-8000-000000000001');
select pg_temp.expect('past the window the receiver sees a deadline already gone',
  (select receiver_undo_until < now() from public.trip_settlements(pg_temp.id('s')) where id = pg_temp.id('p2')),
  true);
select pg_temp.expect('past the window the receiver cannot undo',
  pg_temp.remove_error(pg_temp.id('p2')), 'confirmed_settlement');

select pg_temp.as_user('ed100000-0000-4000-8000-000000000002');
select pg_temp.expect('the payer can still undo it',
  pg_temp.remove_error(pg_temp.id('p2')), 'ok');

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. A pending payment (Tiago says he paid) stays removable by both, as before.

insert into t_ids (key, id) values ('p3', public.add_trip_settlement(pg_temp.id('s'),
  'ed100000-0000-4000-8000-000000000001', 1000));
select pg_temp.expect('a pending payment has no receiver deadline',
  (select receiver_undo_until from public.trip_settlements(pg_temp.id('s')) where id = pg_temp.id('p3')),
  null::timestamptz);
select pg_temp.as_user('ed100000-0000-4000-8000-000000000001');
select pg_temp.expect('the receiver can remove a pending payment',
  pg_temp.remove_error(pg_temp.id('p3')), 'ok');

select count(*) as checks_passed from expect_log;

rollback;
