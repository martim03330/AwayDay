-- Same rule as 20261008160000, without reading `new.plan_id` on fixture_plan (which has no such column): the plan id
-- is picked per table with if, never in one expression that names both.

create or replace function public.refuse_plan_change_after_kickoff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plano uuid;
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_table_name = 'fixture_plan' then
    if new.status is not distinct from old.status
       and new.ride_id is not distinct from old.ride_id
       and new.stay_plan_id is not distinct from old.stay_plan_id
       and new.stay_locked_at is not distinct from old.stay_locked_at then
      return new;
    end if;
    plano := new.id;
  else
    plano := new.plan_id;
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
