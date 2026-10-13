-- Tests for the profile name of new accounts (migration 20261013190000): the name typed on the email form, the one
-- Google sends, and the fallbacks for Apple (no name) and for offensive names. Never part of the email.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/conta_social_nome.test.sql

begin;

create temporary table expect_log (name text) on commit drop;

create function pg_temp.expect(p_name text, p_actual anyelement, p_expected anyelement)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAILED %: got %, expected %', p_name, p_actual, p_expected;
  end if;
  insert into expect_log values (p_name);
end;
$$;

create function pg_temp.refusal(p_sql text)
returns text
language plpgsql
as $$
declare
  mensagem text;
begin
  execute p_sql;
  return 'accepted';
exception when others then
  get stacked diagnostics mensagem = message_text;
  return mensagem;
end;
$$;

create function pg_temp.new_user(p_id uuid, p_email text, p_meta jsonb)
returns text
language plpgsql
as $$
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (p_id, p_email, p_meta, 'authenticated', 'authenticated');
  return (select display_name from public.profile where id = p_id);
end;
$$;

select pg_temp.expect('the name typed on the email form',
  pg_temp.new_user('ad000019-0000-4000-8000-0000000000a1', 'social-a@test.invalid', '{"display_name":"Zé Adepto"}'),
  'Zé Adepto');
select pg_temp.expect('Google: full_name',
  pg_temp.new_user('ad000019-0000-4000-8000-0000000000a2', 'social-b@test.invalid',
    '{"full_name":"Maria Silva","name":"Maria S.","iss":"https://accounts.google.com"}'),
  'Maria Silva');
select pg_temp.expect('only name',
  pg_temp.new_user('ad000019-0000-4000-8000-0000000000a3', 'social-c@test.invalid', '{"name":"  Rui   Costa "}'),
  'Rui Costa');
select pg_temp.expect('Apple without a name: Adepto, never the email',
  pg_temp.new_user('ad000019-0000-4000-8000-0000000000a4', 'joao.pereira@privaterelay.appleid.com',
    '{"iss":"https://appleid.apple.com","email":"joao.pereira@privaterelay.appleid.com"}'),
  'Adepto');
select pg_temp.expect('a long name keeps the first and last words',
  pg_temp.new_user('ad000019-0000-4000-8000-0000000000a5', 'social-e@test.invalid',
    '{"full_name":"Maria da Conceição Fernandes Rodrigues dos Santos Silva"}'),
  'Maria Silva');
select pg_temp.expect('an offensive Google name: Adepto, and the sign-in still works',
  pg_temp.new_user('ad000019-0000-4000-8000-0000000000a6', 'social-f@test.invalid', '{"full_name":"Filho da Puta"}'),
  'Adepto');
select pg_temp.expect('an offensive full_name falls to a clean name',
  pg_temp.new_user('ad000019-0000-4000-8000-0000000000a7', 'social-g@test.invalid',
    '{"full_name":"Merda","name":"Ana Lopes"}'),
  'Ana Lopes');
select pg_temp.expect('a typed offensive name still fails the sign-up',
  pg_temp.refusal($q$select pg_temp.new_user('ad000019-0000-4000-8000-0000000000a8', 'social-h@test.invalid',
    '{"display_name":"Puta"}')$q$),
  'bad_name');

select count(*) as checks_passed from expect_log;

rollback;
