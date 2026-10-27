-- Apaga tudo o que ronda-contas.sql e ronda-dados.sql criaram. Só toca nos ids b0000000-… (contas, grupo, planos,
-- boleias, sessões); o resto da base de dados fica como estava.
--
-- Corre com:  supabase db query --linked -f scripts/dados-de-teste/ronda-apagar.sql

begin;

-- Sessions born from the test plan (the trigger gives them random ids), and any opened by a test account.
delete from public.trip_session
where id in (select session_id from public.fixture_plan where id::text like 'b0000000-%' and session_id is not null)
   or id::text like 'b0000000-%'
   or opened_by::text like 'b0000000-%';

delete from public.fixture_plan where id::text like 'b0000000-%' or created_by::text like 'b0000000-%';
delete from public.ride where id::text like 'b0000000-%' or driver_id::text like 'b0000000-%';
delete from public.fan_group where id::text like 'b0000000-%' or created_by::text like 'b0000000-%';

-- The accounts (profile and everything that hangs off it go with them).
delete from public.profile where id::text like 'b0000000-%';
delete from auth.users where id::text like 'b0000000-%';

select
  (select count(*) from auth.users where id::text like 'b0000000-%') as contas,
  (select count(*) from public.fan_group where id::text like 'b0000000-%') as grupos,
  (select count(*) from public.ride where id::text like 'b0000000-%') as boleias;

commit;
