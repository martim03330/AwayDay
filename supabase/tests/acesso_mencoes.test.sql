-- Access tests for mentions («@Nome» and «@todos») in the group and car chats.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_mencoes.test.sql
--
-- Group: O owns it, M and N are members, X is an outsider. Car: D drives, P has a seat, X is not in it.

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
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

-- Whether the message mentions the reader.
create function pg_temp.mentions_me(p_key text)
returns boolean
language sql
as $$
  select m.mentions_me from public.group_messages('c0000013-0000-4000-8000-0000000000a1') as m
  where m.id = pg_temp.id(p_key);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('ad000013-0000-4000-8000-0000000000a1', 'mencoes-o@test.invalid', '{"display_name":"Mencoes Dono"}', 'authenticated', 'authenticated'),
  ('ad000013-0000-4000-8000-0000000000b1', 'mencoes-m@test.invalid', '{"display_name":"Mencoes Membro"}', 'authenticated', 'authenticated'),
  ('ad000013-0000-4000-8000-0000000000c1', 'mencoes-n@test.invalid', '{"display_name":"Mencoes Outro"}', 'authenticated', 'authenticated'),
  ('ad000013-0000-4000-8000-0000000000e1', 'mencoes-x@test.invalid', '{"display_name":"Mencoes Fora"}', 'authenticated', 'authenticated'),
  ('ad000013-0000-4000-8000-0000000000d1', 'mencoes-d@test.invalid', '{"display_name":"Mencoes Condutor"}', 'authenticated', 'authenticated'),
  ('ad000013-0000-4000-8000-0000000000f1', 'mencoes-p@test.invalid', '{"display_name":"Mencoes Passageiro"}', 'authenticated', 'authenticated');

insert into public.fan_group (id, name, created_by, invite_code)
values ('c0000013-0000-4000-8000-0000000000a1', 'Grupo Mencoes', 'ad000013-0000-4000-8000-0000000000a1', 'acmencoes1');
insert into public.fan_group_member (group_id, profile_id, role, joined_at)
values
  ('c0000013-0000-4000-8000-0000000000a1', 'ad000013-0000-4000-8000-0000000000a1', 'owner', now() - interval '1 day'),
  ('c0000013-0000-4000-8000-0000000000a1', 'ad000013-0000-4000-8000-0000000000b1', 'member', now() - interval '1 day'),
  ('c0000013-0000-4000-8000-0000000000a1', 'ad000013-0000-4000-8000-0000000000c1', 'member', now() - interval '1 day');

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Group: only people in the group are kept, never the author.

set local role authenticated;
select pg_temp.as_user('ad000013-0000-4000-8000-0000000000a1');
insert into t_ids (key, id) values ('m1', public.send_group_message(
  'c0000013-0000-4000-8000-0000000000a1', '@Mencoes Membro vens?', null,
  array['ad000013-0000-4000-8000-0000000000b1', 'ad000013-0000-4000-8000-0000000000e1',
        'ad000013-0000-4000-8000-0000000000a1']::uuid[]));
reset role;
select pg_temp.expect('only the group member is kept (not the outsider, not the author)',
  (select m.mentions from public.group_message as m where m.id = pg_temp.id('m1')),
  array['ad000013-0000-4000-8000-0000000000b1']::uuid[]);
set local role authenticated;

select pg_temp.as_user('ad000013-0000-4000-8000-0000000000b1');
select pg_temp.expect('the mentioned member sees it is for them', pg_temp.mentions_me('m1'), true);
select pg_temp.as_user('ad000013-0000-4000-8000-0000000000c1');
select pg_temp.expect('another member does not', pg_temp.mentions_me('m1'), false);

-- 2. «@todos».
select pg_temp.as_user('ad000013-0000-4000-8000-0000000000a1');
insert into t_ids (key, id) values ('todos', public.send_group_message(
  'c0000013-0000-4000-8000-0000000000a1', '@todos amanhã às 18h', null, null, true));
select pg_temp.as_user('ad000013-0000-4000-8000-0000000000c1');
select pg_temp.expect('@todos mentions everyone', pg_temp.mentions_me('todos'), true);
select pg_temp.expect('a message without mentions mentions nobody',
  (select m.mentions_me from public.group_messages('c0000013-0000-4000-8000-0000000000a1') as m
   where m.id = pg_temp.id('m1')), false);

-- 3. At most 10 «@todos» a day per person (the 1st was above).
reset role;
insert into public.rate_limit_hit (profile_id, bucket)
select 'ad000013-0000-4000-8000-0000000000a1', 'chat-mention-all' from generate_series(1, 9);
set local role authenticated;
select pg_temp.as_user('ad000013-0000-4000-8000-0000000000a1');
select pg_temp.expect('the 11th @todos of the day is refused',
  pg_temp.refusal(format('select public.send_group_message(%L, %L, null, null, true)',
    'c0000013-0000-4000-8000-0000000000a1', '@todos outra vez')), 'rate_limited');
select pg_temp.expect('a message without @todos still goes',
  pg_temp.refusal(format('select public.send_group_message(%L, %L)',
    'c0000013-0000-4000-8000-0000000000a1', 'olá')), 'accepted');

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Car.

reset role;
insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at)
select 'teste-mencoes-carro', f.competition_id, f.stage, f.home_club_id, f.away_club_id, f.venue_id, now() + interval '1 day'
from public.fixture as f order by f.id limit 1;
insert into t_ids (key, id) values ('carro', gen_random_uuid());
insert into public.ride (
  id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
  total_cents
)
select pg_temp.id('carro'), f.id, 'ad000013-0000-4000-8000-0000000000d1', 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)',
  f.kickoff_at - interval '3 hours', 3, 'rapida', false, 100000, 3600, 20000, 600, 1700, 1200, 0, 1200
from public.fixture as f where f.id = 'teste-mencoes-carro';
insert into public.ride_passenger (ride_id, profile_id, status)
values (pg_temp.id('carro'), 'ad000013-0000-4000-8000-0000000000f1', 'accepted');

set local role authenticated;
select pg_temp.as_user('ad000013-0000-4000-8000-0000000000d1');
insert into t_ids (key, id) values ('c1', public.send_ride_message(pg_temp.id('carro'), '@Mencoes Passageiro saio às 15h', null,
  array['ad000013-0000-4000-8000-0000000000f1', 'ad000013-0000-4000-8000-0000000000e1']::uuid[]));
select pg_temp.as_user('ad000013-0000-4000-8000-0000000000f1');
select pg_temp.expect('car: the passenger is mentioned',
  (select m.mentions_me from public.ride_messages(pg_temp.id('carro')) as m where m.id = pg_temp.id('c1')), true);
reset role;
select pg_temp.expect('car: someone outside the car is dropped',
  (select m.mentions from public.ride_message as m where m.id = pg_temp.id('c1')),
  array['ad000013-0000-4000-8000-0000000000f1']::uuid[]);

select count(*) as checks_passed from expect_log;

rollback;
