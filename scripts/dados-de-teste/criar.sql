-- Dados de teste para a Malta, os planos, a sessão e as despesas.
--
-- Cria, à volta da conta martim565@gmail.com:
--   · quatro contas de teste (Rui, Ana, Zé e Inês, todas «(teste)», emails @teste.awayday.invalid, sem password);
--   · o grupo «Malta do café (teste)» com conversa, um «estou aqui» e três planos:
--       1. Sporting x Arouca (amanhã) — FECHADO, com boleia do Rui e a sessão da viagem já aberta, com despesas;
--       2. Porto x Benfica (dia 20) — EM ABERTO, criado por ti, boleia do Zé com lugares por encher;
--       3. Lens x Sporting (França) — EM ABERTO, com duas casas propostas e preferências;
--   · o grupo «Primos da bola (teste)», para experimentar «mandar a outro grupo».
--
-- Corre tudo (com o histórico e as fotos) com:  sh scripts/dados-de-teste/criar.sh
-- Apaga tudo com:  sh scripts/dados-de-teste/apagar.sh
--
-- Tudo tem ids fixos (a0000000-…), para o apagar ser exato. Os avisos push ficam desligados enquanto isto corre, para
-- o teu telemóvel não receber vinte notificações de mentira.

begin;

alter table public.group_message disable trigger group_message_notify;
alter table public.trip_expense_share disable trigger trip_expense_share_notify;
alter table public.trip_settlement disable trigger trip_settlement_notify;
alter table public.ride_passenger disable trigger ride_passenger_notify;
alter table public.ride disable trigger ride_notify;

-- As pessoas. O perfil nasce sozinho do utilizador (handle_new_user).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rui@teste.awayday.invalid', '', now(), '{"display_name":"Rui (teste)"}', '{"provider":"email","providers":["email"]}', now() - interval '30 days', now()),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@teste.awayday.invalid', '', now(), '{"display_name":"Ana (teste)"}', '{"provider":"email","providers":["email"]}', now() - interval '30 days', now()),
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ze@teste.awayday.invalid', '', now(), '{"display_name":"Zé (teste)"}', '{"provider":"email","providers":["email"]}', now() - interval '30 days', now()),
  ('a0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ines@teste.awayday.invalid', '', now(), '{"display_name":"Inês (teste)"}', '{"provider":"email","providers":["email"]}', now() - interval '30 days', now());

update public.profile set home_city = 'Lisboa' where id in (
  'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003'
);

-- Os grupos. Tu és o dono dos dois.
insert into public.fan_group (id, name, created_by, invite_code, source, chat_background)
values
  ('a0000000-0000-4000-8000-000000000101', 'Malta do café (teste)', '027d9f21-4ebd-433a-8a4e-4cc035b0163e', 'testecafe1', 'manual', 'relvado'),
  ('a0000000-0000-4000-8000-000000000102', 'Primos da bola (teste)', '027d9f21-4ebd-433a-8a4e-4cc035b0163e', 'testeprim1', 'manual', 'noite');

insert into public.fan_group_member (group_id, profile_id, role, joined_at)
values
  ('a0000000-0000-4000-8000-000000000101', '027d9f21-4ebd-433a-8a4e-4cc035b0163e', 'owner', now() - interval '10 days'),
  ('a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000001', 'member', now() - interval '10 days'),
  ('a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000002', 'member', now() - interval '10 days'),
  ('a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000003', 'member', now() - interval '10 days'),
  ('a0000000-0000-4000-8000-000000000102', '027d9f21-4ebd-433a-8a4e-4cc035b0163e', 'owner', now() - interval '10 days'),
  ('a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000004', 'member', now() - interval '10 days');

-- Plano 1: Sporting x Arouca, amanhã. Vai fechar, e a sessão abre (é a véspera).
insert into public.fixture_plan (id, group_id, fixture_id, created_by, created_at)
values ('a0000000-0000-4000-8000-000000000201', 'a0000000-0000-4000-8000-000000000101', 'sporting-arouca-2026-27', '027d9f21-4ebd-433a-8a4e-4cc035b0163e', now() - interval '2 days');
insert into public.fixture_plan_answer (plan_id, profile_id, answer) values
  ('a0000000-0000-4000-8000-000000000201', '027d9f21-4ebd-433a-8a4e-4cc035b0163e', 'vou'),
  ('a0000000-0000-4000-8000-000000000201', 'a0000000-0000-4000-8000-000000000001', 'vou'),
  ('a0000000-0000-4000-8000-000000000201', 'a0000000-0000-4000-8000-000000000002', 'vou'),
  ('a0000000-0000-4000-8000-000000000201', 'a0000000-0000-4000-8000-000000000003', 'talvez');

-- A boleia do Rui para Alvalade: sai amanhã às 17:30 (Lisboa) do Rossio. Liga-se sozinha ao plano.
insert into public.ride (id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents, total_cents,
  accepts_return_requests, group_id, visibility, origin_city)
values ('a0000000-0000-4000-8000-000000000301', 'sporting-arouca-2026-27', 'a0000000-0000-4000-8000-000000000001', 'Rossio',
  'SRID=4326;POINT(-9.1394 38.7139)', '2026-09-19 16:30:00+00', 3, 'rapida', true,
  14000, 1500, 0, 650, 2000, 1800, 400, 2200, true, 'a0000000-0000-4000-8000-000000000101', 'grupo', 'Lisboa');
insert into public.ride_passenger (ride_id, profile_id, status) values
  ('a0000000-0000-4000-8000-000000000301', '027d9f21-4ebd-433a-8a4e-4cc035b0163e', 'accepted'),
  ('a0000000-0000-4000-8000-000000000301', 'a0000000-0000-4000-8000-000000000002', 'accepted');

-- Fechar o plano abre a sessão (trigger), com a despesa da boleia lá dentro.
update public.fixture_plan set status = 'fechado', closed_reason = 'manual', closed_at = now() - interval '1 hour'
where id = 'a0000000-0000-4000-8000-000000000201';

-- Despesas da sessão: as imperiais da Ana e as bifanas pagas por ti.
insert into public.trip_expense (id, session_id, payer_id, description, category, cents, created_by, source, created_at)
select v.id, fp.session_id, v.pagou, v.descricao, v.categoria, v.cents, v.pagou, 'manual', now() - v.ha
from public.fixture_plan as fp
cross join (values
  ('a0000000-0000-4000-8000-000000000401'::uuid, 'a0000000-0000-4000-8000-000000000002'::uuid, 'Imperiais antes do jogo', 'cerveja', 1800, interval '3 hours'),
  ('a0000000-0000-4000-8000-000000000402'::uuid, '027d9f21-4ebd-433a-8a4e-4cc035b0163e'::uuid, 'Bifanas na roulote', 'petiscos', 1350, interval '2 hours'),
  ('a0000000-0000-4000-8000-000000000403'::uuid, 'a0000000-0000-4000-8000-000000000001'::uuid, 'Cachecóis novos', 'outro', 2400, interval '1 hour')
) as v(id, pagou, descricao, categoria, cents, ha)
where fp.id = 'a0000000-0000-4000-8000-000000000201';

insert into public.trip_expense_share (expense_id, profile_id)
select e.id, m.profile_id
from public.trip_expense as e
join public.trip_session_member as m on m.session_id = e.session_id
where e.id in ('a0000000-0000-4000-8000-000000000401', 'a0000000-0000-4000-8000-000000000402');
-- Os cachecóis foram só para ti e para o Rui.
insert into public.trip_expense_share (expense_id, profile_id) values
  ('a0000000-0000-4000-8000-000000000403', '027d9f21-4ebd-433a-8a4e-4cc035b0163e'),
  ('a0000000-0000-4000-8000-000000000403', 'a0000000-0000-4000-8000-000000000001');

-- A Ana diz que te pagou 5 € — falta confirmares.
insert into public.trip_settlement (id, session_id, from_profile_id, to_profile_id, cents, created_by)
select 'a0000000-0000-4000-8000-000000000501', fp.session_id, 'a0000000-0000-4000-8000-000000000002',
  '027d9f21-4ebd-433a-8a4e-4cc035b0163e', 500, 'a0000000-0000-4000-8000-000000000002'
from public.fixture_plan as fp where fp.id = 'a0000000-0000-4000-8000-000000000201';

-- Plano 2: Porto x Benfica, dia 20. Em aberto, criado por ti; boleia do Zé com 4 lugares e só o Rui lá dentro.
insert into public.fixture_plan (id, group_id, fixture_id, created_by, created_at)
values ('a0000000-0000-4000-8000-000000000202', 'a0000000-0000-4000-8000-000000000101', 'porto-benfica-2026-27', '027d9f21-4ebd-433a-8a4e-4cc035b0163e', now() - interval '1 day');
insert into public.fixture_plan_answer (plan_id, profile_id, answer) values
  ('a0000000-0000-4000-8000-000000000202', '027d9f21-4ebd-433a-8a4e-4cc035b0163e', 'vou'),
  ('a0000000-0000-4000-8000-000000000202', 'a0000000-0000-4000-8000-000000000001', 'vou'),
  ('a0000000-0000-4000-8000-000000000202', 'a0000000-0000-4000-8000-000000000003', 'vou'),
  ('a0000000-0000-4000-8000-000000000202', 'a0000000-0000-4000-8000-000000000002', 'talvez');
insert into public.ride (id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents, total_cents,
  accepts_return_requests, group_id, visibility, origin_city)
values ('a0000000-0000-4000-8000-000000000302', 'porto-benfica-2026-27', 'a0000000-0000-4000-8000-000000000003', 'Sete Rios',
  'SRID=4326;POINT(-9.1669 38.7406)', '2026-09-20 15:00:00+00', 4, 'equilibrio', true,
  313000, 10800, 290000, 650, 2000, 4070, 2200, 6270, false, 'a0000000-0000-4000-8000-000000000101', 'grupo', 'Lisboa');
insert into public.ride_passenger (ride_id, profile_id, status) values
  ('a0000000-0000-4000-8000-000000000302', 'a0000000-0000-4000-8000-000000000001', 'accepted');

-- Plano 3: Lens x Sporting, em França. Em aberto, criado pela Ana, com duas casas.
insert into public.fixture_plan (id, group_id, fixture_id, created_by, created_at)
values ('a0000000-0000-4000-8000-000000000203', 'a0000000-0000-4000-8000-000000000101', 'lens-sporting-champions-2026-27', 'a0000000-0000-4000-8000-000000000002', now() - interval '20 hours');
insert into public.fixture_plan_answer (plan_id, profile_id, answer) values
  ('a0000000-0000-4000-8000-000000000203', 'a0000000-0000-4000-8000-000000000002', 'vou'),
  ('a0000000-0000-4000-8000-000000000203', 'a0000000-0000-4000-8000-000000000001', 'vou'),
  ('a0000000-0000-4000-8000-000000000203', 'a0000000-0000-4000-8000-000000000003', 'talvez');
insert into public.stay_plan (id, fixture_id, profile_id, nights, commitment, spare_places, total_cents, note, group_id, visibility, created_at)
values
  ('a0000000-0000-4000-8000-000000000601', 'lens-sporting-champions-2026-27', 'a0000000-0000-4000-8000-000000000002', 2, 'se_houver', 3, 36000,
   'Apartamento a 15 min a pé do estádio, dois quartos e sofá-cama.', 'a0000000-0000-4000-8000-000000000101', 'grupo', now() - interval '18 hours'),
  ('a0000000-0000-4000-8000-000000000602', 'lens-sporting-champions-2026-27', 'a0000000-0000-4000-8000-000000000001', 2, 'certo', 5, 54000,
   'Casa grande em Liévin, com garagem. Fica a 10 min de carro.', 'a0000000-0000-4000-8000-000000000101', 'grupo', now() - interval '12 hours');
insert into public.fixture_plan_house_vote (plan_id, profile_id, stay_plan_id) values
  ('a0000000-0000-4000-8000-000000000203', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000601'),
  ('a0000000-0000-4000-8000-000000000203', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000602'),
  ('a0000000-0000-4000-8000-000000000203', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000602');

-- A conversa, por ordem.
insert into public.group_message (id, group_id, profile_id, kind, body, place_id, plan_id, created_at) values
  ('a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000001', 'texto', 'Então malta, quem alinha no Sporting amanhã?', null, null, now() - interval '2 days 1 hour'),
  ('a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000101', '027d9f21-4ebd-433a-8a4e-4cc035b0163e', 'plano', 'Sporting x Arouca', null, 'a0000000-0000-4000-8000-000000000201', now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000703', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000002', 'texto', 'Eu vou! Levo o cachecol da sorte.', null, null, now() - interval '47 hours'),
  ('a0000000-0000-4000-8000-000000000704', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000003', 'texto', 'Estou a pensar, depende do trabalho…', null, null, now() - interval '46 hours'),
  ('a0000000-0000-4000-8000-000000000705', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000001', 'texto', 'Levo o carro. Saio do Rossio às 17:30, sejam pontuais!', null, null, now() - interval '40 hours'),
  ('a0000000-0000-4000-8000-000000000706', 'a0000000-0000-4000-8000-000000000101', '027d9f21-4ebd-433a-8a4e-4cc035b0163e', 'plano', 'Porto x Benfica', null, 'a0000000-0000-4000-8000-000000000202', now() - interval '1 day'),
  ('a0000000-0000-4000-8000-000000000707', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000003', 'texto', 'Para o Dragão levo eu o carro, ainda há lugares.', null, null, now() - interval '23 hours'),
  ('a0000000-0000-4000-8000-000000000708', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000002', 'plano', 'Lens x Sporting', null, 'a0000000-0000-4000-8000-000000000203', now() - interval '20 hours'),
  ('a0000000-0000-4000-8000-000000000709', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000002', 'texto', 'Pus duas casas no plano de Lens, digam qual preferem!', null, null, now() - interval '12 hours'),
  ('a0000000-0000-4000-8000-000000000710', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000002', 'local', 'no Café Lelena', 'cafe-lelena-9862', null, now() - interval '40 minutes'),
  ('a0000000-0000-4000-8000-000000000711', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000001', 'texto', 'Já vou a caminho, guardem-me uma imperial.', null, null, now() - interval '25 minutes'),
  ('a0000000-0000-4000-8000-000000000712', 'a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000004', 'texto', 'Primo, quando é que vamos juntos a um jogo?', null, null, now() - interval '3 hours');

update public.fan_group set updated_at = now()
where id in ('a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000102');

alter table public.group_message enable trigger group_message_notify;
alter table public.trip_expense_share enable trigger trip_expense_share_notify;
alter table public.trip_settlement enable trigger trip_settlement_notify;
alter table public.ride_passenger enable trigger ride_passenger_notify;
alter table public.ride enable trigger ride_notify;

-- O que ficou, para confirmar.
select
  (select count(*) from public.profile where id::text like 'a0000000-%') as pessoas,
  (select count(*) from public.group_message where id::text like 'a0000000-%') as mensagens,
  (select status || ' / sessão ' || coalesce(session_id::text, 'nenhuma') from public.fixture_plan where id = 'a0000000-0000-4000-8000-000000000201') as plano_sporting,
  (select status || ' / boleia ' || coalesce(ride_id::text, 'nenhuma') from public.fixture_plan where id = 'a0000000-0000-4000-8000-000000000202') as plano_porto,
  (select coalesce(stay_plan_id::text, 'nenhuma') from public.fixture_plan where id = 'a0000000-0000-4000-8000-000000000203') as casa_lens,
  (select count(*) from public.trip_expense e join public.fixture_plan fp on fp.session_id = e.session_id where fp.id = 'a0000000-0000-4000-8000-000000000201') as despesas_sessao;

commit;
