-- Deleting a group (the last member leaves, or test data is cleaned) failed whenever a private ride belonged to it:
-- ride.group_id is set to null on delete, but ride_private_needs_group says a private ride needs a group. So the last
-- person could not leave, and the group stayed forever.
--
-- Before the group goes: its rides still open are cancelled (there is no group left to go with; passengers are told
-- by the usual ride notifications), and every ride of the group stops being "only for the group". A cancelled or past
-- ride is never listed on the ride board, so nobody new sees it.

create or replace function public.release_group_rides()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ride
  set status = 'cancelled', updated_at = now()
  where group_id = old.id and visibility = 'grupo' and status = 'open';

  update public.ride
  set visibility = 'publica', updated_at = now()
  where group_id = old.id and visibility = 'grupo';

  return old;
end;
$$;

revoke execute on function public.release_group_rides() from public, anon, authenticated;

create trigger fan_group_release_rides
  before delete on public.fan_group
  for each row execute function public.release_group_rides();
