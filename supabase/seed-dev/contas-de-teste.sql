-- SÓ PARA TESTE. Um grupo com contas já lançadas, para ver o ecrã «Contas da viagem» a funcionar.
--
-- Quem está no grupo:
--   Martim (martim565@gmail.com)        — a conta principal
--   Martim (martim030324@gmail.com)     — a segunda conta, para ver o outro lado
--   Zé de Teste (fictício)              — não tem password, não entra na app
--   Rita de Teste (fictícia)            — idem
--
-- Jogo: teste-carimbo-agora (Académico de Viseu x Benfica, no Fontelo, hoje).
--
-- As quatro despesas são lançadas pelas funções a sério (`open_trip_session`, `add_trip_expense`), cada uma na pele
-- de quem pagou — nada é escrito à mão nas tabelas. Uma delas (10,01 € por três) não dá divisão certa, de propósito.
--
-- Correr:   supabase db query --linked -f supabase/seed-dev/contas-de-teste.sql
-- Repetir:  correr outra vez não duplica nada.
--
-- Apagar tudo no fim:
--   delete from public.fan_group where id = 'c0c0c0c0-0000-4000-8000-000000000001';
--   delete from auth.users where id::text like 'b0000000-0000-4000-8000-00000000000%';

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000001', 'authenticated',
   'authenticated', 'teste-ze@awayday.test', '', now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Zé de Teste"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000002', 'authenticated',
   'authenticated', 'teste-rita@awayday.test', '', now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Rita de Teste"}', now(), now())
on conflict (id) do nothing;

insert into public.fan_group (id, name, created_by, invite_code, source)
values (
  'c0c0c0c0-0000-4000-8000-000000000001',
  'Viagem a Viseu (teste)',
  '027d9f21-4ebd-433a-8a4e-4cc035b0163e',
  'testecont1',
  'manual'
)
on conflict (id) do nothing;

insert into public.fan_group_member (group_id, profile_id, role)
values
  ('c0c0c0c0-0000-4000-8000-000000000001', '027d9f21-4ebd-433a-8a4e-4cc035b0163e', 'owner'),
  ('c0c0c0c0-0000-4000-8000-000000000001', '0ac746b0-cf4f-4db6-ae2b-5cc75f0fd31a', 'member'),
  ('c0c0c0c0-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'member'),
  ('c0c0c0c0-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'member')
on conflict (group_id, profile_id) do nothing;

do $$
declare
  grupo uuid := 'c0c0c0c0-0000-4000-8000-000000000001';
  jogo text := 'teste-carimbo-agora';
  martim uuid := '027d9f21-4ebd-433a-8a4e-4cc035b0163e';
  segunda uuid := '0ac746b0-cf4f-4db6-ae2b-5cc75f0fd31a';
  ze uuid := 'b0000000-0000-4000-8000-000000000001';
  rita uuid := 'b0000000-0000-4000-8000-000000000002';
  sessao uuid;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', martim), true);
  sessao := public.open_trip_session(grupo, jogo);

  if exists (select 1 from public.trip_expenses(sessao)) then
    raise notice 'As contas de teste já lá estavam. Nada a fazer.';
    return;
  end if;

  -- O jantar: pagou a conta principal, comeram os quatro. 60,00 / 4 = 15,00 certinhos.
  perform public.add_trip_expense(
    sessao, 'Jantar antes do jogo', 'refeicao', 6000, martim, array[martim, segunda, ze, rita]);

  -- A rodada: pagou a segunda conta, beberam três. 10,01 / 3 não dá divisão certa — dois pagam mais um cêntimo.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', segunda), true);
  perform public.add_trip_expense(
    sessao, 'Rodada de cervejas', 'cerveja', 1001, segunda, array[segunda, ze, rita]);

  -- As portagens: pagou o Zé, foram no carro dele só ele e a conta principal.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', ze), true);
  perform public.add_trip_expense(
    sessao, 'Portagens da A25', 'portagens', 1240, ze, array[martim, ze]);

  -- Os bilhetes: pagou a Rita, entraram os quatro.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', rita), true);
  perform public.add_trip_expense(
    sessao, 'Bilhetes da bancada', 'bilhetes', 4500, rita, array[martim, segunda, ze, rita]);

  raise notice 'Contas de teste lançadas.';
end;
$$;

-- O que a app tem de mostrar, visto pela conta principal.
select set_config('role', 'authenticated', false), set_config(
  'request.jwt.claims', '{"sub":"027d9f21-4ebd-433a-8a4e-4cc035b0163e"}', false
);

select b.display_name, b.paid_cents, b.owed_cents, b.balance_cents
from public.trip_session_of('c0c0c0c0-0000-4000-8000-000000000001', 'teste-carimbo-agora') as s
cross join lateral public.trip_balances(s.id) as b;
