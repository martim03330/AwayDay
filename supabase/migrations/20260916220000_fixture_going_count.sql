-- How many fans said "Vou a este jogo" in the app. Like every aggregate, the number is only published from 5 people
-- up (below that it could point at someone); the function returns null instead.

create function public.fixture_going_count(p_fixture_id text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when count(*) >= 5 then count(*)::integer end
  from public.fixture_attendance as a
  where a.fixture_id = p_fixture_id and a.status in ('going', 'attended');
$$;

revoke execute on function public.fixture_going_count(text) from public;
grant execute on function public.fixture_going_count(text) to anon, authenticated;
