-- Access tests for the car chat: ride_message, ride_message_read.
--
-- People: D drives; P and B have seats (P blocks B); Q only asked for a seat; L left; O is an outsider; ADM is an admin.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_boleia_conversa.test.sql

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

-- Tries select, insert, update and delete on a table with the current role, and says what got through.
-- 'denied' = no privilege on the table; 'rls' = blocked by row level security; 'allowed' = it ran.
create function pg_temp.direct_access(p_table text)
returns text
language plpgsql
as $$
declare
  coluna text;
  resultado text := '';
  operacao text;
  comando text;
  estado text;
begin
  select a.attname into coluna
  from pg_catalog.pg_attribute as a
  where a.attrelid = ('public.' || p_table)::regclass and a.attnum = 1;
  foreach operacao in array array['select', 'insert', 'update', 'delete'] loop
    comando := case operacao
      when 'select' then format('select count(*) from public.%I', p_table)
      when 'insert' then format('insert into public.%I default values', p_table)
      when 'update' then format('update public.%I set %I = %I', p_table, coluna, coluna)
      else format('delete from public.%I', p_table)
    end;
    begin
      execute comando;
      estado := 'allowed';
    exception when others then
      estado := case
        when sqlerrm like 'permission denied%' then 'denied'
        when sqlerrm like '%row-level security%' then 'rls'
        else 'allowed'
      end;
    end;
    resultado := resultado || operacao || ':' || estado || ' ';
  end loop;
  return btrim(resultado);
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

create function pg_temp.as_anon()
returns void
language sql
as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;

-- A game of our own, so the board only has the rides made here.
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

-- A ride as the rides edge function writes it: total = fuel + tolls, worked out on the server.
create function pg_temp.make_ride(
  p_id uuid, p_fixture text, p_driver uuid, p_seats integer, p_fuel integer, p_tolls integer,
  p_round boolean default false, p_group uuid default null, p_visibility text default 'publica'
)
returns void
language sql
as $$
  insert into public.ride (
    id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
    distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
    total_cents, group_id, visibility
  )
  select p_id, f.id, p_driver, 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)', f.kickoff_at - interval '3 hours',
    p_seats, 'rapida', p_round, 100000, 3600, 20000, 600, 1700, p_fuel, p_tolls, p_fuel + p_tolls, p_group,
    p_visibility
  from public.fixture as f
  where f.id = p_fixture;
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('e2000000-0000-4000-8000-000000000001', 'carro-d@test.invalid', '{"display_name":"Carro D"}', 'authenticated', 'authenticated'),
  ('e2000000-0000-4000-8000-000000000002', 'carro-p@test.invalid', '{"display_name":"Carro P"}', 'authenticated', 'authenticated'),
  ('e2000000-0000-4000-8000-000000000003', 'carro-b@test.invalid', '{"display_name":"Carro B"}', 'authenticated', 'authenticated'),
  ('e2000000-0000-4000-8000-000000000004', 'carro-q@test.invalid', '{"display_name":"Carro Q"}', 'authenticated', 'authenticated'),
  ('e2000000-0000-4000-8000-000000000005', 'carro-o@test.invalid', '{"display_name":"Carro O"}', 'authenticated', 'authenticated'),
  ('e2000000-0000-4000-8000-000000000006', 'carro-adm@test.invalid', '{"display_name":"Carro Adm"}', 'authenticated', 'authenticated'),
  ('e2000000-0000-4000-8000-000000000007', 'carro-l@test.invalid', '{"display_name":"Carro L"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'e2000000-0000-4000-8000-000000000006';

select pg_temp.make_fixture('teste-acesso-carro', now() + interval '1 day');
select pg_temp.make_fixture('teste-acesso-carro-antigo', now() - interval '3 days');
insert into t_ids (key, id) values
  ('r', gen_random_uuid()), ('antigo', gen_random_uuid()), ('m_d', gen_random_uuid()), ('m_b', gen_random_uuid());

-- D drives; P and B have seats, Q only asked, L left. The old ride's game was three days ago.
select pg_temp.make_ride(pg_temp.id('r'), 'teste-acesso-carro', 'e2000000-0000-4000-8000-000000000001', 4, 1200, 0);
select pg_temp.make_ride(pg_temp.id('antigo'), 'teste-acesso-carro-antigo', 'e2000000-0000-4000-8000-000000000001', 4, 1200, 0);
insert into public.ride_passenger (ride_id, profile_id, status)
values
  (pg_temp.id('r'), 'e2000000-0000-4000-8000-000000000002', 'accepted'),
  (pg_temp.id('r'), 'e2000000-0000-4000-8000-000000000003', 'accepted'),
  (pg_temp.id('r'), 'e2000000-0000-4000-8000-000000000004', 'requested'),
  (pg_temp.id('r'), 'e2000000-0000-4000-8000-000000000007', 'left'),
  (pg_temp.id('antigo'), 'e2000000-0000-4000-8000-000000000002', 'accepted');
insert into public.ride_message (id, ride_id, profile_id, body, created_at)
values (pg_temp.id('m_d'), pg_temp.id('r'), 'e2000000-0000-4000-8000-000000000001', 'Saio às 15h', now() - interval '3 minutes');

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. No direct access to the car chat tables, for anybody.

set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon: no direct access to ride_message', pg_temp.direct_access('ride_message'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon: no direct access to ride_message_read', pg_temp.direct_access('ride_message_read'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('anon cannot read a car chat',
  pg_temp.refusal(format('select * from public.ride_messages(%L)', pg_temp.id('r'))), 'permission denied for function ride_messages');
select pg_temp.expect('anon cannot write in a car chat',
  pg_temp.refusal(format('select public.send_ride_message(%L, %L)', pg_temp.id('r'), 'olá')),
  'permission denied for function send_ride_message');
select pg_temp.expect('anon has no chat list',
  pg_temp.refusal('select * from public.my_ride_chats()'), 'permission denied for function my_ride_chats');

set local role authenticated;
select pg_temp.as_user('e2000000-0000-4000-8000-000000000001');
select pg_temp.expect('driver: no direct access to ride_message', pg_temp.direct_access('ride_message'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.expect('driver: no direct access to ride_message_read', pg_temp.direct_access('ride_message_read'),
  'select:denied insert:denied update:denied delete:denied');
select pg_temp.as_user('e2000000-0000-4000-8000-000000000006');
select pg_temp.expect('admin: no direct access to ride_message', pg_temp.direct_access('ride_message'),
  'select:denied insert:denied update:denied delete:denied');

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Only the driver and accepted passengers read and write.

select pg_temp.as_user('e2000000-0000-4000-8000-000000000005');
select pg_temp.expect('outsider reads nothing', (select count(*)::integer from public.ride_messages(pg_temp.id('r'))), 0);
select pg_temp.expect('outsider cannot write',
  pg_temp.refusal(format('select public.send_ride_message(%L, %L)', pg_temp.id('r'), 'olá')), 'not_in_ride');
select pg_temp.expect('outsider cannot mark as read',
  pg_temp.refusal(format('select public.mark_ride_messages_read(%L)', pg_temp.id('r'))), 'not_in_ride');
select pg_temp.expect('outsider has the car in no chat list',
  (select count(*)::integer from public.my_ride_chats() where ride_id = pg_temp.id('r')), 0);
select pg_temp.expect('outsider cannot remove a message',
  pg_temp.refusal(format('select public.remove_ride_message(%L)', pg_temp.id('m_d'))), 'not_yours');

select pg_temp.as_user('e2000000-0000-4000-8000-000000000004');
select pg_temp.expect('someone who only asked reads nothing',
  (select count(*)::integer from public.ride_messages(pg_temp.id('r'))), 0);
select pg_temp.expect('someone who only asked cannot write',
  pg_temp.refusal(format('select public.send_ride_message(%L, %L)', pg_temp.id('r'), 'olá')), 'not_in_ride');

select pg_temp.as_user('e2000000-0000-4000-8000-000000000007');
select pg_temp.expect('someone who left reads nothing',
  (select count(*)::integer from public.ride_messages(pg_temp.id('r'))), 0);
select pg_temp.expect('someone who left cannot write',
  pg_temp.refusal(format('select public.send_ride_message(%L, %L)', pg_temp.id('r'), 'olá')), 'not_in_ride');

select pg_temp.as_user('e2000000-0000-4000-8000-000000000006');
select pg_temp.expect('admin reads nothing (moderation goes through reports)',
  (select count(*)::integer from public.ride_messages(pg_temp.id('r'))), 0);
select pg_temp.expect('admin cannot write in a car they are not in',
  pg_temp.refusal(format('select public.send_ride_message(%L, %L)', pg_temp.id('r'), 'olá')), 'not_in_ride');

select pg_temp.as_user('e2000000-0000-4000-8000-000000000002');
select pg_temp.expect('empty message refused',
  pg_temp.refusal(format('select public.send_ride_message(%L, %L)', pg_temp.id('r'), '   ')), 'bad_message');
select pg_temp.expect('message over 500 refused',
  pg_temp.refusal(format('select public.send_ride_message(%L, %L)', pg_temp.id('r'), repeat('a', 501))), 'bad_message');
select pg_temp.expect('a passenger writes',
  pg_temp.refusal(format('select public.send_ride_message(%L, %L)', pg_temp.id('r'), '  Vou de cachecol  ')), 'accepted');
select pg_temp.expect('the chat of an old game is closed',
  pg_temp.refusal(format('select public.send_ride_message(%L, %L)', pg_temp.id('antigo'), 'olá')), 'chat_closed');

reset role;
-- B's message is the newest one.
insert into public.ride_message (id, ride_id, profile_id, body, created_at)
values (pg_temp.id('m_b'), pg_temp.id('r'), 'e2000000-0000-4000-8000-000000000003', 'Mensagem do B', now() + interval '1 second');
set local role authenticated;

select pg_temp.as_user('e2000000-0000-4000-8000-000000000002');
select pg_temp.expect('the passenger reads the whole car, trimmed',
  (select string_agg(body, ',' order by created_at) from public.ride_messages(pg_temp.id('r'))),
  'Saio às 15h,Vou de cachecol,Mensagem do B');
select pg_temp.expect('a passenger can only remove their own messages',
  (select string_agg(display_name || ':' || can_remove, ',' order by created_at) from public.ride_messages(pg_temp.id('r'))),
  'Carro D:false,Carro P:true,Carro B:false');
select pg_temp.expect('a passenger cannot remove the driver''s message',
  pg_temp.refusal(format('select public.remove_ride_message(%L)', pg_temp.id('m_d'))), 'not_yours');
select pg_temp.expect('the passenger''s chat list shows the newest message and the unread count',
  (select last_body || ':' || unread from public.my_ride_chats() where ride_id = pg_temp.id('r')), 'Mensagem do B:2');
select public.mark_ride_messages_read(pg_temp.id('r'));
select pg_temp.expect('marking as read clears what came before',
  (select unread from public.my_ride_chats() where ride_id = pg_temp.id('r')), 1);

select pg_temp.as_user('e2000000-0000-4000-8000-000000000001');
select pg_temp.expect('the driver can remove any message in their car',
  (select bool_and(can_remove) from public.ride_messages(pg_temp.id('r'))), true);
select pg_temp.expect('the driver''s chat list',
  (select count(*)::integer from public.my_ride_chats() where ride_id = pg_temp.id('r')), 1);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Blocking hides the blocked person's car messages from the one who blocked, and only from them.

select pg_temp.as_user('e2000000-0000-4000-8000-000000000002');
select public.block_user('e2000000-0000-4000-8000-000000000003');
select pg_temp.expect('the blocker no longer sees B in the car chat',
  (select string_agg(body, ',' order by created_at) from public.ride_messages(pg_temp.id('r'))), 'Saio às 15h,Vou de cachecol');
select pg_temp.expect('nor in the chat list or unread count',
  (select last_body || ':' || unread from public.my_ride_chats() where ride_id = pg_temp.id('r')), 'Vou de cachecol:0');
select pg_temp.expect('the blocker can still report B''s message',
  pg_temp.refusal(format('select public.report_content(%L, %L, %L)', 'ride_message', pg_temp.id('m_b'), 'ofensivo')), 'accepted');

select pg_temp.as_user('e2000000-0000-4000-8000-000000000003');
select pg_temp.expect('B still sees everything and is not told',
  (select count(*)::integer from public.ride_messages(pg_temp.id('r'))), 3);
select pg_temp.expect('B can still write in the car',
  pg_temp.refusal(format('select public.send_ride_message(%L, %L)', pg_temp.id('r'), 'Já cá estou')), 'accepted');
select pg_temp.as_user('e2000000-0000-4000-8000-000000000001');
select pg_temp.expect('the driver still sees B',
  (select count(*)::integer from public.ride_messages(pg_temp.id('r'))), 4);
select pg_temp.as_user('e2000000-0000-4000-8000-000000000002');
select pg_temp.expect('B''s new message stays hidden for the blocker',
  (select count(*)::integer from public.ride_messages(pg_temp.id('r'))), 2);

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. The driver moderates the car; an admin hides for everyone.

select pg_temp.as_user('e2000000-0000-4000-8000-000000000001');
select public.remove_ride_message(pg_temp.id('m_b'));
select pg_temp.expect('the driver removed B''s message',
  (select count(*)::integer from public.ride_messages(pg_temp.id('r')) where id = pg_temp.id('m_b')), 0);
select pg_temp.as_user('e2000000-0000-4000-8000-000000000003');
select pg_temp.expect('removed for B too',
  (select count(*)::integer from public.ride_messages(pg_temp.id('r')) where id = pg_temp.id('m_b')), 0);

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Leaving the car closes the chat for that person.

select pg_temp.as_user('e2000000-0000-4000-8000-000000000003');
select public.leave_ride(pg_temp.id('r'));
select pg_temp.expect('after leaving, the chat is gone',
  (select count(*)::integer from public.ride_messages(pg_temp.id('r'))), 0);
select pg_temp.expect('after leaving, no writing',
  pg_temp.refusal(format('select public.send_ride_message(%L, %L)', pg_temp.id('r'), 'olá')), 'not_in_ride');
select pg_temp.expect('after leaving, the car is out of the chat list',
  (select count(*)::integer from public.my_ride_chats() where ride_id = pg_temp.id('r')), 0);

reset role;
select pg_temp.expect('the read marks are per person',
  (select count(*)::integer from public.ride_message_read where ride_id = pg_temp.id('r')), 1);

select count(*) as checks_passed from expect_log;

rollback;
