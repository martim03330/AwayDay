-- Conta dedicada aos testes de ponta a ponta (Maestro): e2e@teste.awayday.invalid.
--
-- A password não fica aqui: está em .maestro/env (fora do git) e é posta no lugar do marcador (o texto entre
-- plicas no crypt() abaixo) por um ficheiro temporário, na raiz do projeto:
--
--   set -a; . .maestro/env; set +a
--   sed "s/'__E2E_PASSWORD__'/'$MAESTRO_E2E_PASSWORD'/" scripts/dados-de-teste/e2e-conta.sql > /tmp/e2e-conta.sql
--   supabase db query --linked -f /tmp/e2e-conta.sql; rm /tmp/e2e-conta.sql
--
-- Começa por apagar a conta (e o que ela criou), para cada corrida partir do zero. Id fixo: e2e00000-…-000000000001.
-- Apagar só a conta:  supabase db query --linked -f scripts/dados-de-teste/e2e-apagar.sql

begin;

-- Clean slate: whatever a previous run left behind.
delete from public.trip_session
where id in (
  select fp.session_id from public.fixture_plan as fp
  join public.fan_group as g on g.id = fp.group_id
  where g.created_by = 'e2e00000-0000-4000-8000-000000000001' and fp.session_id is not null
);
delete from public.fixture_plan
where group_id in (select id from public.fan_group where created_by = 'e2e00000-0000-4000-8000-000000000001')
   or created_by = 'e2e00000-0000-4000-8000-000000000001';
delete from public.fan_group where created_by = 'e2e00000-0000-4000-8000-000000000001';
delete from public.profile where id = 'e2e00000-0000-4000-8000-000000000001';
delete from auth.users where id = 'e2e00000-0000-4000-8000-000000000001' or email = 'e2e@teste.awayday.invalid';

-- The user. The token columns must be '' (not null) or GoTrue fails to read the row on sign-in.
-- The profile is created by the handle_new_user trigger.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  'e2e00000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'e2e@teste.awayday.invalid', extensions.crypt('__E2E_PASSWORD__', extensions.gen_salt('bf')), now(),
  '{"display_name":"E2E (teste)"}', '{"provider":"email","providers":["email"]}', now(), now(),
  '', '', '', ''
);

-- Email identity, as GoTrue creates it on a normal sign-up.
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
values (
  'e2e00000-0000-4000-8000-000000000002', 'e2e00000-0000-4000-8000-000000000001',
  'e2e00000-0000-4000-8000-000000000001', 'email',
  '{"sub":"e2e00000-0000-4000-8000-000000000001","email":"e2e@teste.awayday.invalid","email_verified":true}',
  now(), now(), now()
);

select
  (select count(*) from auth.users where email = 'e2e@teste.awayday.invalid') as conta_e2e,
  (select display_name from public.profile where id = 'e2e00000-0000-4000-8000-000000000001') as nome;

commit;
