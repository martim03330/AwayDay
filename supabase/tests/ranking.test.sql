-- Tests for the ranking (migration 20261005170549_ranking.sql).
--
-- Runs inside a transaction that is always rolled back: nothing stays in the database. Every check raises an
-- exception when it fails, so the run stops at the first wrong number.
--
--   supabase db query --linked -f supabase/tests/ranking.test.sql
--
-- To check a migration before pushing it, run it in the same transaction:
--   (echo 'begin;'; cat supabase/migrations/<file>.sql; sed '1,/^begin;$/d' supabase/tests/ranking.test.sql) > /tmp/t.sql

begin;

create temporary table expect_log (name text, ok boolean) on commit drop;

create function pg_temp.expect(p_name text, p_actual anyelement, p_expected anyelement)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAILED %: got %, expected %', p_name, p_actual, p_expected;
  end if;
  insert into expect_log values (p_name, true);
end;
$$;

-- 1. The level curve.
select pg_temp.expect('level of 0 XP', public.ranking_level(0), 1);
select pg_temp.expect('level of negative XP', public.ranking_level(-50), 1);
select pg_temp.expect('level just under 100', public.ranking_level(99), 1);
select pg_temp.expect('level at 100', public.ranking_level(100), 2);
select pg_temp.expect('level just under 700', public.ranking_level(699), 4);
select pg_temp.expect('level at 700', public.ranking_level(700), 5);
select pg_temp.expect('level at 2 700', public.ranking_level(2700), 10);
select pg_temp.expect('level at 10 450', public.ranking_level(10450), 20);
select pg_temp.expect('level at 40 949', public.ranking_level(40949), 39);
select pg_temp.expect('level at 40 950', public.ranking_level(40950), 40);
select pg_temp.expect('level is capped at 99', public.ranking_level(100000000), 99);
select pg_temp.expect('floor of level 1', public.ranking_level_floor(1), 0);
select pg_temp.expect('floor of level 5', public.ranking_level_floor(5), 700);
select pg_temp.expect('floor past the cap', public.ranking_level_floor(150), public.ranking_level_floor(99));

-- Every threshold up to 99 lands exactly on its level, and one point less is the level below.
do $$
begin
  for l in 2 .. 99 loop
    perform pg_temp.expect('threshold ' || l, public.ranking_level(public.ranking_level_floor(l)), l);
    perform pg_temp.expect('below threshold ' || l, public.ranking_level(public.ranking_level_floor(l) - 1), l - 1);
  end loop;
end;
$$;

-- 2. Division spots.
select pg_temp.expect('no one active: nobody moves', (public.division_spots(0)).up, 0);
select pg_temp.expect('one active: one may go up', (public.division_spots(1)).up, 1);
select pg_temp.expect('four active: nobody goes down', (public.division_spots(4)).down, 0);
select pg_temp.expect('five active: one goes down', (public.division_spots(5)).down, 1);
select pg_temp.expect('eleven active: three go up', (public.division_spots(11)).up, 3);
select pg_temp.expect('eleven active: two go down', (public.division_spots(11)).down, 2);

-- 3. People and places for the XP checks. Three stadiums in three different districts; the first hosts a fixture
-- whose away club is A's club.
create temporary table t_ids on commit drop as
with game as (
  select f.id as fixture_id, f.venue_id, f.away_club_id, v.district
  from public.fixture as f
  join public.venue as v on v.id = f.venue_id
  where v.region <> 'abroad' and v.district is not null
  order by f.kickoff_at desc
  limit 1
),
others as (
  select v.id, v.district, row_number() over (order by v.id) as n
  from public.venue as v, game as g
  where v.region <> 'abroad' and v.district is not null and v.district <> g.district
    and v.id in (select distinct on (v2.district) v2.id from public.venue as v2 order by v2.district, v2.id)
),
tascos as (
  select p.id, row_number() over (order by p.id) as n from public.place as p order by p.id limit 2
)
select
  'a0000000-0000-4000-8000-00000000000a'::uuid as a,
  'b0000000-0000-4000-8000-00000000000b'::uuid as b,
  'c0000000-0000-4000-8000-00000000000c'::uuid as c,
  g.fixture_id, g.venue_id as v1, g.away_club_id as club,
  (select o.id from others as o where o.n = 1) as v2,
  (select o.id from others as o where o.n = 2) as v3,
  (select t.id from tascos as t where t.n = 1) as tasco_p,
  (select t.id from tascos as t where t.n = 2) as tasco_q
from game as g;

select pg_temp.expect('test data has three venues', (select v3 is not null and v2 is not null from t_ids), true);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
select u.id, u.email, jsonb_build_object('display_name', u.name), 'authenticated', 'authenticated'
from t_ids,
  lateral (values (a, 'ranking-a@test.invalid', 'Teste A'), (b, 'ranking-b@test.invalid', 'Teste B'),
                  (c, 'ranking-c@test.invalid', 'Teste C')) as u(id, email, name);

update public.profile set show_in_rankings = true where id in (select a from t_ids union select b from t_ids);
insert into public.profile_club (profile_id, relation, club_id) select a, 'supporter', club from t_ids;

-- Fixed weekly challenges for this week, so the totals do not depend on the random pick.
delete from public.weekly_challenge
where week_start = date_trunc('week', now() at time zone 'Europe/Lisbon')::date;
insert into public.weekly_challenge (week_start, slot, mission_id)
select date_trunc('week', now() at time zone 'Europe/Lisbon')::date, s, m
from (values (1, 'semana-um-jogo'), (2, 'semana-dois-tascos'), (3, 'semana-avaliar')) as x(s, m);

-- A: three stadiums (one of them away), three check-ins in one tasco on the same day, two tasco ratings.
insert into public.stadium_visit (profile_id, venue_id, fixture_id, visited_on)
select a, v1, fixture_id, (now() at time zone 'Europe/Lisbon')::date from t_ids
union all select a, v2, null, (now() at time zone 'Europe/Lisbon')::date from t_ids
union all select a, v3, null, (now() at time zone 'Europe/Lisbon')::date from t_ids;

insert into public.place_visit (profile_id, place_id, visited_at, source)
select a, tasco_p, now() - make_interval(mins => m), 'check-in'
from t_ids, generate_series(1, 3) as m;

insert into public.place_rating (profile_id, place_id, score)
select a, tasco_p, 4 from t_ids union all select a, tasco_q, 5 from t_ids;

-- B: one stadium. C: two stadiums, but hidden from rankings.
insert into public.stadium_visit (profile_id, venue_id, visited_on)
select b, v2, (now() at time zone 'Europe/Lisbon')::date from t_ids
union all select c, v2, (now() at time zone 'Europe/Lisbon')::date from t_ids
union all select c, v3, (now() at time zone 'Europe/Lisbon')::date from t_ids;

-- A's XP, piece by piece:
--   3 stamps 300 · 3 first visits 450 · away 50 · 2 check-ins (third one same day) 40 · 1 rating 10 (the other
--   tasco had no check-in) · tres-estadios 150 · tres-distritos 150 · primeira-deslocacao 100 ·
--   epoca-dois-estadios-novos 250 · weekly semana-um-jogo 75 · weekly semana-avaliar 50  = 1 625
select pg_temp.expect('A total XP', (select total_xp from public.ranking_totals((select a from t_ids), public.current_season_id())), 1625);
select pg_temp.expect('A season XP', (select season_xp from public.ranking_totals((select a from t_ids), public.current_season_id())), 1625);
select pg_temp.expect('only two check-ins a day give XP',
  (select count(*)::integer from public.ranking_xp((select a from t_ids)) where points = 20), 2);
select pg_temp.expect('rating without a check-in gives nothing',
  (select count(*)::integer from public.ranking_activity((select a from t_ids)) where metric = 'review'), 1);
select pg_temp.expect('weekly challenge not reached',
  (select completed_at is null from public.ranking_progress((select a from t_ids)) where mission_id = 'semana-dois-tascos'), true);

-- B: 100 + 150 + weekly semana-um-jogo 75 = 325.
select pg_temp.expect('B total XP', (select total_xp from public.ranking_totals((select b from t_ids), null)), 325);

-- 4. What A sees.
select set_config('request.jwt.claims', json_build_object('sub', (select a from t_ids), 'role', 'authenticated')::text, true);

select pg_temp.expect('my level', (select level from public.my_ranking()), 7);
select pg_temp.expect('my level floor', (select level_xp from public.my_ranking()), 1350);
select pg_temp.expect('my next level', (select next_level_xp from public.my_ranking()), 1750);
select pg_temp.expect('my division starts at 5', (select division from public.my_ranking()), 5::smallint);
select pg_temp.expect('my stadiums', (select stadiums from public.my_ranking()), 3);
select pg_temp.expect('my streak', (select streak_weeks from public.my_ranking()), 1);
select pg_temp.expect('I lead my division', (select division_position from public.my_ranking()), 1);

select pg_temp.expect('C is hidden from the table',
  (select count(*)::integer from public.ranking_leaderboard('geral', 'epoca', 100) where display_name = 'Teste C'), 0);
select pg_temp.expect('A first, B second',
  (select string_agg(display_name, ',' order by rank_position) from public.ranking_leaderboard('geral', 'epoca', 100)
   where display_name like 'Teste _'), 'Teste A,Teste B');
select pg_temp.expect('club table only has my club',
  (select count(*)::integer from public.ranking_leaderboard('clube', 'epoca', 100) where display_name = 'Teste B'), 0);
select pg_temp.expect('no friends yet: only me',
  (select string_agg(display_name, ',') from public.ranking_leaderboard('amigos', 'sempre', 100)), 'Teste A');

insert into public.friendship (requester_id, addressee_id, status) select a, b, 'aceite' from t_ids;
select pg_temp.expect('a friend shows up',
  (select count(*)::integer from public.ranking_leaderboard('amigos', 'sempre', 100)), 2);

select pg_temp.expect('my missions: achievement progress',
  (select progress from public.my_missions() where mission_id = 'dez-estadios'), 3);
select pg_temp.expect('my missions: progress is capped at the target',
  (select progress from public.my_missions() where mission_id = 'tres-estadios'), 3);
select pg_temp.expect('my missions: this week has three challenges',
  (select count(*)::integer from public.my_missions()
   where week_start = date_trunc('week', now() at time zone 'Europe/Lisbon')::date), 3);

do $$
begin
  perform public.ranking_leaderboard('tudo', 'epoca', 10);
  raise exception 'FAILED bad scope was accepted';
exception when sqlstate '22023' then
  insert into expect_log values ('bad scope refused', true);
end;
$$;

-- 5. Aggregates stay hidden under five people.
select pg_temp.expect('attendance hidden under five people', (select count(*)::integer from public.season_attendance()), 0);

-- 6. Closing seasons: two past seasons, the second ending right before the current one.
insert into public.season (id, starts_on, ends_on)
values ('2024-25', '2024-07-01', '2025-06-30'), ('2025-26', '2025-07-01', '2026-06-30')
on conflict (id) do nothing;

-- In 2024-25, A: three new stadiums (well over 500 XP); B: one (250). Only A goes up.
insert into public.stadium_visit (profile_id, venue_id, visited_on, created_at)
select a, v1, date '2025-01-10', timestamptz '2025-01-10 15:00+00' from t_ids
union all select a, v2, '2025-01-17', '2025-01-17 15:00+00' from t_ids
union all select a, v3, '2025-01-24', '2025-01-24 15:00+00' from t_ids
union all select b, v1, '2025-01-10', '2025-01-10 15:00+00' from t_ids;

select public.close_finished_seasons();

select pg_temp.expect('A promoted for 2025-26',
  (select division from public.season_division where profile_id = (select a from t_ids) and season_id = '2025-26'), 4::smallint);
select pg_temp.expect('A marked as promoted',
  (select movement from public.season_division where profile_id = (select a from t_ids) and season_id = '2025-26'), 1::smallint);
select pg_temp.expect('B stays in division 5 (no row)',
  (select count(*)::integer from public.season_division where profile_id = (select b from t_ids) and season_id = '2025-26'), 0);
-- No points in 2025-26: A drops back.
select pg_temp.expect('A relegated for 2026-27 after a blank season',
  (select division from public.season_division where profile_id = (select a from t_ids) and season_id = '2026-27'), 5::smallint);
select pg_temp.expect('A marked as relegated',
  (select movement from public.season_division where profile_id = (select a from t_ids) and season_id = '2026-27'), -1::smallint);
select pg_temp.expect('closing twice changes nothing', public.close_finished_seasons(), 0);

select count(*) as checks_passed from expect_log;

rollback;
