-- Contas para as capturas das lojas e o vídeo promocional (docs/promo/LEIA-ME.md).
--
-- Uma conta com password, capturas@teste.awayday.invalid («Tiago Fonseca»), e dez pessoas inventadas à volta dela,
-- com nomes normais porque aparecem nas imagens. Nenhuma é uma pessoa real. Ids fixos c0000000-…, para o apagar ser
-- exato (capturas-apagar.sql). A tua conta e os outros dados de teste (a0000000-…, e2e00000-…) não são tocados.
--
-- A password não fica aqui: entra no lugar do marcador por um ficheiro temporário, como na conta E2E:
--
--   sed "s/'__CAPTURAS_PASSWORD__'/'$CAPTURAS_PASSWORD'/" scripts/dados-de-teste/capturas-contas.sql > /tmp/c.sql
--   supabase db query --linked -f /tmp/c.sql; rm /tmp/c.sql
--
-- Depois disto corre capturas-dados.sql (grupo, planos, boleias, sessão, despesas, conversa).

begin;

-- The signed-in account. Token columns must be '' (not null) or GoTrue fails to read the row on sign-in.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  'c0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'capturas@teste.awayday.invalid', extensions.crypt('__CAPTURAS_PASSWORD__', extensions.gen_salt('bf')), now(),
  '{"display_name":"Tiago Fonseca"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now(),
  '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
values (
  'c0000000-0000-4000-8000-000000000091', 'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001', 'email',
  '{"sub":"c0000000-0000-4000-8000-000000000001","email":"capturas@teste.awayday.invalid","email_verified":true}',
  now(), now() - interval '60 days', now()
);

-- Everyone else never signs in: no password.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  ('c0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rui.capturas@teste.awayday.invalid', '', now(), '{"display_name":"Rui Almeida"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now()),
  ('c0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.capturas@teste.awayday.invalid', '', now(), '{"display_name":"Ana Ribeiro"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now()),
  ('c0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ze.capturas@teste.awayday.invalid', '', now(), '{"display_name":"Zé Carvalho"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now()),
  ('c0000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ines.capturas@teste.awayday.invalid', '', now(), '{"display_name":"Inês Matos"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now()),
  ('c0000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'marco.capturas@teste.awayday.invalid', '', now(), '{"display_name":"Marco Silva"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now()),
  ('c0000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'joana.capturas@teste.awayday.invalid', '', now(), '{"display_name":"Joana Costa"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now()),
  ('c0000000-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pedro.capturas@teste.awayday.invalid', '', now(), '{"display_name":"Pedro Nunes"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now()),
  ('c0000000-0000-4000-8000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carla.capturas@teste.awayday.invalid', '', now(), '{"display_name":"Carla Mendes"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now()),
  ('c0000000-0000-4000-8000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hugo.capturas@teste.awayday.invalid', '', now(), '{"display_name":"Hugo Pires"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now()),
  ('c0000000-0000-4000-8000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sofia.capturas@teste.awayday.invalid', '', now(), '{"display_name":"Sofia Lopes"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now());

-- Where they leave from, and who they support (profiles are created by handle_new_user).
update public.profile as p set home_city = v.cidade
from (values
  ('c0000000-0000-4000-8000-000000000001'::uuid, 'Lisboa'),
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'Lisboa'),
  ('c0000000-0000-4000-8000-000000000003'::uuid, 'Lisboa'),
  ('c0000000-0000-4000-8000-000000000004'::uuid, 'Almada'),
  ('c0000000-0000-4000-8000-000000000005'::uuid, 'Lisboa'),
  ('c0000000-0000-4000-8000-000000000006'::uuid, 'Coimbra'),
  ('c0000000-0000-4000-8000-000000000007'::uuid, 'Leiria'),
  ('c0000000-0000-4000-8000-000000000008'::uuid, 'Aveiro'),
  ('c0000000-0000-4000-8000-000000000009'::uuid, 'Leiria'),
  ('c0000000-0000-4000-8000-000000000010'::uuid, 'Leiria'),
  ('c0000000-0000-4000-8000-000000000011'::uuid, 'Aveiro')
) as v(id, cidade)
where p.id = v.id;

insert into public.profile_club (profile_id, relation, club_id)
select id, 'supporter', 'sporting'
from (values
  ('c0000000-0000-4000-8000-000000000001'::uuid), ('c0000000-0000-4000-8000-000000000002'::uuid),
  ('c0000000-0000-4000-8000-000000000003'::uuid), ('c0000000-0000-4000-8000-000000000004'::uuid),
  ('c0000000-0000-4000-8000-000000000005'::uuid), ('c0000000-0000-4000-8000-000000000006'::uuid),
  ('c0000000-0000-4000-8000-000000000007'::uuid), ('c0000000-0000-4000-8000-000000000008'::uuid),
  ('c0000000-0000-4000-8000-000000000009'::uuid), ('c0000000-0000-4000-8000-000000000010'::uuid),
  ('c0000000-0000-4000-8000-000000000011'::uuid)
) as v(id);

select
  (select count(*) from auth.users where id::text like 'c0000000-%') as contas,
  (select display_name from public.profile where id = 'c0000000-0000-4000-8000-000000000001') as conta_principal;

commit;
