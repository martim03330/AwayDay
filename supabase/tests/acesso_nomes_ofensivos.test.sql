-- Tests for offensive names: the word check, and the refusal on people, groups and trips.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_nomes_ofensivos.test.sql

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

-- 1. The check itself.
select pg_temp.expect('swear word', public.is_offensive_name('Merda'), true);
select pg_temp.expect('with accents and capitals', public.is_offensive_name('O CABRÃO'), true);
select pg_temp.expect('with look-alike digits', public.is_offensive_name('c4br40'), true);
select pg_temp.expect('with repeated letters', public.is_offensive_name('merdaaaa'), true);
select pg_temp.expect('with dots between the letters', public.is_offensive_name('f.i.l.h.o d.a p.u.t.a'), true);
select pg_temp.expect('written together', public.is_offensive_name('FilhoDaPuta99'), true);
select pg_temp.expect('in English', public.is_offensive_name('Fuck you'), true);

select pg_temp.expect('a normal name', public.is_offensive_name('Martim Henriques'), false);
select pg_temp.expect('Barcelona is not «cona»', public.is_offensive_name('Barcelona'), false);
select pg_temp.expect('Cuba is not «cu»', public.is_offensive_name('Malta de Cuba'), false);
select pg_temp.expect('the caralhota bread', public.is_offensive_name('As Caralhotas'), false);
select pg_temp.expect('Computador is not «puta»', public.is_offensive_name('Computador'), false);
select pg_temp.expect('Escumalha da Luz', public.is_offensive_name('Escumalha da Luz'), false);
select pg_temp.expect('Dick Advocaat', public.is_offensive_name('Dick Advocaat'), false);
select pg_temp.expect('Picaroto', public.is_offensive_name('Picaroto'), false);

-- 2. Anyone can ask before signing up.
set local role anon;
select pg_temp.expect('anon can ask', public.name_allowed('Zé do Café'), true);
select pg_temp.expect('anon gets a no', public.name_allowed('Paneleiro'), false);

-- 3. Refused on every path.
reset role;
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values ('ad000014-0000-4000-8000-0000000000a1', 'nomes-a@test.invalid', '{"display_name":"Nomes Limpo"}', 'authenticated', 'authenticated');

set local role authenticated;
select pg_temp.as_user('ad000014-0000-4000-8000-0000000000a1');
select pg_temp.expect('a person cannot take an offensive name',
  pg_temp.refusal('select public.set_display_name(''Grande Cabrão'')'), 'bad_name');
select pg_temp.expect('a clean name still goes',
  pg_temp.refusal('select public.set_display_name(''Grande Adepto'')'), 'accepted');
select pg_temp.expect('no offensive group name',
  pg_temp.refusal('select public.create_group(''Os Fodidos'')'), 'bad_name');
insert into t_ids (key, id) values ('g', public.create_group('Os Limpos'));
select pg_temp.expect('no offensive rename',
  pg_temp.refusal(format('select public.rename_group(%L, %L)', pg_temp.id('g'), 'Merda de grupo')), 'bad_name');

reset role;
select pg_temp.expect('signing up with an offensive name fails',
  pg_temp.refusal($q$insert into auth.users (id, email, raw_user_meta_data, aud, role) values
    ('ad000014-0000-4000-8000-0000000000b1', 'nomes-b@test.invalid', '{"display_name":"Puta"}', 'authenticated', 'authenticated')$q$),
  'bad_name');

select count(*) as checks_passed from expect_log;

rollback;
