-- Viagens da Casa: a manager can open a published «só sócios» trip to every fan of the club, or make an open trip
-- «só sócios» again. Bookings already made stay as they are; only new bookings follow the change.

/**
 * Turn «só sócios» on or off for a trip (managers only, not for a cancelled trip). Turning it on creates the Casa's
 * member code the first time, like `create_club_trip`.
 */
create function public.set_club_trip_members_only(p_trip_id uuid, p_members_only boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viagem public.club_trip := public.club_trip_for_manager(p_trip_id);
begin
  if p_members_only is null then
    raise exception 'bad_members_only' using errcode = '22023';
  end if;
  if viagem.status = 'cancelled' then
    raise exception 'trip_cancelled' using errcode = '22023';
  end if;
  if viagem.members_only = p_members_only then
    return;
  end if;
  if p_members_only then
    update public.supporters_club set member_code = public.new_invite_code()
    where id = viagem.supporters_club_id and member_code is null;
  end if;
  update public.club_trip set members_only = p_members_only where id = p_trip_id;
end;
$$;

revoke execute on function public.set_club_trip_members_only(uuid, boolean) from public, anon;
grant execute on function public.set_club_trip_members_only(uuid, boolean) to authenticated;
