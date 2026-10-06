-- One invite per game in each group.
--
-- A group could end up with two invites for the same game in its chat: inviting again re-posted the card of the plan
-- it already had, and a plan from another group could be sent to a group that already had its own for that game.
-- Now both are refused with 'plan_exists', and the error's detail carries the plan the group already has, so the
-- app can open it.

/** The open (not cancelled) plan a group sees for a game: its own, or one sent to it. `null` when there is none. */
create function public.group_plan_for_fixture(p_group_id uuid, p_fixture_id text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select fp.id
  from public.fixture_plan as fp
  where fp.fixture_id = p_fixture_id
    and fp.status <> 'cancelado'
    and (
      fp.group_id = p_group_id
      or exists (
        select 1 from public.fixture_plan_group as fg
        where fg.plan_id = fp.id and fg.group_id = p_group_id
      )
    )
  order by (fp.group_id = p_group_id) desc, fp.created_at
  limit 1;
$$;

revoke execute on function public.group_plan_for_fixture(uuid, text) from public, anon, authenticated;

create or replace function public.invite_group_to_fixture(p_group_id uuid, p_fixture_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  apito timestamptz;
  plano uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.is_group_member(p_group_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select f.kickoff_at into apito from public.fixture as f where f.id = p_fixture_id;
  if apito is null then
    raise exception 'fixture_not_found' using errcode = 'P0002';
  end if;
  if apito < now() then
    raise exception 'fixture_over' using errcode = '22023';
  end if;

  plano := public.group_plan_for_fixture(p_group_id, p_fixture_id);
  if plano is not null then
    raise exception 'plan_exists' using errcode = '22023', detail = plano::text;
  end if;

  if not public.take_rate_limit(caller, 'fixture-plan', 30, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.fixture_plan (group_id, fixture_id, created_by)
  values (p_group_id, p_fixture_id, caller)
  returning id into plano;

  insert into public.fixture_plan_answer (plan_id, profile_id, answer)
  values (plano, caller, 'vou')
  on conflict (plan_id, profile_id) do nothing;

  perform public.post_plan_message(plano, p_group_id, caller);
  return plano;
end;
$$;

create or replace function public.share_fixture_plan(p_plan_id uuid, p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
  existente uuid;
begin
  select * into plano from public.fixture_plan where id = p_plan_id;
  if plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.created_by is distinct from caller then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if plano.status <> 'aberto' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;
  if not public.is_group_member(p_group_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_group_id = plano.group_id then
    raise exception 'same_group' using errcode = '22023';
  end if;

  -- That group already has an invite for this game: this one, sent before, or another.
  existente := public.group_plan_for_fixture(p_group_id, plano.fixture_id);
  if existente is not null then
    raise exception 'plan_exists' using errcode = '22023', detail = existente::text;
  end if;

  if not public.take_rate_limit(caller, 'fixture-plan', 30, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.fixture_plan_group (plan_id, group_id, shared_by)
  values (p_plan_id, p_group_id, caller)
  on conflict (plan_id, group_id) do nothing;

  perform public.post_plan_message(p_plan_id, p_group_id, caller);
end;
$$;
