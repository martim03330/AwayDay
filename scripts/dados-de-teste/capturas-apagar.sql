-- Apaga tudo o que capturas-contas.sql e capturas-dados.sql criaram. Só toca nos ids c0000000-… e nas contas
-- *.capturas@teste.awayday.invalid / capturas@teste.awayday.invalid; o resto da base de dados fica como estava.
--
-- Corre com:  supabase db query --linked -f scripts/dados-de-teste/capturas-apagar.sql

begin;

-- Sessions born from the capture plans (the trigger gives them random ids), and the ones created here.
delete from public.trip_session
where id in (select session_id from public.fixture_plan where id::text like 'c0000000-%' and session_id is not null)
   or id::text like 'c0000000-%'
   or opened_by::text like 'c0000000-%';

delete from public.fixture_plan where id::text like 'c0000000-%';
delete from public.stay_plan where id::text like 'c0000000-%';
delete from public.ride where id::text like 'c0000000-%' or driver_id::text like 'c0000000-%';
delete from public.fan_group where id::text like 'c0000000-%' or created_by::text like 'c0000000-%';

-- The accounts (profile and everything that hangs off it go with them).
delete from public.profile where id::text like 'c0000000-%';
delete from auth.users where id::text like 'c0000000-%';

select
  (select count(*) from auth.users where id::text like 'c0000000-%') as contas,
  (select count(*) from public.fan_group where id::text like 'c0000000-%') as grupos;

commit;
