-- Deleting a group that has a game plan failed: its chat messages were deleted twice in the same statement (once by
-- the group, once by the plan, both «on delete cascade»), which Postgres refuses. Rare before; with plans now made by
-- themselves when a ride or a house is for a group (20261013160000), common. The plans go first, then the group.

create function public.delete_group_plans_first()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.fixture_plan where group_id = old.id;
  return old;
end;
$$;

revoke execute on function public.delete_group_plans_first() from public, anon, authenticated;

create trigger fan_group_delete_plans_first
  before delete on public.fan_group
  for each row execute function public.delete_group_plans_first();
