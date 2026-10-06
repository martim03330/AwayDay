-- Apaga os dados de teste criados por criar.sql. Só toca no que tem os ids fixos de teste (a0000000-…) e nas contas
-- @teste.awayday.invalid; a tua conta e o resto da base de dados ficam como estavam.
--
-- Corre com:  supabase db query --linked -f scripts/dados-de-teste/apagar.sql

begin;

-- As sessões que nasceram dos planos de teste, e as viagens passadas do histórico (e tudo o que lá foi lançado).
delete from public.trip_session
where id in (select session_id from public.fixture_plan where id::text like 'a0000000-%' and session_id is not null)
   or id::text like 'a0000000-%';

delete from public.fixture_plan where id::text like 'a0000000-%';
delete from public.stay_plan where id::text like 'a0000000-%';
delete from public.ride where id::text like 'a0000000-%';
delete from public.fan_group where id::text like 'a0000000-%';

-- As contas de teste (o perfil e o resto vão atrás).
delete from public.profile where id::text like 'a0000000-%';
delete from auth.users where email like '%@teste.awayday.invalid';

select
  (select count(*) from auth.users where email like '%@teste.awayday.invalid') as contas_de_teste,
  (select count(*) from public.fan_group where id::text like 'a0000000-%') as grupos_de_teste;

commit;
