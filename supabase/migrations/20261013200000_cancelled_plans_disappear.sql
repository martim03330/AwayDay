-- Giving up on a plan («Desistir do plano») deletes it, instead of keeping it as «cancelado». Testers saw the invite
-- stay in the group's chat (as a line) and the people who had said «vou» stay in it. Deleting the plan takes with it,
-- through the existing `on delete cascade`, everything that hangs from it: the invite messages in every group it was
-- sent to (which also tells the open chats, via group_message_broadcast), the answers («vou», «talvez»), the groups it
-- was shared with, the houses proposed for it and their votes. The car and the house themselves stay: they belong to
-- their driver and owner, not to the plan.
--
-- Same rules as before otherwise: only who invited, and never once the game has started (the frozen-after-kickoff
-- trigger only guarded updates, so it is checked here). A trip session the plan had opened stays, as it did for a
-- cancelled plan: it belongs to the ride or the group, and holds the expenses.

create or replace function public.set_fixture_plan_status(p_plan_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
begin
  select * into plano from public.fixture_plan where id = p_plan_id for update;
  if plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.created_by is distinct from caller then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if p_status not in ('aberto', 'fechado', 'cancelado') then
    raise exception 'bad_status' using errcode = '22023';
  end if;
  if plano.status = 'cancelado' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;

  if p_status = 'cancelado' then
    if exists (
      select 1 from public.fixture as f where f.id = plano.fixture_id and f.kickoff_at <= now()
    ) then
      raise exception 'fixture_over' using errcode = '22023';
    end if;
    delete from public.fixture_plan where id = p_plan_id;
    return;
  end if;

  update public.fixture_plan
  set status = p_status,
      closed_reason = case when p_status = 'fechado' then 'manual' end,
      closed_at = case when p_status = 'fechado' then now() end,
      updated_at = now()
  where id = p_plan_id;
end;
$$;

-- The plans given up on before this change go the same way.
delete from public.fixture_plan where status = 'cancelado';
