-- Dados para as capturas das lojas e o vídeo, à volta da conta capturas@teste.awayday.invalid (Tiago Fonseca).
-- Corre depois de capturas-contas.sql:  supabase db query --linked -f scripts/dados-de-teste/capturas-dados.sql
--
--   · grupo «Malta do café»: Tiago, Rui, Ana, Zé e Inês, com conversa;
--   · Braga x Sporting (9 out) — plano FECHADO, boleia do Rui de Sete Rios com 1 lugar livre, a sessão da viagem com
--     despesas e um acerto da Ana por confirmar; mais três boleias públicas (Coimbra, Leiria, Aveiro);
--   · Lens x Sporting (13 out, França) — plano EM ABERTO com duas casas propostas e votos;
--   · Famalicão x Sporting (13 set) — viagem já feita, para o histórico.
--
-- Os custos das boleias são os que a Edge Function `rides` devolveu (action: quote) a 2026-10-06, para cada origem,
-- com 6,5 L/100 km a 1,729 €/L, ida e volta: o servidor calcula, este ficheiro só os copia (regra 6).
-- Apaga tudo com capturas-apagar.sql.

begin;

alter table public.group_message disable trigger group_message_notify;
alter table public.trip_expense_share disable trigger trip_expense_share_notify;
alter table public.trip_settlement disable trigger trip_settlement_notify;
alter table public.ride_passenger disable trigger ride_passenger_notify;
alter table public.ride disable trigger ride_notify;

insert into public.fan_group (id, name, created_by, invite_code, source, chat_background)
values ('c0000000-0000-4000-8000-000000000101', 'Malta do café', 'c0000000-0000-4000-8000-000000000001', 'capturas01', 'manual', 'relvado');

insert into public.fan_group_member (group_id, profile_id, role, joined_at)
values
  ('c0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000001', 'owner', now() - interval '40 days'),
  ('c0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000002', 'member', now() - interval '40 days'),
  ('c0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000003', 'member', now() - interval '40 days'),
  ('c0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000004', 'member', now() - interval '39 days'),
  ('c0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000005', 'member', now() - interval '30 days');

-- Plan 1: Braga x Sporting. Four going, Inês maybe.
insert into public.fixture_plan (id, group_id, fixture_id, created_by, created_at)
values ('c0000000-0000-4000-8000-000000000201', 'c0000000-0000-4000-8000-000000000101', 'braga-sporting-2026-27', 'c0000000-0000-4000-8000-000000000001', now() - interval '3 days');
insert into public.fixture_plan_answer (plan_id, profile_id, answer) values
  ('c0000000-0000-4000-8000-000000000201', 'c0000000-0000-4000-8000-000000000001', 'vou'),
  ('c0000000-0000-4000-8000-000000000201', 'c0000000-0000-4000-8000-000000000002', 'vou'),
  ('c0000000-0000-4000-8000-000000000201', 'c0000000-0000-4000-8000-000000000003', 'vou'),
  ('c0000000-0000-4000-8000-000000000201', 'c0000000-0000-4000-8000-000000000004', 'vou'),
  ('c0000000-0000-4000-8000-000000000201', 'c0000000-0000-4000-8000-000000000005', 'nao');

-- Rui's car from Sete Rios (14:30 in Lisbon), group only: Tiago, Ana and Zé in, one seat left. Links itself to the plan.
insert into public.ride (id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents, total_cents,
  accepts_return_requests, group_id, visibility, origin_city, rules_accepted_at, note)
values ('c0000000-0000-4000-8000-000000000301', 'braga-sporting-2026-27', 'c0000000-0000-4000-8000-000000000002', 'Sete Rios',
  'SRID=4326;POINT(-9.1669 38.7406)', '2026-10-09 13:30:00+00', 4, 'rapida', true,
  364677, 13055, 329373, 650, 1729, 8196, 6156, 14352, true, 'c0000000-0000-4000-8000-000000000101', 'grupo', 'Lisboa',
  now() - interval '2 days', 'Encontro na saída do metro de Jardim Zoológico.');
insert into public.ride_passenger (ride_id, profile_id, status, rules_accepted_at) values
  ('c0000000-0000-4000-8000-000000000301', 'c0000000-0000-4000-8000-000000000001', 'accepted', now() - interval '2 days'),
  ('c0000000-0000-4000-8000-000000000301', 'c0000000-0000-4000-8000-000000000003', 'accepted', now() - interval '2 days'),
  ('c0000000-0000-4000-8000-000000000301', 'c0000000-0000-4000-8000-000000000004', 'accepted', now() - interval '1 day');

-- Public rides to the same game from elsewhere, so the list of cars is not just friends.
insert into public.ride (id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents, total_cents,
  accepts_return_requests, group_id, visibility, origin_city, rules_accepted_at)
values
  ('c0000000-0000-4000-8000-000000000302', 'braga-sporting-2026-27', 'c0000000-0000-4000-8000-000000000006', 'Coimbra B',
   'SRID=4326;POINT(-8.4103 40.2033)', '2026-10-09 16:00:00+00', 3, 'rapida', true,
   176091, 7119, 129613, 650, 1729, 3958, 2422, 6380, true, null, 'publica', 'Coimbra', now() - interval '1 day'),
  ('c0000000-0000-4000-8000-000000000303', 'braga-sporting-2026-27', 'c0000000-0000-4000-8000-000000000007', 'Leiria, estádio',
   'SRID=4326;POINT(-8.8071 39.7436)', '2026-10-09 15:30:00+00', 3, 'rapida', true,
   234077, 8795, 200236, 650, 1729, 5262, 3742, 9004, false, null, 'publica', 'Leiria', now() - interval '20 hours'),
  ('c0000000-0000-4000-8000-000000000304', 'braga-sporting-2026-27', 'c0000000-0000-4000-8000-000000000008', 'Aveiro, estação',
   'SRID=4326;POINT(-8.6538 40.6405)', '2026-10-09 16:30:00+00', 2, 'sem_portagens', true,
   135566, 9904, 23776, 650, 1729, 3048, 444, 3492, true, null, 'publica', 'Aveiro', now() - interval '6 hours');
insert into public.ride_passenger (ride_id, profile_id, status, rules_accepted_at) values
  ('c0000000-0000-4000-8000-000000000302', 'c0000000-0000-4000-8000-000000000005', 'accepted', now() - interval '10 hours'),
  ('c0000000-0000-4000-8000-000000000303', 'c0000000-0000-4000-8000-000000000009', 'accepted', now() - interval '15 hours'),
  ('c0000000-0000-4000-8000-000000000303', 'c0000000-0000-4000-8000-000000000010', 'accepted', now() - interval '9 hours'),
  ('c0000000-0000-4000-8000-000000000304', 'c0000000-0000-4000-8000-000000000011', 'accepted', now() - interval '4 hours');

-- Closing the plan opens the trip session (trigger), with the ride's cost inside.
update public.fixture_plan set status = 'fechado', closed_reason = 'manual', closed_at = now() - interval '1 day'
where id = 'c0000000-0000-4000-8000-000000000201';

insert into public.trip_expense (id, session_id, payer_id, description, category, cents, created_by, source, created_at)
select v.id, fp.session_id, v.pagou, v.descricao, v.categoria, v.cents, v.pagou, 'manual', now() - v.ha
from public.fixture_plan as fp
cross join (values
  ('c0000000-0000-4000-8000-000000000401'::uuid, 'c0000000-0000-4000-8000-000000000001'::uuid, 'Bilhetes para o topo', 'bilhetes', 8000, interval '20 hours'),
  ('c0000000-0000-4000-8000-000000000402'::uuid, 'c0000000-0000-4000-8000-000000000003'::uuid, 'Imperiais na roulote', 'cerveja', 1800, interval '3 hours'),
  ('c0000000-0000-4000-8000-000000000403'::uuid, 'c0000000-0000-4000-8000-000000000004'::uuid, 'Bifanas antes do jogo', 'petiscos', 1400, interval '2 hours')
) as v(id, pagou, descricao, categoria, cents, ha)
where fp.id = 'c0000000-0000-4000-8000-000000000201';

insert into public.trip_expense_share (expense_id, profile_id)
select e.id, m.profile_id
from public.trip_expense as e
join public.trip_session_member as m on m.session_id = e.session_id
where e.id in ('c0000000-0000-4000-8000-000000000401', 'c0000000-0000-4000-8000-000000000402', 'c0000000-0000-4000-8000-000000000403');

-- Ana says she paid Tiago 20 € back: waiting for him to confirm.
insert into public.trip_settlement (id, session_id, from_profile_id, to_profile_id, cents, created_by)
select 'c0000000-0000-4000-8000-000000000501', fp.session_id, 'c0000000-0000-4000-8000-000000000003',
  'c0000000-0000-4000-8000-000000000001', 2000, 'c0000000-0000-4000-8000-000000000003'
from public.fixture_plan as fp where fp.id = 'c0000000-0000-4000-8000-000000000201';

update public.trip_session as s set name = 'Braga com a malta'
from public.fixture_plan as fp
where fp.id = 'c0000000-0000-4000-8000-000000000201' and s.id = fp.session_id;

-- The car's own chat.
insert into public.ride_message (id, ride_id, profile_id, body, created_at) values
  ('c0000000-0000-4000-8000-000000000351', 'c0000000-0000-4000-8000-000000000301', 'c0000000-0000-4000-8000-000000000002', 'Saio às 14:30 da saída do metro do Zoo. Quem chegar tarde vai a pé!', now() - interval '26 hours'),
  ('c0000000-0000-4000-8000-000000000352', 'c0000000-0000-4000-8000-000000000301', 'c0000000-0000-4000-8000-000000000003', 'Levo farnel para a viagem.', now() - interval '25 hours'),
  ('c0000000-0000-4000-8000-000000000353', 'c0000000-0000-4000-8000-000000000301', 'c0000000-0000-4000-8000-000000000004', 'Eu levo o cachecol da sorte.', now() - interval '24 hours'),
  ('c0000000-0000-4000-8000-000000000354', 'c0000000-0000-4000-8000-000000000301', 'c0000000-0000-4000-8000-000000000001', 'Combinado. A boleia já está nas contas da viagem.', now() - interval '23 hours');

-- Plan 2: Lens x Sporting, in France. Open, proposed by Ana, two places to stay.
insert into public.fixture_plan (id, group_id, fixture_id, created_by, created_at)
values ('c0000000-0000-4000-8000-000000000202', 'c0000000-0000-4000-8000-000000000101', 'lens-sporting-champions-2026-27', 'c0000000-0000-4000-8000-000000000003', now() - interval '2 days');
insert into public.fixture_plan_answer (plan_id, profile_id, answer) values
  ('c0000000-0000-4000-8000-000000000202', 'c0000000-0000-4000-8000-000000000003', 'vou'),
  ('c0000000-0000-4000-8000-000000000202', 'c0000000-0000-4000-8000-000000000001', 'vou'),
  ('c0000000-0000-4000-8000-000000000202', 'c0000000-0000-4000-8000-000000000005', 'vou'),
  ('c0000000-0000-4000-8000-000000000202', 'c0000000-0000-4000-8000-000000000002', 'nao');
insert into public.stay_plan (id, fixture_id, profile_id, nights, commitment, spare_places, total_cents, note, group_id, visibility, created_at)
values
  ('c0000000-0000-4000-8000-000000000601', 'lens-sporting-champions-2026-27', 'c0000000-0000-4000-8000-000000000003', 2, 'se_houver', 3, 36000,
   'Apartamento a 15 min a pé do estádio, dois quartos e sofá-cama.', 'c0000000-0000-4000-8000-000000000101', 'grupo', now() - interval '40 hours'),
  ('c0000000-0000-4000-8000-000000000602', 'lens-sporting-champions-2026-27', 'c0000000-0000-4000-8000-000000000002', 2, 'certo', 5, 54000,
   'Casa grande em Liévin, com garagem. Fica a 10 min de carro.', 'c0000000-0000-4000-8000-000000000101', 'grupo', now() - interval '30 hours');
-- Who already has a bed: Tiago and Inês in Ana's flat, Zé in Rui's house.
insert into public.stay_place (plan_id, profile_id, status) values
  ('c0000000-0000-4000-8000-000000000601', 'c0000000-0000-4000-8000-000000000001', 'aceite'),
  ('c0000000-0000-4000-8000-000000000601', 'c0000000-0000-4000-8000-000000000005', 'aceite'),
  ('c0000000-0000-4000-8000-000000000602', 'c0000000-0000-4000-8000-000000000004', 'aceite');
insert into public.fixture_plan_house_vote (plan_id, profile_id, stay_plan_id) values
  ('c0000000-0000-4000-8000-000000000202', 'c0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000601'),
  ('c0000000-0000-4000-8000-000000000202', 'c0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000602'),
  ('c0000000-0000-4000-8000-000000000202', 'c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000602');

-- The group chat, in order.
insert into public.group_message (id, group_id, profile_id, kind, body, place_id, plan_id, created_at) values
  ('c0000000-0000-4000-8000-000000000701', 'c0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000002', 'texto', 'Malta, Braga na sexta. Quem alinha?', null, null, now() - interval '3 days 2 hours'),
  ('c0000000-0000-4000-8000-000000000702', 'c0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000001', 'plano', 'Braga x Sporting', null, 'c0000000-0000-4000-8000-000000000201', now() - interval '3 days'),
  ('c0000000-0000-4000-8000-000000000703', 'c0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000003', 'texto', 'Eu vou! Tiro o dia.', null, null, now() - interval '71 hours'),
  ('c0000000-0000-4000-8000-000000000704', 'c0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000002', 'texto', 'Levo o carro, há lugar para quatro.', null, null, now() - interval '70 hours'),
  ('c0000000-0000-4000-8000-000000000705', 'c0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000005', 'texto', 'Eu vou de Coimbra com um amigo, encontramo-nos lá.', null, null, now() - interval '50 hours'),
  ('c0000000-0000-4000-8000-000000000706', 'c0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000003', 'plano', 'Lens x Sporting', null, 'c0000000-0000-4000-8000-000000000202', now() - interval '2 days'),
  ('c0000000-0000-4000-8000-000000000707', 'c0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000003', 'texto', 'Pus duas casas em Lens, votem na que preferem!', null, null, now() - interval '40 hours'),
  ('c0000000-0000-4000-8000-000000000708', 'c0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000004', 'texto', 'Os bilhetes de Braga já estão nas contas, o Tiago pagou.', null, null, now() - interval '20 hours'),
  ('c0000000-0000-4000-8000-000000000709', 'c0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000001', 'texto', 'Sexta às 14:30 no Zoo. Não se atrasem!', null, null, now() - interval '30 minutes');

update public.fan_group set updated_at = now() where id = 'c0000000-0000-4000-8000-000000000101';

-- A trip already done, for the history: Famalicão x Sporting on 13 September.
insert into public.trip_session (id, group_id, fixture_id, opened_by, name, created_at)
values ('c0000000-0000-4000-8000-000000000801', 'c0000000-0000-4000-8000-000000000101', 'famalicao-sporting-2026-27',
  'c0000000-0000-4000-8000-000000000001', 'Famalicão com a malta', '2026-09-12 10:00:00+00');
insert into public.trip_session_member (session_id, profile_id, added_by) values
  ('c0000000-0000-4000-8000-000000000801', 'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000801', 'c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000801', 'c0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000801', 'c0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001');
insert into public.trip_expense (id, session_id, payer_id, description, category, cents, created_by, source, created_at) values
  ('c0000000-0000-4000-8000-000000000811', 'c0000000-0000-4000-8000-000000000801', 'c0000000-0000-4000-8000-000000000002', 'Jantar de vitória', 'refeicao', 8640, 'c0000000-0000-4000-8000-000000000002', 'manual', '2026-09-13 22:30:00+00'),
  ('c0000000-0000-4000-8000-000000000812', 'c0000000-0000-4000-8000-000000000801', 'c0000000-0000-4000-8000-000000000003', 'Imperiais no estádio', 'cerveja', 3200, 'c0000000-0000-4000-8000-000000000003', 'manual', '2026-09-13 19:00:00+00'),
  ('c0000000-0000-4000-8000-000000000813', 'c0000000-0000-4000-8000-000000000801', 'c0000000-0000-4000-8000-000000000001', 'Portagens', 'portagens', 2160, 'c0000000-0000-4000-8000-000000000001', 'manual', '2026-09-13 16:00:00+00');
insert into public.trip_expense_share (expense_id, profile_id)
select e.id, m.profile_id
from public.trip_expense as e
join public.trip_session_member as m on m.session_id = e.session_id
where e.session_id = 'c0000000-0000-4000-8000-000000000801';

alter table public.group_message enable trigger group_message_notify;
alter table public.trip_expense_share enable trigger trip_expense_share_notify;
alter table public.trip_settlement enable trigger trip_settlement_notify;
alter table public.ride_passenger enable trigger ride_passenger_notify;
alter table public.ride enable trigger ride_notify;

select
  (select status || ' / sessão ' || coalesce(session_id::text, 'nenhuma') || ' / boleia ' || coalesce(ride_id::text, 'nenhuma')
     from public.fixture_plan where id = 'c0000000-0000-4000-8000-000000000201') as plano_braga,
  (select count(*) from public.trip_session_member m join public.fixture_plan fp on fp.session_id = m.session_id
     where fp.id = 'c0000000-0000-4000-8000-000000000201') as pessoas_sessao,
  (select count(*) from public.trip_expense e join public.fixture_plan fp on fp.session_id = e.session_id
     where fp.id = 'c0000000-0000-4000-8000-000000000201') as despesas_sessao,
  (select count(*) from public.ride where id::text like 'c0000000-%') as boleias,
  (select count(*) from public.group_message where id::text like 'c0000000-%') as mensagens;

commit;
