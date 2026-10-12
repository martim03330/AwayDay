-- Tests for «Esqueceste a password?»: whether an email has an account, and the limit per network address.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_email_conta.test.sql

begin;

create temporary table expect_log (name text) on commit drop;
create temporary table t_ids (key text primary key, id uuid) on commit drop;
grant insert, select, update on expect_log, t_ids to authenticated, anon;

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

create function pg_temp.id(p_key text)
returns uuid
language sql
as $$
  select id from t_ids where key = p_key;
$$;

create function pg_temp.as_user(p_id text)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values ('ad000015-0000-4000-8000-0000000000a1', 'email-conta-a@test.invalid', '{"display_name":"Email Conta"}', 'authenticated', 'authenticated');

select set_config('request.headers', '{"x-forwarded-for":"203.0.113.7, 10.0.0.1"}', true);
set local role anon;
select pg_temp.expect('an email with an account', public.email_has_account('  Email-Conta-A@test.invalid '), true);
select pg_temp.expect('an email without one', public.email_has_account('ninguem-aqui@test.invalid'), false);
select pg_temp.expect('not an email', pg_temp.refusal('select public.email_has_account(''nada'')'), 'bad_email');
select pg_temp.expect('no direct access to the hits',
  pg_temp.refusal('select count(*) from public.anon_rate_limit_hit'), 'permission denied for table anon_rate_limit_hit');

-- 20 questions an hour per address (2 were asked above).
reset role;
insert into public.anon_rate_limit_hit (bucket, client_key)
select 'email-has-account', '203.0.113.7' from generate_series(1, 18);
set local role anon;
select pg_temp.expect('the 21st question in the hour is refused',
  pg_temp.refusal('select public.email_has_account(''outro@test.invalid'')'), 'rate_limited');
select set_config('request.headers', '{"x-forwarded-for":"198.51.100.9"}', true);
select pg_temp.expect('another address can still ask', public.email_has_account('outro@test.invalid'), false);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
