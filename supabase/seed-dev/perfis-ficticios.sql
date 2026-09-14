-- DEVELOPMENT ONLY. Three fictional users with one season (2025-26) of history, to try the coach messages
-- and the season recap without real usage. Not in ./seed (so `db push --include-seed` never loads it).
--
-- Profiles (they cannot sign in: no password):
--   a0000000-0000-4000-8000-000000000001  Vai a Tudo (fictício): supports Porto, hometown Braga.
--       2025-26: 25 matches in 12 stadiums (8 new; 4 already visited in 2024-25), 18 reviews, 21 check-ins.
--   a0000000-0000-4000-8000-000000000002  Ocasional (fictício): supports Sporting, hometown Vitória.
--       2025-26: 6 matches in 3 stadiums (2 new), 2 reviews, 3 check-ins.
--   a0000000-0000-4000-8000-000000000003  Novato (fictício): supports Benfica, no hometown club.
--       2025-26: 2 matches in 1 stadium, no reviews, 1 check-in.
--
-- Fixtures are extra rows with ids starting with 'dev-'. Idempotent: running it twice changes nothing.
-- Warning: on a shared database these users count in public aggregates (e.g. supporters per club).
-- To remove everything:
--   delete from auth.users where id::text like 'a0000000-0000-4000-8000-00000000000%';
--   delete from public.fixture where id like 'dev-%';
--   delete from public.season where id = '2025-26';

insert into public.season (id, starts_on, ends_on)
values ('2025-26', '2025-07-01', '2026-06-30')
on conflict (id) do nothing;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'dev-vai-a-tudo@awayday.test', '', now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Vai a Tudo (fictício)"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'dev-ocasional@awayday.test', '', now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Ocasional (fictício)"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'dev-novato@awayday.test', '', now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Novato (fictício)"}', now(), now())
on conflict (id) do nothing;

insert into public.profile_club (profile_id, relation, club_id)
values
  ('a0000000-0000-4000-8000-000000000001', 'supporter', 'porto'),
  ('a0000000-0000-4000-8000-000000000001', 'hometown', 'braga'),
  ('a0000000-0000-4000-8000-000000000002', 'supporter', 'sporting'),
  ('a0000000-0000-4000-8000-000000000002', 'hometown', 'vitoria'),
  ('a0000000-0000-4000-8000-000000000003', 'supporter', 'benfica')
on conflict do nothing;

-- Fixtures, in Lisbon time.
insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at)
select id, competition_id, stage, home_club_id, away_club_id, venue_id, local_kickoff::timestamp at time zone 'Europe/Lisbon'
from (
  values
    -- 2024-25 (before the season): the Vai a Tudo already knew these four stadiums; the Ocasional, Alvalade.
    ('dev-2425-benfica-porto', 'liga', 'Jornada 10', 'benfica', 'porto', 'luz', '2024-11-02 20:30'),
    ('dev-2425-sporting-porto', 'liga', 'Jornada 21', 'sporting', 'porto', 'alvalade', '2025-02-08 20:30'),
    ('dev-2425-porto-benfica', 'liga', 'Jornada 25', 'porto', 'benfica', 'dragao', '2025-03-01 20:30'),
    ('dev-2425-braga-porto', 'liga', 'Jornada 29', 'braga', 'porto', 'municipal-braga', '2025-04-12 20:30'),
    ('dev-2425-sporting-gil-vicente', 'liga', 'Jornada 30', 'sporting', 'gil-vicente', 'alvalade', '2025-04-20 18:00'),

    -- 2025-26: Vai a Tudo (25).
    ('dev-2526-porto-vitoria', 'liga', 'Jornada 1', 'porto', 'vitoria', 'dragao', '2025-08-16 20:30'),
    ('dev-2526-famalicao-porto', 'liga', 'Jornada 2', 'famalicao', 'porto', '22-de-junho', '2025-08-23 20:30'),
    ('dev-2526-porto-arouca', 'liga', 'Jornada 3', 'porto', 'arouca', 'dragao', '2025-08-30 20:30'),
    ('dev-2526-rio-ave-porto', 'liga', 'Jornada 4', 'rio-ave', 'porto', 'arcos', '2025-09-13 18:00'),
    ('dev-2526-porto-estoril', 'liga', 'Jornada 5', 'porto', 'estoril', 'dragao', '2025-09-20 20:30'),
    ('dev-2526-braga-sporting', 'liga', 'Jornada 6', 'braga', 'sporting', 'municipal-braga', '2025-09-27 20:30'),
    ('dev-2526-porto-benfica', 'liga', 'Jornada 7', 'porto', 'benfica', 'dragao', '2025-10-04 20:30'),
    ('dev-2526-leixoes-porto', 'taca-de-portugal', '3.ª eliminatória', 'leixoes', 'porto', 'estadio-do-mar', '2025-10-18 20:45'),
    ('dev-2526-porto-gil-vicente', 'liga', 'Jornada 8', 'porto', 'gil-vicente', 'dragao', '2025-10-25 20:30'),
    ('dev-2526-avs-porto', 'liga', 'Jornada 9', 'avs', 'porto', 'cd-aves', '2025-11-01 18:00'),
    ('dev-2526-porto-moreirense', 'liga', 'Jornada 10', 'porto', 'moreirense', 'dragao', '2025-11-08 20:30'),
    ('dev-2526-feirense-porto', 'taca-de-portugal', '4.ª eliminatória', 'feirense', 'porto', 'marcolino-de-castro', '2025-11-22 20:15'),
    ('dev-2526-sporting-porto', 'liga', 'Jornada 12', 'sporting', 'porto', 'alvalade', '2025-12-06 20:30'),
    ('dev-2526-porto-casa-pia', 'liga', 'Jornada 14', 'porto', 'casa-pia', 'dragao', '2025-12-20 20:30'),
    ('dev-2526-gil-vicente-porto', 'liga', 'Jornada 16', 'gil-vicente', 'porto', 'cidade-de-barcelos', '2026-01-10 18:00'),
    ('dev-2526-porto-braga', 'liga', 'Jornada 18', 'porto', 'braga', 'dragao', '2026-01-24 20:30'),
    ('dev-2526-vitoria-porto', 'liga', 'Jornada 20', 'vitoria', 'porto', 'afonso-henriques', '2026-02-07 20:30'),
    ('dev-2526-porto-tondela', 'liga', 'Jornada 22', 'porto', 'tondela', 'dragao', '2026-02-21 20:30'),
    ('dev-2526-belenenses-porto', 'taca-de-portugal', 'Quartos de final', 'belenenses', 'porto', 'restelo', '2026-03-04 20:15'),
    ('dev-2526-porto-famalicao', 'liga', 'Jornada 25', 'porto', 'famalicao', 'dragao', '2026-03-14 20:30'),
    ('dev-2526-benfica-porto', 'liga', 'Jornada 28', 'benfica', 'porto', 'luz', '2026-04-04 20:30'),
    ('dev-2526-porto-nacional', 'liga', 'Jornada 30', 'porto', 'nacional', 'dragao', '2026-04-18 20:30'),
    ('dev-2526-braga-porto', 'liga', 'Jornada 31', 'braga', 'porto', 'municipal-braga', '2026-04-25 20:30'),
    ('dev-2526-porto-sporting', 'liga', 'Jornada 33', 'porto', 'sporting', 'dragao', '2026-05-09 20:30'),
    ('dev-2526-porto-rio-ave', 'liga', 'Jornada 34', 'porto', 'rio-ave', 'dragao', '2026-05-16 20:30'),

    -- 2025-26: Ocasional (6).
    ('dev-2526-sporting-estrela', 'liga', 'Jornada 2', 'sporting', 'estrela', 'alvalade', '2025-08-24 20:30'),
    ('dev-2526-sporting-braga', 'liga', 'Jornada 10', 'sporting', 'braga', 'alvalade', '2025-11-02 20:30'),
    ('dev-2526-vitoria-sporting', 'liga', 'Jornada 13', 'vitoria', 'sporting', 'afonso-henriques', '2025-12-14 18:00'),
    ('dev-2526-sporting-benfica', 'liga', 'Jornada 19', 'sporting', 'benfica', 'alvalade', '2026-01-31 20:30'),
    ('dev-2526-benfica-sporting', 'liga', 'Jornada 26', 'benfica', 'sporting', 'luz', '2026-03-21 20:30'),
    ('dev-2526-sporting-famalicao', 'liga', 'Jornada 33', 'sporting', 'famalicao', 'alvalade', '2026-05-10 18:00'),

    -- 2025-26: Novato (2).
    ('dev-2526-benfica-arouca', 'liga', 'Jornada 22', 'benfica', 'arouca', 'luz', '2026-02-14 20:30'),
    ('dev-2526-benfica-braga', 'liga', 'Jornada 32', 'benfica', 'braga', 'luz', '2026-04-26 20:30')
) as rows (id, competition_id, stage, home_club_id, away_club_id, venue_id, local_kickoff)
on conflict (id) do nothing;

-- Attendance ("fui").
insert into public.fixture_attendance (profile_id, fixture_id, status)
select profile_id::uuid, fixture_id, 'attended'
from (
  values
    ('a0000000-0000-4000-8000-000000000001', 'dev-2425-benfica-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2425-sporting-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2425-porto-benfica'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2425-braga-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-vitoria'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-famalicao-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-arouca'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-rio-ave-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-estoril'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-braga-sporting'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-benfica'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-leixoes-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-gil-vicente'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-avs-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-moreirense'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-feirense-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-sporting-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-casa-pia'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-gil-vicente-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-braga'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-vitoria-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-tondela'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-belenenses-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-famalicao'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-benfica-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-nacional'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-braga-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-sporting'),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-rio-ave'),
    ('a0000000-0000-4000-8000-000000000002', 'dev-2425-sporting-gil-vicente'),
    ('a0000000-0000-4000-8000-000000000002', 'dev-2526-sporting-estrela'),
    ('a0000000-0000-4000-8000-000000000002', 'dev-2526-sporting-braga'),
    ('a0000000-0000-4000-8000-000000000002', 'dev-2526-vitoria-sporting'),
    ('a0000000-0000-4000-8000-000000000002', 'dev-2526-sporting-benfica'),
    ('a0000000-0000-4000-8000-000000000002', 'dev-2526-benfica-sporting'),
    ('a0000000-0000-4000-8000-000000000002', 'dev-2526-sporting-famalicao'),
    ('a0000000-0000-4000-8000-000000000003', 'dev-2526-benfica-arouca'),
    ('a0000000-0000-4000-8000-000000000003', 'dev-2526-benfica-braga')
) as rows (profile_id, fixture_id)
on conflict do nothing;

-- Reviews (stadium, atmosphere, access).
insert into public.venue_review (profile_id, fixture_id, stadium_score, atmosphere_score, access_score, comment)
select profile_id::uuid, fixture_id, stadium, atmosphere, access, ''
from (
  values
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-vitoria', 5, 5, 4),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-famalicao-porto', 3, 4, 3),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-arouca', 5, 4, 4),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-estoril', 5, 4, 5),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-braga-sporting', 4, 4, 3),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-benfica', 5, 5, 3),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-gil-vicente', 5, 3, 4),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-moreirense', 5, 3, 5),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-sporting-porto', 4, 5, 3),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-casa-pia', 5, 3, 4),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-braga', 5, 4, 4),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-vitoria-porto', 4, 5, 3),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-tondela', 5, 3, 5),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-famalicao', 5, 4, 4),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-benfica-porto', 4, 5, 2),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-nacional', 5, 3, 5),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-sporting', 5, 5, 3),
    ('a0000000-0000-4000-8000-000000000001', 'dev-2526-porto-rio-ave', 5, 4, 4),
    ('a0000000-0000-4000-8000-000000000002', 'dev-2526-sporting-benfica', 4, 5, 3),
    ('a0000000-0000-4000-8000-000000000002', 'dev-2526-benfica-sporting', 4, 4, 2)
) as rows (profile_id, fixture_id, stadium, atmosphere, access)
on conflict do nothing;

-- Check-ins, two hours before kick-off of the match that day (fixed ids, so it is idempotent).
insert into public.place_visit (id, profile_id, place_id, visited_at, source)
select
  md5(rows.profile_id || rows.place_id || rows.fixture_id)::uuid,
  rows.profile_id::uuid,
  rows.place_id,
  f.kickoff_at - interval '2 hours',
  'check-in'
from (
  values
    ('a0000000-0000-4000-8000-000000000001', 'bifanas-campanha', 'dev-2526-porto-vitoria'),
    ('a0000000-0000-4000-8000-000000000001', 'bifanas-campanha', 'dev-2526-porto-arouca'),
    ('a0000000-0000-4000-8000-000000000001', 'bifanas-campanha', 'dev-2526-porto-estoril'),
    ('a0000000-0000-4000-8000-000000000001', 'bifanas-campanha', 'dev-2526-porto-benfica'),
    ('a0000000-0000-4000-8000-000000000001', 'bifanas-campanha', 'dev-2526-porto-gil-vicente'),
    ('a0000000-0000-4000-8000-000000000001', 'bifanas-campanha', 'dev-2526-porto-moreirense'),
    ('a0000000-0000-4000-8000-000000000001', 'bifanas-campanha', 'dev-2526-porto-casa-pia'),
    ('a0000000-0000-4000-8000-000000000001', 'bifanas-campanha', 'dev-2526-porto-braga'),
    ('a0000000-0000-4000-8000-000000000001', 'bifanas-campanha', 'dev-2526-porto-famalicao'),
    ('a0000000-0000-4000-8000-000000000001', 'tasca-das-antas', 'dev-2526-porto-tondela'),
    ('a0000000-0000-4000-8000-000000000001', 'tasca-das-antas', 'dev-2526-porto-nacional'),
    ('a0000000-0000-4000-8000-000000000001', 'tasca-das-antas', 'dev-2526-porto-sporting'),
    ('a0000000-0000-4000-8000-000000000001', 'bar-curva-norte', 'dev-2526-porto-rio-ave'),
    ('a0000000-0000-4000-8000-000000000001', 'bar-curva-norte', 'dev-2526-porto-benfica'),
    ('a0000000-0000-4000-8000-000000000001', 'cervejaria-azul-branco', 'dev-2526-porto-vitoria'),
    ('a0000000-0000-4000-8000-000000000001', 'roulotte-monte-castro', 'dev-2526-braga-sporting'),
    ('a0000000-0000-4000-8000-000000000001', 'roulotte-monte-castro', 'dev-2526-braga-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'tasca-leao-velho', 'dev-2526-sporting-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'roulotte-sr-ze', 'dev-2526-benfica-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'tasca-do-berco', 'dev-2526-vitoria-porto'),
    ('a0000000-0000-4000-8000-000000000001', 'tasca-do-restelo', 'dev-2526-belenenses-porto'),
    ('a0000000-0000-4000-8000-000000000002', 'tasca-leao-velho', 'dev-2526-sporting-braga'),
    ('a0000000-0000-4000-8000-000000000002', 'tasca-leao-velho', 'dev-2526-sporting-benfica'),
    ('a0000000-0000-4000-8000-000000000002', 'roulotte-sr-ze', 'dev-2526-benfica-sporting'),
    ('a0000000-0000-4000-8000-000000000003', 'roulotte-sr-ze', 'dev-2526-benfica-braga')
) as rows (profile_id, place_id, fixture_id)
join public.fixture as f on f.id = rows.fixture_id
on conflict (id) do nothing;
