-- Access tests for replies, edits and reactions in the group and car chats, the car's realtime topic and the public
-- profile opened from a chat.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_conversa_reacoes.test.sql
--
-- Group: O owns it, M is a member who blocks B, B is a member, X is an outsider.
-- Car: D drives, P has a seat, X is not in it.

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

create function pg_temp.reactions(p_key text)
returns jsonb
language sql
as $$
  select m.reactions from public.group_messages('c0000012-0000-4000-8000-0000000000a1') as m
  where m.id = pg_temp.id(p_key);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('ad000012-0000-4000-8000-0000000000a1', 'reacoes-o@test.invalid', '{"display_name":"Reacoes Dono"}', 'authenticated', 'authenticated'),
  ('ad000012-0000-4000-8000-0000000000b1', 'reacoes-m@test.invalid', '{"display_name":"Reacoes Membro"}', 'authenticated', 'authenticated'),
  ('ad000012-0000-4000-8000-0000000000c1', 'reacoes-b@test.invalid', '{"display_name":"Reacoes Bloqueado"}', 'authenticated', 'authenticated'),
  ('ad000012-0000-4000-8000-0000000000e1', 'reacoes-x@test.invalid', '{"display_name":"Reacoes Fora"}', 'authenticated', 'authenticated'),
  ('ad000012-0000-4000-8000-0000000000d1', 'reacoes-d@test.invalid', '{"display_name":"Reacoes Condutor"}', 'authenticated', 'authenticated'),
  ('ad000012-0000-4000-8000-0000000000f1', 'reacoes-p@test.invalid', '{"display_name":"Reacoes Passageiro"}', 'authenticated', 'authenticated');

insert into public.fan_group (id, name, created_by, invite_code)
values ('c0000012-0000-4000-8000-0000000000a1', 'Grupo Reacoes', 'ad000012-0000-4000-8000-0000000000a1', 'acreacoes1');
insert into public.fan_group_member (group_id, profile_id, role, joined_at)
values
  ('c0000012-0000-4000-8000-0000000000a1', 'ad000012-0000-4000-8000-0000000000a1', 'owner', now() - interval '1 day'),
  ('c0000012-0000-4000-8000-0000000000a1', 'ad000012-0000-4000-8000-0000000000b1', 'member', now() - interval '1 day'),
  ('c0000012-0000-4000-8000-0000000000a1', 'ad000012-0000-4000-8000-0000000000c1', 'member', now() - interval '1 day');
insert into public.user_block (blocker_id, blocked_id)
values ('ad000012-0000-4000-8000-0000000000b1', 'ad000012-0000-4000-8000-0000000000c1');

insert into public.profile_club (profile_id, relation, club_id)
select 'ad000012-0000-4000-8000-0000000000b1', 'supporter', c.id from public.club as c order by c.id limit 1;

-- An old message from O, past the edit window.
insert into t_ids (key, id) values ('velha', gen_random_uuid());
insert into public.group_message (id, group_id, profile_id, body, created_at)
values (pg_temp.id('velha'), 'c0000012-0000-4000-8000-0000000000a1', 'ad000012-0000-4000-8000-0000000000a1', 'Mensagem antiga',
  now() - interval '1 hour');

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. No direct access to the reaction tables.

set local role authenticated;
select pg_temp.as_user('ad000012-0000-4000-8000-0000000000b1');
select pg_temp.expect('no direct read of group reactions',
  pg_temp.refusal('select count(*) from public.group_message_reaction'), 'permission denied for table group_message_reaction');
select pg_temp.expect('no direct read of car reactions',
  pg_temp.refusal('select count(*) from public.ride_message_reaction'), 'permission denied for table ride_message_reaction');

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Replies.

select pg_temp.as_user('ad000012-0000-4000-8000-0000000000a1');
insert into t_ids (key, id) values ('m_o', public.send_group_message('c0000012-0000-4000-8000-0000000000a1', 'Quem vem?'));
select pg_temp.as_user('ad000012-0000-4000-8000-0000000000c1');
insert into t_ids (key, id) values ('m_b', public.send_group_message('c0000012-0000-4000-8000-0000000000a1', 'Do bloqueado'));
select pg_temp.as_user('ad000012-0000-4000-8000-0000000000b1');
insert into t_ids (key, id)
values ('r_m', public.send_group_message('c0000012-0000-4000-8000-0000000000a1', 'Eu vou', pg_temp.id('m_o')));
select pg_temp.expect('a reply brings the quoted name and text',
  (select (m.reply_to_id, m.reply_display_name, m.reply_body)::text
   from public.group_messages('c0000012-0000-4000-8000-0000000000a1') as m where m.id = pg_temp.id('r_m')),
  (pg_temp.id('m_o'), 'Reacoes Dono', 'Quem vem?')::text);
select pg_temp.expect('a reply to a message from another group is refused',
  pg_temp.refusal(format('select public.send_group_message(%L, %L, %L)',
    'c0000012-0000-4000-8000-0000000000a1', 'olá', gen_random_uuid())), 'bad_message');

-- O replies to B's message: M blocked B, so M sees the reply without B's text.
select pg_temp.as_user('ad000012-0000-4000-8000-0000000000a1');
insert into t_ids (key, id)
values ('r_o', public.send_group_message('c0000012-0000-4000-8000-0000000000a1', 'Boa', pg_temp.id('m_b')));
select pg_temp.as_user('ad000012-0000-4000-8000-0000000000b1');
select pg_temp.expect('a quote from someone you blocked has no text',
  (select m.reply_body from public.group_messages('c0000012-0000-4000-8000-0000000000a1') as m where m.id = pg_temp.id('r_o')),
  null::text);
select pg_temp.as_user('ad000012-0000-4000-8000-0000000000a1');
select pg_temp.expect('the others still see that quote',
  (select m.reply_body from public.group_messages('c0000012-0000-4000-8000-0000000000a1') as m where m.id = pg_temp.id('r_o')),
  'Do bloqueado');

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Edits.

select pg_temp.as_user('ad000012-0000-4000-8000-0000000000a1');
select pg_temp.expect('the author edits a recent message',
  pg_temp.refusal(format('select public.edit_group_message(%L, %L)', pg_temp.id('m_o'), '  Quem vem ao jogo?  ')), 'accepted');
select pg_temp.expect('the edit shows, marked as edited',
  (select (m.body, m.edited_at is not null)::text
   from public.group_messages('c0000012-0000-4000-8000-0000000000a1') as m where m.id = pg_temp.id('m_o')),
  ('Quem vem ao jogo?', true)::text);
select pg_temp.expect('the quote follows the edit',
  (select m.reply_body from public.group_messages('c0000012-0000-4000-8000-0000000000a1') as m where m.id = pg_temp.id('r_m')),
  'Quem vem ao jogo?');
select pg_temp.expect('no edit past the window',
  pg_temp.refusal(format('select public.edit_group_message(%L, %L)', pg_temp.id('velha'), 'Mudei')), 'not_yours');
select pg_temp.expect('no empty edit',
  pg_temp.refusal(format('select public.edit_group_message(%L, %L)', pg_temp.id('m_o'), '   ')), 'bad_message');
select pg_temp.expect('nobody edits someone else''s message, not even the owner',
  pg_temp.refusal(format('select public.edit_group_message(%L, %L)', pg_temp.id('r_m'), 'Não vou')), 'not_yours');

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Reactions.

select pg_temp.as_user('ad000012-0000-4000-8000-0000000000b1');
select pg_temp.expect('a member reacts',
  pg_temp.refusal(format('select public.react_group_message(%L, %L)', pg_temp.id('m_o'), '👍')), 'accepted');
select pg_temp.expect('only the offered emojis',
  pg_temp.refusal(format('select public.react_group_message(%L, %L)', pg_temp.id('m_o'), '💩')), 'bad_message');
select pg_temp.as_user('ad000012-0000-4000-8000-0000000000c1');
select public.react_group_message(pg_temp.id('m_o'), '👍');
select pg_temp.as_user('ad000012-0000-4000-8000-0000000000a1');
select public.react_group_message(pg_temp.id('m_o'), '⚽');
select pg_temp.expect('reactions counted, most used first, with mine',
  pg_temp.reactions('m_o'),
  '[{"emoji":"👍","count":2,"mine":false},{"emoji":"⚽","count":1,"mine":true}]'::jsonb);
select pg_temp.as_user('ad000012-0000-4000-8000-0000000000b1');
select pg_temp.expect('the blocked person''s reaction does not count for whoever blocked them',
  pg_temp.reactions('m_o'),
  '[{"emoji":"⚽","count":1,"mine":false},{"emoji":"👍","count":1,"mine":true}]'::jsonb);
select public.react_group_message(pg_temp.id('m_o'), '❤️');
select pg_temp.expect('one reaction per person: a new one replaces it',
  pg_temp.reactions('m_o'),
  '[{"emoji":"⚽","count":1,"mine":false},{"emoji":"❤️","count":1,"mine":true}]'::jsonb);
select public.react_group_message(pg_temp.id('m_o'), null);
select pg_temp.expect('null takes it away',
  pg_temp.reactions('m_o'), '[{"emoji":"⚽","count":1,"mine":false}]'::jsonb);
select pg_temp.expect('no reaction to a message you cannot see',
  pg_temp.refusal(format('select public.react_group_message(%L, %L)', pg_temp.id('m_b'), '👍')), 'not_member');

select pg_temp.as_user('ad000012-0000-4000-8000-0000000000e1');
select pg_temp.expect('an outsider cannot react',
  pg_temp.refusal(format('select public.react_group_message(%L, %L)', pg_temp.id('m_o'), '👍')), 'not_member');
select pg_temp.expect('an outsider cannot edit',
  pg_temp.refusal(format('select public.edit_group_message(%L, %L)', pg_temp.id('m_o'), 'x')), 'not_yours');

-- Deleting a message keeps its replies, without the quote.
select pg_temp.as_user('ad000012-0000-4000-8000-0000000000a1');
select public.remove_group_message(pg_temp.id('m_o'));
select pg_temp.expect('a reply outlives the message it quoted',
  (select (m.reply_to_id is null, m.reply_body is null)::text
   from public.group_messages('c0000012-0000-4000-8000-0000000000a1') as m where m.id = pg_temp.id('r_m')),
  (true, true)::text);

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Car chat.

reset role;
insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at)
select 'teste-reacoes-carro', f.competition_id, f.stage, f.home_club_id, f.away_club_id, f.venue_id, now() + interval '1 day'
from public.fixture as f order by f.id limit 1;
insert into t_ids (key, id) values ('carro', gen_random_uuid());
insert into public.ride (
  id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents,
  total_cents
)
select pg_temp.id('carro'), f.id, 'ad000012-0000-4000-8000-0000000000d1', 'Coimbra', 'SRID=4326;POINT(-8.42 40.2)',
  f.kickoff_at - interval '3 hours', 3, 'rapida', false, 100000, 3600, 20000, 600, 1700, 1200, 0, 1200
from public.fixture as f where f.id = 'teste-reacoes-carro';
insert into public.ride_passenger (ride_id, profile_id, status)
values (pg_temp.id('carro'), 'ad000012-0000-4000-8000-0000000000f1', 'accepted');

set local role authenticated;
select pg_temp.as_user('ad000012-0000-4000-8000-0000000000d1');
insert into t_ids (key, id) values ('c_d', public.send_ride_message(pg_temp.id('carro'), 'Saio às 15h'));
select pg_temp.as_user('ad000012-0000-4000-8000-0000000000f1');
insert into t_ids (key, id) values ('c_p', public.send_ride_message(pg_temp.id('carro'), 'Combinado', pg_temp.id('c_d')));
select public.react_ride_message(pg_temp.id('c_d'), '👍');
select pg_temp.expect('car: reply and reaction',
  (select (m.reply_display_name, m.reply_body)::text from public.ride_messages(pg_temp.id('carro')) as m
   where m.id = pg_temp.id('c_p')),
  ('Reacoes Condutor', 'Saio às 15h')::text);
select pg_temp.expect('car: reactions',
  (select m.reactions from public.ride_messages(pg_temp.id('carro')) as m where m.id = pg_temp.id('c_d')),
  '[{"emoji":"👍","count":1,"mine":true}]'::jsonb);
select pg_temp.expect('car: the author edits',
  pg_temp.refusal(format('select public.edit_ride_message(%L, %L)', pg_temp.id('c_p'), 'Combinadíssimo')), 'accepted');
select pg_temp.expect('car: nobody else edits',
  pg_temp.refusal(format('select public.edit_ride_message(%L, %L)', pg_temp.id('c_d'), 'Saio às 16h')), 'not_yours');
select pg_temp.expect('car: whoever is in the car uses its topic',
  public.can_use_ride_topic('ride:' || pg_temp.id('carro')::text), true);

select pg_temp.as_user('ad000012-0000-4000-8000-0000000000e1');
select pg_temp.expect('car: an outsider cannot react',
  pg_temp.refusal(format('select public.react_ride_message(%L, %L)', pg_temp.id('c_d'), '👍')), 'not_in_ride');
select pg_temp.expect('car: an outsider cannot use the topic',
  public.can_use_ride_topic('ride:' || pg_temp.id('carro')::text), false);
select pg_temp.expect('car: a malformed topic is refused', public.can_use_ride_topic('ride:nada'), false);

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Public profile.

select pg_temp.as_user('ad000012-0000-4000-8000-0000000000a1');
select pg_temp.expect('a group mate sees the public profile, with the club',
  (select (p.display_name, p.supporter_club_id is not null, p.stadiums_stamped)::text
   from public.public_profile('ad000012-0000-4000-8000-0000000000b1') as p),
  ('Reacoes Membro', true, 0)::text);
-- A stranger who does not show in the ranking (people in the ranking have their profile open to everyone).
reset role;
update public.profile set show_in_rankings = false where id = 'ad000012-0000-4000-8000-0000000000b1';
set local role authenticated;
select pg_temp.as_user('ad000012-0000-4000-8000-0000000000e1');
select pg_temp.expect('a stranger does not',
  (select count(*)::integer from public.public_profile('ad000012-0000-4000-8000-0000000000b1')), 0);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
