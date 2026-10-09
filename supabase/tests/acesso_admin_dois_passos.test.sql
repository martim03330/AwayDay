-- Admin powers need the second factor (2026-10-09): a profile marked admin is only an admin in a session verified with
-- an authenticator app (the JWT says aal2). With the password alone (aal1) it is an ordinary account.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_admin_dois_passos.test.sql

begin;

create temporary table expect_log (name text) on commit drop;
grant insert, select on expect_log to authenticated, anon;

create function pg_temp.expect(p_name text, p_actual anyelement, p_expected anyelement)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAILED %: got %, expected %', p_name, p_actual, p_expected;
  end if;
  insert into expect_log (name) values (p_name);
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

create function pg_temp.as_user(p_id text, p_aal text)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values ('ad00000d-0000-4000-8000-0000000000d1', 'admin-2fa@test.invalid', '{"display_name":"Admin 2FA"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'ad00000d-0000-4000-8000-0000000000d1';
insert into public.feedback (profile_id, kind, area, body)
values (null, 'erro', 'outro', 'Uma mensagem de teste para a caixa de entrada.');

set local role authenticated;

select pg_temp.as_user('ad00000d-0000-4000-8000-0000000000d1', 'aal1');
select pg_temp.expect('with the password only, an admin is not an admin', public.is_admin(), false);
select pg_temp.expect('without the second factor, the feedback inbox stays empty',
  (select count(*)::integer from public.feedback_inbox(null)), 0);

select pg_temp.as_user('ad00000d-0000-4000-8000-0000000000d1', 'aal2');
select pg_temp.expect('after the authenticator code, the admin is an admin', public.is_admin(), true);
select pg_temp.expect('and sees the feedback inbox',
  (select count(*)::integer from public.feedback_inbox(null) where body = 'Uma mensagem de teste para a caixa de entrada.'), 1);

select pg_temp.as_user('ad00000d-0000-4000-8000-0000000000d1', null);
select pg_temp.expect('a token with no assurance level is not an admin', public.is_admin(), false);

reset role;
select count(*) as checks_passed from expect_log;

rollback;
