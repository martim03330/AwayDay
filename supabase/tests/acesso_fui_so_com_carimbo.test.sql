-- «Fui a este jogo» only with the stadium stamp: the app cannot write 'attended', and a game is rated only after
-- stamping it.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_fui_so_com_carimbo.test.sql

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
values ('ad000016-0000-4000-8000-0000000000a1', 'carimbo-a@test.invalid', '{"display_name":"Carimbo Adepto"}', 'authenticated', 'authenticated');

-- A game that started an hour ago, at a stadium with a known location, and one still to come.
insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at)
select 'teste-carimbo-ja', f.competition_id, f.stage, f.home_club_id, f.away_club_id, v.id, now() - interval '1 hour'
from public.fixture as f
cross join lateral (select v.id from public.venue as v where v.location is not null order by v.id limit 1) as v
order by f.id limit 1;
insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at)
select 'teste-carimbo-depois', competition_id, stage, home_club_id, away_club_id, venue_id, now() + interval '2 days'
from public.fixture where id = 'teste-carimbo-ja';

set local role authenticated;
select pg_temp.as_user('ad000016-0000-4000-8000-0000000000a1');

-- 1. «Vou» before kick-off still works.
select pg_temp.expect('«vou» before kick-off',
  pg_temp.refusal($q$insert into public.fixture_attendance (profile_id, fixture_id, status)
    values ('ad000016-0000-4000-8000-0000000000a1', 'teste-carimbo-depois', 'going')$q$), 'accepted');

-- 2. The app can never say «fui» by itself.
select pg_temp.expect('no «fui» written by the app',
  pg_temp.refusal($q$insert into public.fixture_attendance (profile_id, fixture_id, status)
    values ('ad000016-0000-4000-8000-0000000000a1', 'teste-carimbo-ja', 'attended')$q$) like '%row-level security%', true);

-- 3. No rating without the stamp.
select pg_temp.expect('no rating without the stamp',
  pg_temp.refusal($q$insert into public.venue_review (profile_id, fixture_id, stadium_score, atmosphere_score, access_score)
    values ('ad000016-0000-4000-8000-0000000000a1', 'teste-carimbo-ja', 5, 5, 5)$q$) like '%row-level security%', true);

-- 4. Far from the stadium the stamp is refused; at the stadium it is given, and then «fui» and the rating follow.
select pg_temp.expect('no stamp from far away',
  pg_temp.refusal($q$select public.stamp_stadium('teste-carimbo-ja', 38.0, -9.0)$q$) <> 'accepted', true);
select public.stamp_stadium('teste-carimbo-ja', v.latitude, v.longitude)
from public.fixture as f join public.venue as v on v.id = f.venue_id where f.id = 'teste-carimbo-ja';
select pg_temp.expect('the stamp makes it «fui»',
  (select status from public.fixture_attendance
   where profile_id = 'ad000016-0000-4000-8000-0000000000a1' and fixture_id = 'teste-carimbo-ja'), 'attended');
select pg_temp.expect('with the stamp, rating works',
  pg_temp.refusal($q$insert into public.venue_review (profile_id, fixture_id, stadium_score, atmosphere_score, access_score)
    values ('ad000016-0000-4000-8000-0000000000a1', 'teste-carimbo-ja', 5, 4, 3)$q$), 'accepted');

reset role;
select count(*) as checks_passed from expect_log;

rollback;
