-- Ronda de teste, fase 1 (antes do jogo): FC Porto x Estoril, sábado 31 out 2026 às 20h30, no Dragão.
-- Corre depois de ronda-contas.sql:  supabase db query --linked -f scripts/dados-de-teste/ronda-dados.sql
--
--   · grupo «Malta do Dragão (teste)», dez pessoas, com conversa;
--   · plano EM ABERTO: oito «vou», a Sofia «não vou», o Duarte ainda sem resposta;
--   · carro do Rui, de Sete Rios (Lisboa): Tiago e Ana aceites, Zé à espera de resposta, um lugar livre;
--   · carro da Inês, de Coimbra B: cheio (Bruno, Carla, Hugo), o Duarte desistiu.
--
-- Tudo só no grupo (visibility 'grupo'): nenhum utilizador real vê estas boleias. Os custos são os que a Edge Function
-- `rides` devolveu (action: quote) a 2026-10-27, 6,5 L/100 km a 2,040 €/L (gasolina 95, DGEG de 26 out), ida e volta:
-- o servidor calcula, este ficheiro só os copia (regra 6). A fase 2 (dia do jogo) está em ronda-fase2.sql.

begin;

alter table public.group_message disable trigger group_message_notify;
alter table public.trip_expense_share disable trigger trip_expense_share_notify;
alter table public.trip_settlement disable trigger trip_settlement_notify;
alter table public.ride_passenger disable trigger ride_passenger_notify;
alter table public.ride disable trigger ride_notify;

insert into public.fan_group (id, name, created_by, invite_code, source, chat_background)
values ('b0000000-0000-4000-8000-000000000101', 'Malta do Dragão (teste)', 'b0000000-0000-4000-8000-000000000001', 'rondatst01', 'manual', 'relvado');

insert into public.fan_group_member (group_id, profile_id, role, joined_at)
select 'b0000000-0000-4000-8000-000000000101', id,
  case when id = 'b0000000-0000-4000-8000-000000000001' then 'owner' else 'member' end,
  now() - interval '20 days'
from public.profile where id::text like 'b0000000-%';

-- The plan, proposed by Tiago. Duarte has not answered yet.
insert into public.fixture_plan (id, group_id, fixture_id, created_by, created_at)
values ('b0000000-0000-4000-8000-000000000201', 'b0000000-0000-4000-8000-000000000101', 'porto-estoril-2026-27',
  'b0000000-0000-4000-8000-000000000001', now() - interval '2 days');
insert into public.fixture_plan_answer (plan_id, profile_id, answer)
select 'b0000000-0000-4000-8000-000000000201', id, case when id = 'b0000000-0000-4000-8000-000000000010' then 'nao' else 'vou' end
from public.profile
where id::text like 'b0000000-%' and id <> 'b0000000-0000-4000-8000-000000000008';

-- Rui's car from Sete Rios, leaving 15:00 (Lisbon = UTC in winter), fastest road: 3 seats.
insert into public.ride (id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents, total_cents,
  accepts_return_requests, group_id, visibility, origin_city, rules_accepted_at, note)
values ('b0000000-0000-4000-8000-000000000301', 'porto-estoril-2026-27', 'b0000000-0000-4000-8000-000000000002', 'Sete Rios',
  'SRID=4326;POINT(-9.1669 38.7406)', '2026-10-31 15:00:00+00', 3, 'rapida', true,
  311086, 10752, 287817, 650, 2040, 8250, 5380, 13630, true, 'b0000000-0000-4000-8000-000000000101', 'grupo', 'Lisboa',
  now() - interval '1 day', 'Encontro à saída do metro do Jardim Zoológico.');
insert into public.ride_passenger (ride_id, profile_id, status, rules_accepted_at) values
  ('b0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-000000000001', 'accepted', now() - interval '20 hours'),
  ('b0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-000000000003', 'accepted', now() - interval '18 hours'),
  ('b0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-000000000004', 'requested', now() - interval '2 hours');

-- Inês's car from Coimbra B, leaving 17:30: full. Duarte was in and left.
insert into public.ride (id, fixture_id, driver_id, origin_name, origin, departure_at, seats_offered, route_option, round_trip,
  distance_m, duration_s, toll_m, consumption_cl_per_100km, fuel_price_milli_per_litre, fuel_cents, toll_cents, total_cents,
  accepts_return_requests, group_id, visibility, origin_city, rules_accepted_at)
values ('b0000000-0000-4000-8000-000000000302', 'porto-estoril-2026-27', 'b0000000-0000-4000-8000-000000000005', 'Coimbra B',
  'SRID=4326;POINT(-8.4103 40.2033)', '2026-10-31 17:30:00+00', 3, 'rapida', true,
  122500, 4817, 88057, 650, 2040, 3248, 1536, 4784, false, 'b0000000-0000-4000-8000-000000000101', 'grupo', 'Coimbra',
  now() - interval '1 day');
insert into public.ride_passenger (ride_id, profile_id, status, rules_accepted_at) values
  ('b0000000-0000-4000-8000-000000000302', 'b0000000-0000-4000-8000-000000000006', 'accepted', now() - interval '22 hours'),
  ('b0000000-0000-4000-8000-000000000302', 'b0000000-0000-4000-8000-000000000007', 'accepted', now() - interval '21 hours'),
  ('b0000000-0000-4000-8000-000000000302', 'b0000000-0000-4000-8000-000000000008', 'left', now() - interval '20 hours'),
  ('b0000000-0000-4000-8000-000000000302', 'b0000000-0000-4000-8000-000000000009', 'accepted', now() - interval '6 hours');

-- The cars' chats.
insert into public.ride_message (id, ride_id, profile_id, body, created_at) values
  ('b0000000-0000-4000-8000-000000000351', 'b0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-000000000002', 'Saio às 15:00 do Zoo. Paragem em Pombal para café.', now() - interval '19 hours'),
  ('b0000000-0000-4000-8000-000000000352', 'b0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-000000000003', 'Combinado, levo bifanas para a viagem.', now() - interval '17 hours'),
  ('b0000000-0000-4000-8000-000000000353', 'b0000000-0000-4000-8000-000000000302', 'b0000000-0000-4000-8000-000000000005', 'Carro cheio! Saímos 17:30 de Coimbra B.', now() - interval '5 hours');

-- The group chat, in order.
insert into public.group_message (id, group_id, profile_id, kind, body, place_id, plan_id, created_at) values
  ('b0000000-0000-4000-8000-000000000701', 'b0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000001', 'plano', 'FC Porto x Estoril', null, 'b0000000-0000-4000-8000-000000000201', now() - interval '2 days'),
  ('b0000000-0000-4000-8000-000000000702', 'b0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000002', 'texto', 'Levo o carro de Lisboa, há lugar para três.', null, null, now() - interval '1 day'),
  ('b0000000-0000-4000-8000-000000000703', 'b0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000005', 'texto', 'E eu de Coimbra. Quem estiver por cá, diga.', null, null, now() - interval '23 hours'),
  ('b0000000-0000-4000-8000-000000000704', 'b0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000010', 'texto', 'Desta vez não posso, trabalho no sábado.', null, null, now() - interval '20 hours'),
  ('b0000000-0000-4000-8000-000000000705', 'b0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000004', 'texto', 'Pedi lugar no carro do Rui!', null, null, now() - interval '2 hours');

update public.fan_group set updated_at = now() where id = 'b0000000-0000-4000-8000-000000000101';

alter table public.group_message enable trigger group_message_notify;
alter table public.trip_expense_share enable trigger trip_expense_share_notify;
alter table public.trip_settlement enable trigger trip_settlement_notify;
alter table public.ride_passenger enable trigger ride_passenger_notify;
alter table public.ride enable trigger ride_notify;

select
  (select status || ' / boleia ' || coalesce(ride_id::text, 'nenhuma') from public.fixture_plan
     where id = 'b0000000-0000-4000-8000-000000000201') as plano,
  (select count(*) from public.fixture_plan_answer where plan_id = 'b0000000-0000-4000-8000-000000000201') as respostas,
  (select count(*) from public.ride where id::text like 'b0000000-%' and visibility = 'grupo') as boleias_so_no_grupo,
  (select count(*) from public.ride where id::text like 'b0000000-%' and visibility <> 'grupo') as boleias_publicas;

commit;
