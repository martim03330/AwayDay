-- Dados de teste: viagens já feitas (para o Histórico e o álbum) e um plano em conflito.
--
-- Corre depois de criar.sql (usa as mesmas pessoas e grupos). O criar.sh corre os dois e envia as fotos.
--   · Famalicão x Sporting (13 set): foste tu, o Rui, a Ana e o Zé — 4 fotos, jantar, imperiais, portagens.
--   · Milan x Benfica (16 set, Milão): foste tu e a Ana — sem fotos ainda, para veres o álbum vazio.
--   · «Primos da bola»: a Inês convidou para o Sporting x Arouca, mas tu já vais com a «Malta do café» (plano fechado).

begin;

alter table public.trip_expense_share disable trigger trip_expense_share_notify;
alter table public.group_message disable trigger group_message_notify;

insert into public.trip_session (id, group_id, fixture_id, opened_by, name, created_at)
values
  ('a0000000-0000-4000-8000-000000000801', 'a0000000-0000-4000-8000-000000000101', 'famalicao-sporting-2026-27',
   '027d9f21-4ebd-433a-8a4e-4cc035b0163e', 'Malta do café (teste)', '2026-09-12 10:00:00+00'),
  ('a0000000-0000-4000-8000-000000000802', null, 'milan-benfica-liga-europa-2026-27',
   'a0000000-0000-4000-8000-000000000002', 'Milão com a Ana', '2026-09-14 10:00:00+00');

insert into public.trip_session_member (session_id, profile_id, added_by) values
  ('a0000000-0000-4000-8000-000000000801', '027d9f21-4ebd-433a-8a4e-4cc035b0163e', '027d9f21-4ebd-433a-8a4e-4cc035b0163e'),
  ('a0000000-0000-4000-8000-000000000801', 'a0000000-0000-4000-8000-000000000001', '027d9f21-4ebd-433a-8a4e-4cc035b0163e'),
  ('a0000000-0000-4000-8000-000000000801', 'a0000000-0000-4000-8000-000000000002', '027d9f21-4ebd-433a-8a4e-4cc035b0163e'),
  ('a0000000-0000-4000-8000-000000000801', 'a0000000-0000-4000-8000-000000000003', '027d9f21-4ebd-433a-8a4e-4cc035b0163e'),
  ('a0000000-0000-4000-8000-000000000802', '027d9f21-4ebd-433a-8a4e-4cc035b0163e', 'a0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002');

insert into public.trip_expense (id, session_id, payer_id, description, category, cents, created_by, source, created_at) values
  ('a0000000-0000-4000-8000-000000000811', 'a0000000-0000-4000-8000-000000000801', 'a0000000-0000-4000-8000-000000000001', 'Jantar de vitória em Famalicão', 'refeicao', 8640, 'a0000000-0000-4000-8000-000000000001', 'manual', '2026-09-13 22:30:00+00'),
  ('a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000801', 'a0000000-0000-4000-8000-000000000002', 'Imperiais no estádio', 'cerveja', 3200, 'a0000000-0000-4000-8000-000000000002', 'manual', '2026-09-13 19:00:00+00'),
  ('a0000000-0000-4000-8000-000000000813', 'a0000000-0000-4000-8000-000000000801', '027d9f21-4ebd-433a-8a4e-4cc035b0163e', 'Portagens da A3', 'portagens', 1450, '027d9f21-4ebd-433a-8a4e-4cc035b0163e', 'manual', '2026-09-13 16:00:00+00'),
  ('a0000000-0000-4000-8000-000000000814', 'a0000000-0000-4000-8000-000000000801', 'a0000000-0000-4000-8000-000000000003', 'Bilhetes', 'bilhetes', 10000, 'a0000000-0000-4000-8000-000000000003', 'manual', '2026-09-10 12:00:00+00'),
  ('a0000000-0000-4000-8000-000000000821', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000000002', 'Pizza em Navigli', 'refeicao', 5600, 'a0000000-0000-4000-8000-000000000002', 'manual', '2026-09-16 12:30:00+00');

insert into public.trip_expense_share (expense_id, profile_id)
select e.id, m.profile_id
from public.trip_expense as e
join public.trip_session_member as m on m.session_id = e.session_id
where e.id::text like 'a0000000-0000-4000-8000-0000000008%';

-- As fotos (os ficheiros são enviados pelo criar.sh para o balde trip-photos).
insert into public.trip_photo (session_id, profile_id, storage_path, caption, created_at) values
  ('a0000000-0000-4000-8000-000000000801', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000801/a-caminho.jpg', 'Quatro no carro e a A3 inteira pela frente', '2026-09-13 15:40:00+00'),
  ('a0000000-0000-4000-8000-000000000801', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000801/no-estadio.jpg', 'Já cá estamos!', '2026-09-13 19:10:00+00'),
  ('a0000000-0000-4000-8000-000000000801', '027d9f21-4ebd-433a-8a4e-4cc035b0163e', 'a0000000-0000-4000-8000-000000000801/o-golo.jpg', 'Aos 88 minutos. Ninguém se sentou até ao fim.', '2026-09-13 21:18:00+00'),
  ('a0000000-0000-4000-8000-000000000801', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000801/jantar.jpg', null, '2026-09-13 22:40:00+00');

-- O plano em conflito: a Inês convida os «Primos» para o Sporting x Arouca, a que tu já vais com a Malta do café.
insert into public.fixture_plan (id, group_id, fixture_id, created_by, created_at)
values ('a0000000-0000-4000-8000-000000000204', 'a0000000-0000-4000-8000-000000000102', 'sporting-arouca-2026-27',
  'a0000000-0000-4000-8000-000000000004', now() - interval '5 hours');
insert into public.fixture_plan_answer (plan_id, profile_id, answer)
values ('a0000000-0000-4000-8000-000000000204', 'a0000000-0000-4000-8000-000000000004', 'vou');
insert into public.group_message (id, group_id, profile_id, kind, body, plan_id, created_at)
values ('a0000000-0000-4000-8000-000000000713', 'a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000004',
  'plano', 'Sporting x Arouca', 'a0000000-0000-4000-8000-000000000204', now() - interval '5 hours');

alter table public.trip_expense_share enable trigger trip_expense_share_notify;
alter table public.group_message enable trigger group_message_notify;

select
  (select count(*) from public.trip_session where id::text like 'a0000000-0000-4000-8000-0000000008%') as viagens_passadas,
  (select count(*) from public.trip_photo where session_id = 'a0000000-0000-4000-8000-000000000801') as fotos,
  (select count(*) from public.fixture_plan where id = 'a0000000-0000-4000-8000-000000000204') as plano_em_conflito;

commit;
