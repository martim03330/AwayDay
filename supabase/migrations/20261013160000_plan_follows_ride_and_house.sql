-- A ride or a house for a group puts the game plan in that group by itself (owner's request, 2026-10-13).
--
-- Before, a ride or a house only joined a plan that was already open in the group and that its owner had answered.
-- Now, when a ride or a house is given a group:
-- - with no open plan for that game in the group, the plan is created (by the driver or whoever proposed the house,
--   with their «vou» and the usual message in the group chat), with the ride or house already in it;
-- - with an open plan that has no ride (or no house) yet, it goes into it, and its owner is marked as going.
-- Games that already kicked off are left alone.

create function public.plan_for_group_game(p_group_id uuid, p_fixture_id text, p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  plano uuid;
  estado text;
begin
  -- One at a time per group and game, so a ride and a house at once do not make two plans.
  perform pg_advisory_xact_lock(hashtextextended('plan:' || p_group_id::text || ':' || p_fixture_id, 0));

  -- One plan per group and game (closed or cancelled ones included): a closed one is left as it is.
  select fp.id, fp.status into plano, estado
  from public.fixture_plan as fp
  where fp.group_id = p_group_id and fp.fixture_id = p_fixture_id
  limit 1;
  if plano is not null and estado <> 'aberto' then
    return null;
  end if;

  if plano is null then
    if not exists (select 1 from public.fixture as f where f.id = p_fixture_id and f.kickoff_at > now()) then
      return null;
    end if;
    insert into public.fixture_plan (group_id, fixture_id, created_by)
    values (p_group_id, p_fixture_id, p_profile_id)
    returning id into plano;
    insert into public.fixture_plan_answer (plan_id, profile_id, answer)
    values (plano, p_profile_id, 'vou')
    on conflict (plan_id, profile_id) do nothing;
    perform public.post_plan_message(plano, p_group_id, p_profile_id);
  else
    insert into public.fixture_plan_answer (plan_id, profile_id, answer)
    values (plano, p_profile_id, 'vou')
    on conflict (plan_id, profile_id) do nothing;
  end if;

  return plano;
end;
$$;

revoke execute on function public.plan_for_group_game(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.link_ride_to_open_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plano uuid;
begin
  if new.group_id is null or new.status <> 'open' then
    return null;
  end if;
  if not public.is_group_member(new.group_id, new.driver_id) then
    return null;
  end if;
  plano := public.plan_for_group_game(new.group_id, new.fixture_id, new.driver_id);
  if plano is not null then
    update public.fixture_plan
    set ride_id = new.id, updated_at = now()
    where id = plano and ride_id is null;
  end if;
  return null;
end;
$$;

create or replace function public.link_stay_to_open_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plano uuid;
begin
  if new.group_id is null then
    return null;
  end if;
  if not public.is_group_member(new.group_id, new.profile_id) then
    return null;
  end if;
  plano := public.plan_for_group_game(new.group_id, new.fixture_id, new.profile_id);
  if plano is not null then
    update public.fixture_plan
    set stay_plan_id = new.id, updated_at = now()
    where id = plano and stay_plan_id is null;
  end if;
  return null;
end;
$$;
