-- A plan stops changing once its game kicks off: no more answers, no sending it to another group, no house votes,
-- and no changing its status, car or house. It stays as a record of who went. The app shows it read-only; this is
-- the server's side, so an old screen or a direct call cannot change it either.
--
-- Only people are stopped (auth.uid() set, also through the RPCs, which run as definer but keep the caller's JWT).
-- Server jobs and cascades (auth.uid() null) still work, and leaving (deleting an answer, taking a plan back from a
-- group) is never blocked.

create or replace function public.refuse_plan_change_after_kickoff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plano uuid := case when tg_table_name = 'fixture_plan' then new.id else new.plan_id end;
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_table_name = 'fixture_plan'
     and new.status is not distinct from old.status
     and new.ride_id is not distinct from old.ride_id
     and new.stay_plan_id is not distinct from old.stay_plan_id
     and new.stay_locked_at is not distinct from old.stay_locked_at then
    return new;
  end if;
  if exists (
    select 1
    from public.fixture_plan as fp
    join public.fixture as f on f.id = fp.fixture_id
    where fp.id = plano and f.kickoff_at <= now()
  ) then
    raise exception 'fixture_over' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function public.refuse_plan_change_after_kickoff() from public, anon, authenticated;

create trigger fixture_plan_frozen_after_kickoff
  before update on public.fixture_plan
  for each row execute function public.refuse_plan_change_after_kickoff();

create trigger fixture_plan_answer_frozen_after_kickoff
  before insert or update on public.fixture_plan_answer
  for each row execute function public.refuse_plan_change_after_kickoff();

create trigger fixture_plan_group_frozen_after_kickoff
  before insert on public.fixture_plan_group
  for each row execute function public.refuse_plan_change_after_kickoff();

create trigger fixture_plan_house_vote_frozen_after_kickoff
  before insert or update on public.fixture_plan_house_vote
  for each row execute function public.refuse_plan_change_after_kickoff();
