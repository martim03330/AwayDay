-- Apaga a conta dos testes de ponta a ponta (e2e@teste.awayday.invalid) e tudo o que os testes criaram com ela:
-- grupos, convites para jogos, sessões e, em cascata, o perfil, os clubes, o concelho e os bloqueios.
--
-- Corre com:  supabase db query --linked -f scripts/dados-de-teste/e2e-apagar.sql

begin;

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

select (select count(*) from auth.users where email = 'e2e@teste.awayday.invalid') as conta_e2e;

commit;
