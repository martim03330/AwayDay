-- Saying «vou» in a group plan, getting a seat in a car, or offering a car is going to the game: the game page shows
-- «Vou a este jogo» marked and the count of fans going includes them (test round, 2026-10-27: someone in the plan
-- and in the car still saw the ticket unmarked and «Menos de 5 adeptos…»).
--
-- Until now only the phone marked it, and only on some paths (asking for a seat, offering a car); a «vou» in the plan
-- card, a seat given by the driver or a seat taken from the plan never did. Now the database does it, in triggers:
--   · a «vou» in a plan, a seat accepted in a car (`ride_passenger.status = 'accepted'`) or a car offered marks the
--     game as 'going', if it has not started yet. Never touches 'attended' (on conflict do nothing).
--   · a «não vou» in a plan takes back only a 'going' for that game.
--   · leaving a car takes nothing back: the fan may still go, another way.
-- The answers and seats already given for games still to come are marked once, at the end.

/** Marks `p_fixture_id` as 'going' for this person, if it has not kicked off. Never downgrades an 'attended'. */
create function public.mark_going_to_fixture(p_profile_id uuid, p_fixture_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.fixture_attendance (profile_id, fixture_id, status)
  select p_profile_id, f.id, 'going'
  from public.fixture as f
  where f.id = p_fixture_id and f.kickoff_at > now()
  on conflict (profile_id, fixture_id) do nothing;
$$;

revoke execute on function public.mark_going_to_fixture(uuid, text) from public, anon, authenticated;

-- --- The plan's answer ------------------------------------------------------------------------------------------------

create function public.plan_answer_marks_going()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jogo text;
begin
  select fp.fixture_id into jogo from public.fixture_plan as fp where fp.id = new.plan_id;
  if jogo is null then
    return null;
  end if;
  if new.answer = 'vou' then
    perform public.mark_going_to_fixture(new.profile_id, jogo);
  elsif new.answer = 'nao' then
    delete from public.fixture_attendance as a
    where a.profile_id = new.profile_id
      and a.fixture_id = jogo
      and a.status = 'going'
      and exists (select 1 from public.fixture as f where f.id = jogo and f.kickoff_at > now());
  end if;
  return null;
end;
$$;

create trigger fixture_plan_answer_marks_going
  after insert on public.fixture_plan_answer
  for each row execute function public.plan_answer_marks_going();

-- Only a changed answer: tapping the same one again must not undo a «Vou a este jogo» taken off by hand.
create trigger fixture_plan_answer_change_marks_going
  after update of answer on public.fixture_plan_answer
  for each row
  when (old.answer is distinct from new.answer)
  execute function public.plan_answer_marks_going();

-- --- A seat in a car --------------------------------------------------------------------------------------------------

create function public.ride_seat_marks_going()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jogo text;
begin
  select r.fixture_id into jogo from public.ride as r where r.id = new.ride_id;
  if jogo is not null then
    perform public.mark_going_to_fixture(new.profile_id, jogo);
  end if;
  return null;
end;
$$;

create trigger ride_passenger_accepted_marks_going
  after insert on public.ride_passenger
  for each row
  when (new.status = 'accepted')
  execute function public.ride_seat_marks_going();

create trigger ride_passenger_accepted_change_marks_going
  after update of status on public.ride_passenger
  for each row
  when (new.status = 'accepted' and old.status is distinct from 'accepted')
  execute function public.ride_seat_marks_going();

-- --- Offering a car ---------------------------------------------------------------------------------------------------

create function public.ride_offer_marks_going()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.mark_going_to_fixture(new.driver_id, new.fixture_id);
  return null;
end;
$$;

create trigger ride_offered_marks_going
  after insert on public.ride
  for each row
  when (new.status = 'open')
  execute function public.ride_offer_marks_going();

-- --- What was already said, for the games still to come ---------------------------------------------------------------

insert into public.fixture_attendance (profile_id, fixture_id, status)
select distinct quem.profile_id, quem.fixture_id, 'going'
from (
  select a.profile_id, fp.fixture_id
  from public.fixture_plan_answer as a
  join public.fixture_plan as fp on fp.id = a.plan_id
  where a.answer = 'vou'
  union
  select rp.profile_id, r.fixture_id
  from public.ride_passenger as rp
  join public.ride as r on r.id = rp.ride_id
  where rp.status = 'accepted' and r.status = 'open'
  union
  select r.driver_id, r.fixture_id
  from public.ride as r
  where r.status = 'open'
) as quem
join public.fixture as f on f.id = quem.fixture_id
where f.kickoff_at > now()
on conflict (profile_id, fixture_id) do nothing;
