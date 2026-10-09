-- Access tests for what the AI writes and the server's own books: nudge, season_recap, coach_state, ai_run,
-- rate_limit_hit, and the opt-in that decides who is sent to the third-party AI at all.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_ia.test.sql
--
-- People: A said yes to AI tips and recap, B said no (the default), C said yes to the recap only, D is an admin.

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

-- Runs a call that must be refused, and returns its message (or 'accepted').
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

-- How many rows a statement touched (0 when RLS hides the row).
create function pg_temp.affected(p_sql text)
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;

create function pg_temp.as_user(p_id text)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

create function pg_temp.as_anon()
returns void
language sql
as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('ad000003-0000-4000-8000-0000000000a1', 'acesso-ia-a@test.invalid', '{"display_name":"IA A"}', 'authenticated', 'authenticated'),
  ('ad000003-0000-4000-8000-0000000000b1', 'acesso-ia-b@test.invalid', '{"display_name":"IA B"}', 'authenticated', 'authenticated'),
  ('ad000003-0000-4000-8000-0000000000c1', 'acesso-ia-c@test.invalid', '{"display_name":"IA C"}', 'authenticated', 'authenticated'),
  ('ad000003-0000-4000-8000-0000000000d1', 'acesso-ia-d@test.invalid', '{"display_name":"IA Admin"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'ad000003-0000-4000-8000-0000000000d1';
update public.profile set nudges_enabled = true, recap_enabled = true where id = 'ad000003-0000-4000-8000-0000000000a1';
update public.profile set recap_enabled = true where id = 'ad000003-0000-4000-8000-0000000000c1';

-- What the server wrote for A.
insert into t_ids (key, id) values ('nudge', gen_random_uuid()), ('recap', gen_random_uuid());
insert into public.nudge (id, profile_id, kind, local_date, facts, body, source)
values ((select id from t_ids where key = 'nudge'), 'ad000003-0000-4000-8000-0000000000a1', 'estadio_novo',
  (now() at time zone 'Europe/Lisbon')::date, '{"venue":"teste"}', 'Estádio novo para a coleção.', 'template');
insert into public.season_recap (id, profile_id, season_id, stats, headline, body, source)
values ((select id from t_ids where key = 'recap'), 'ad000003-0000-4000-8000-0000000000a1', '2026-27', '{}',
  'A tua época', 'Foste a muitos jogos.', 'template');
insert into public.coach_state (profile_id, last_opened_at) values ('ad000003-0000-4000-8000-0000000000a1', now());
insert into public.ai_run (job) values ('nudges');
insert into public.rate_limit_hit (profile_id, bucket) values ('ad000003-0000-4000-8000-0000000000a1', 'teste');

-- 1. Anon: none of it.
set local role anon;
select pg_temp.as_anon();
select pg_temp.expect('anon cannot read nudges', pg_temp.refusal('select count(*) from public.nudge'), 'permission denied for table nudge');
select pg_temp.expect('anon cannot read recaps', pg_temp.refusal('select count(*) from public.season_recap'), 'permission denied for table season_recap');
select pg_temp.expect('anon cannot read coach state', pg_temp.refusal('select count(*) from public.coach_state'), 'permission denied for table coach_state');
select pg_temp.expect('anon cannot read AI runs', pg_temp.refusal('select count(*) from public.ai_run'), 'permission denied for table ai_run');
select pg_temp.expect('anon cannot read rate limits', pg_temp.refusal('select count(*) from public.rate_limit_hit'), 'permission denied for table rate_limit_hit');

-- 2. A reads what was written for A, and may only mark it read or shared.
set local role authenticated;
select pg_temp.as_user('ad000003-0000-4000-8000-0000000000a1');
select pg_temp.expect('A reads their nudge', (select count(*)::integer from public.nudge), 1);
select pg_temp.expect('A marks the nudge read', pg_temp.affected('update public.nudge set read_at = now()'), 1);
select pg_temp.expect('A cannot rewrite the nudge', pg_temp.refusal('update public.nudge set body = ''Outra coisa'''), 'permission denied for table nudge');
select pg_temp.expect('A cannot write nudges', pg_temp.refusal(
  'insert into public.nudge (profile_id, kind, local_date, facts, body, source) values (''ad000003-0000-4000-8000-0000000000a1'', ''estadio_novo'', current_date, ''{}'', ''x'', ''template'')'),
  'permission denied for table nudge');
select pg_temp.expect('A cannot delete nudges', pg_temp.refusal('delete from public.nudge'), 'permission denied for table nudge');
select pg_temp.expect('A cannot move a nudge to someone else', pg_temp.refusal('update public.nudge set profile_id = ''ad000003-0000-4000-8000-0000000000b1'''),
  'permission denied for table nudge');

select pg_temp.expect('A reads their recap', (select headline from public.season_recap), 'A tua época');
select pg_temp.expect('A marks the recap shared', pg_temp.affected('update public.season_recap set shared_at = now()'), 1);
select pg_temp.expect('A cannot rewrite the recap', pg_temp.refusal('update public.season_recap set body = ''Fui a todos'''),
  'permission denied for table season_recap');
select pg_temp.expect('A cannot change the recap stats', pg_temp.refusal('update public.season_recap set stats = ''{"jogos": 99}'''),
  'permission denied for table season_recap');
select pg_temp.expect('A cannot write recaps', pg_temp.refusal(
  'insert into public.season_recap (profile_id, season_id, stats, headline, body, source) values (''ad000003-0000-4000-8000-0000000000a1'', ''x'', ''{}'', ''x'', ''x'', ''template'')'),
  'permission denied for table season_recap');
select pg_temp.expect('A cannot delete recaps', pg_temp.refusal('delete from public.season_recap'), 'permission denied for table season_recap');

select pg_temp.expect('A reads their coach state', (select count(*)::integer from public.coach_state), 1);
select pg_temp.expect('A cannot change their coach state', pg_temp.refusal('update public.coach_state set last_message_at = null'),
  'permission denied for table coach_state');
select pg_temp.expect('A cannot write coach state', pg_temp.refusal('insert into public.coach_state (profile_id) values (''ad000003-0000-4000-8000-0000000000a1'')'),
  'permission denied for table coach_state');

select pg_temp.expect('A cannot read AI runs', pg_temp.refusal('select count(*) from public.ai_run'), 'permission denied for table ai_run');
select pg_temp.expect('A cannot read their rate limits', pg_temp.refusal('select count(*) from public.rate_limit_hit'),
  'permission denied for table rate_limit_hit');
select pg_temp.expect('A cannot reset their rate limits', pg_temp.refusal('delete from public.rate_limit_hit'),
  'permission denied for table rate_limit_hit');
select pg_temp.expect('A cannot fill someone''s rate limit', pg_temp.refusal(
  'insert into public.rate_limit_hit (profile_id, bucket) values (''ad000003-0000-4000-8000-0000000000b1'', ''feedback'')'),
  'permission denied for table rate_limit_hit');

-- 3. B sees nothing of A's and changes nothing.
select pg_temp.as_user('ad000003-0000-4000-8000-0000000000b1');
select pg_temp.expect('B sees no nudges of A', (select count(*)::integer from public.nudge), 0);
select pg_temp.expect('B marks none of A''s nudges', pg_temp.affected('update public.nudge set read_at = null'), 0);
select pg_temp.expect('B sees no recap of A', (select count(*)::integer from public.season_recap), 0);
select pg_temp.expect('B shares none of A''s recaps', pg_temp.affected('update public.season_recap set shared_at = null'), 0);
select pg_temp.expect('B sees no coach state of A', (select count(*)::integer from public.coach_state), 0);

-- 4. Admins get no back door either.
select pg_temp.as_user('ad000003-0000-4000-8000-0000000000d1');
select pg_temp.expect('the admin sees no one''s nudges', (select count(*)::integer from public.nudge), 0);
select pg_temp.expect('the admin sees no one''s recap', (select count(*)::integer from public.season_recap), 0);
select pg_temp.expect('the admin cannot read AI runs', pg_temp.refusal('select count(*) from public.ai_run'), 'permission denied for table ai_run');

-- 5. The server-side AI functions are not callable from the app.
select pg_temp.expect('coach_context is server-only',
  pg_temp.refusal('select public.coach_context(''ad000003-0000-4000-8000-0000000000a1'', now())'),
  'permission denied for function coach_context');
select pg_temp.expect('coach_push_candidates is server-only',
  pg_temp.refusal('select count(*) from public.coach_push_candidates(now())'),
  'permission denied for function coach_push_candidates');
select pg_temp.expect('season_recap_candidates is server-only',
  pg_temp.refusal('select count(*) from public.season_recap_candidates(''2026-27'')'),
  'permission denied for function season_recap_candidates');
select pg_temp.expect('season_recap_stats is server-only',
  pg_temp.refusal('select public.season_recap_stats(''ad000003-0000-4000-8000-0000000000a1'', ''2026-27'')'),
  'permission denied for function season_recap_stats');
select pg_temp.expect('ai_usage_since is server-only',
  pg_temp.refusal('select count(*) from public.ai_usage_since(now(), null)'),
  'permission denied for function ai_usage_since');
select pg_temp.expect('take_rate_limit is server-only',
  pg_temp.refusal('select public.take_rate_limit(''ad000003-0000-4000-8000-0000000000b1'', ''feedback'', 0, interval ''1 day'')'),
  'permission denied for function take_rate_limit');

-- 6. The opt-in: only people who said yes are handed to the AI jobs.
reset role;
insert into public.device_token (token, profile_id, platform)
values
  ('ExponentPushToken[acesso-ia-a]', 'ad000003-0000-4000-8000-0000000000a1', 'ios'),
  ('ExponentPushToken[acesso-ia-b]', 'ad000003-0000-4000-8000-0000000000b1', 'ios'),
  ('ExponentPushToken[acesso-ia-c]', 'ad000003-0000-4000-8000-0000000000c1', 'ios');
insert into public.place_visit (profile_id, place_id, source)
select pr.id, (select pl.id from public.place as pl order by pl.id limit 1), 'manual'
from public.profile as pr
where pr.id in ('ad000003-0000-4000-8000-0000000000a1', 'ad000003-0000-4000-8000-0000000000b1',
                'ad000003-0000-4000-8000-0000000000c1');
select pg_temp.expect('B (no yes) is never a coach candidate',
  (select count(*)::integer from public.coach_push_candidates(now())
   where profile_id = 'ad000003-0000-4000-8000-0000000000b1'), 0);
select pg_temp.expect('C (recap yes, tips no) is never a coach candidate',
  (select count(*)::integer from public.coach_push_candidates(now())
   where profile_id = 'ad000003-0000-4000-8000-0000000000c1'), 0);
select pg_temp.expect('of the three, only C gets a recap (A has one, B said no)',
  (select string_agg(profile_id::text, ',') from public.season_recap_candidates(public.current_season_id())
   where profile_id::text like 'ad000003-%'), 'ad000003-0000-4000-8000-0000000000c1');
update public.profile set recap_enabled = false where id = 'ad000003-0000-4000-8000-0000000000c1';
select pg_temp.expect('switching the recap off takes C out',
  (select count(*)::integer from public.season_recap_candidates(public.current_season_id())
   where profile_id::text like 'ad000003-%'), 0);

-- 7. Clients can't switch the opt-in on for someone else.
set local role authenticated;
select pg_temp.as_user('ad000003-0000-4000-8000-0000000000a1');
select pg_temp.expect('A cannot switch on B''s AI tips',
  pg_temp.affected('update public.profile set nudges_enabled = true where id = ''ad000003-0000-4000-8000-0000000000b1'''), 0);
reset role;
select pg_temp.expect('B still has AI tips off',
  (select nudges_enabled from public.profile where id = 'ad000003-0000-4000-8000-0000000000b1'), false);

select count(*) as checks_passed from expect_log;

rollback;
