-- Contas para a ronda de teste do FC Porto x Estoril (31 out 2026): ver todos os ecrãs de um jogo, caso a caso.
--
-- Dez pessoas «(teste)», ids fixos b0000000-…, emails *.ronda@teste.awayday.invalid. Duas entram na app com password:
--   · tiago.ronda@… (Tiago, quem vê a app: passageiro no carro do Rui);
--   · rui.ronda@…   (Rui, o condutor: vê os pedidos de lugar).
-- As outras nunca entram. A tua conta e os outros dados de teste (a0000000-…, c0000000-…, e2e00000-…) não são tocados.
--
-- A password não fica aqui: entra no lugar do marcador por um ficheiro temporário, como na conta E2E:
--
--   sed "s/'__RONDA_PASSWORD__'/'$RONDA_PASSWORD'/g" scripts/dados-de-teste/ronda-contas.sql > /tmp/r.sql
--   supabase db query --linked -f /tmp/r.sql; rm /tmp/r.sql
--
-- Depois disto corre ronda-dados.sql. Apaga tudo com ronda-apagar.sql.

begin;

-- The two accounts that sign in. Token columns must be '' (not null) or GoTrue fails to read the row on sign-in.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('b0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'tiago.ronda@teste.awayday.invalid', extensions.crypt('__RONDA_PASSWORD__', extensions.gen_salt('bf')), now(),
   '{"display_name":"Tiago (teste)"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now(),
   '', '', '', ''),
  ('b0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rui.ronda@teste.awayday.invalid', extensions.crypt('__RONDA_PASSWORD__', extensions.gen_salt('bf')), now(),
   '{"display_name":"Rui (teste)"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now(),
   '', '', '', '');

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
values
  ('b0000000-0000-4000-8000-000000000091', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000001', 'email',
   '{"sub":"b0000000-0000-4000-8000-000000000001","email":"tiago.ronda@teste.awayday.invalid","email_verified":true}',
   now(), now() - interval '60 days', now()),
  ('b0000000-0000-4000-8000-000000000092', 'b0000000-0000-4000-8000-000000000002',
   'b0000000-0000-4000-8000-000000000002', 'email',
   '{"sub":"b0000000-0000-4000-8000-000000000002","email":"rui.ronda@teste.awayday.invalid","email_verified":true}',
   now(), now() - interval '60 days', now());

-- Everyone else never signs in: no password.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  ('b0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.ronda@teste.awayday.invalid', '', now(), '{"display_name":"Ana (teste)"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now()),
  ('b0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ze.ronda@teste.awayday.invalid', '', now(), '{"display_name":"Zé (teste)"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now()),
  ('b0000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ines.ronda@teste.awayday.invalid', '', now(), '{"display_name":"Inês (teste)"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now()),
  ('b0000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bruno.ronda@teste.awayday.invalid', '', now(), '{"display_name":"Bruno (teste)"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now()),
  ('b0000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carla.ronda@teste.awayday.invalid', '', now(), '{"display_name":"Carla (teste)"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now()),
  ('b0000000-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'duarte.ronda@teste.awayday.invalid', '', now(), '{"display_name":"Duarte (teste)"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now()),
  ('b0000000-0000-4000-8000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hugo.ronda@teste.awayday.invalid', '', now(), '{"display_name":"Hugo (teste)"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now()),
  ('b0000000-0000-4000-8000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sofia.ronda@teste.awayday.invalid', '', now(), '{"display_name":"Sofia (teste)"}', '{"provider":"email","providers":["email"]}', now() - interval '60 days', now());

-- Where they leave from, and who they support (profiles are created by handle_new_user).
update public.profile as p set home_city = v.cidade
from (values
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'Lisboa'),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'Lisboa'),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'Lisboa'),
  ('b0000000-0000-4000-8000-000000000004'::uuid, 'Lisboa'),
  ('b0000000-0000-4000-8000-000000000005'::uuid, 'Coimbra'),
  ('b0000000-0000-4000-8000-000000000006'::uuid, 'Coimbra'),
  ('b0000000-0000-4000-8000-000000000007'::uuid, 'Coimbra'),
  ('b0000000-0000-4000-8000-000000000008'::uuid, 'Coimbra'),
  ('b0000000-0000-4000-8000-000000000009'::uuid, 'Coimbra'),
  ('b0000000-0000-4000-8000-000000000010'::uuid, 'Lisboa')
) as v(id, cidade)
where p.id = v.id;

insert into public.profile_club (profile_id, relation, club_id)
select id, 'supporter', 'porto'
from public.profile
where id::text like 'b0000000-%';

select
  (select count(*) from auth.users where id::text like 'b0000000-%') as contas,
  (select count(*) from public.profile_club where profile_id::text like 'b0000000-%') as clubes;

commit;
