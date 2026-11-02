-- The passenger list of a trip for the Casa's managers, with each person's name.
--
-- Reading club_trip_booking directly gives ids only, and the profile cards hide anyone the manager does not know.
-- A manager has to see who is on the bus, so this function gives the name (and nothing else about the person: no
-- avatar, no city, no location, no profile id). Cancelled bookings are left out. Managers of that Casa only.

create function public.club_trip_bookings(p_trip_id uuid)
returns table (
  booking_id uuid,
  display_name text,
  is_manual boolean,
  stop_id uuid,
  vehicle_id uuid,
  companions text[],
  people integer,
  status text,
  paid boolean,
  boarded boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  casa uuid;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select supporters_club_id into casa from public.club_trip where id = p_trip_id;
  if casa is null or not public.is_supporters_club_manager(casa) then
    raise exception 'not_manager' using errcode = '42501';
  end if;

  return query
  select
    b.id,
    coalesce(b.manual_name, p.display_name, 'Um adepto'),
    b.manual_name is not null,
    b.stop_id,
    b.vehicle_id,
    b.companions,
    b.people,
    b.status,
    b.paid_at is not null,
    b.boarded_at is not null
  from public.club_trip_booking as b
  left join public.profile as p on p.id = b.profile_id
  where b.trip_id = p_trip_id and b.status <> 'cancelled'
  order by b.created_at;
end;
$$;

revoke execute on function public.club_trip_bookings(uuid) from public, anon;
grant execute on function public.club_trip_bookings(uuid) to authenticated;

-- The managers of a Casa with their names, for the Casa's other managers (and admins). The profile cards hide people
-- the caller does not know, but a manager has to know who else runs the Casa. Only the name and the role: no avatar,
-- no city, no location.

create function public.supporters_club_managers(p_club_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  role text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not (public.is_supporters_club_manager(p_club_id) or public.is_admin()) then
    raise exception 'not_manager' using errcode = '42501';
  end if;

  return query
  select m.profile_id, coalesce(p.display_name, 'Gestor'), m.role, m.created_at
  from public.supporters_club_manager as m
  left join public.profile as p on p.id = m.profile_id
  where m.club_id = p_club_id
  order by (m.role = 'owner') desc, m.created_at;
end;
$$;

revoke execute on function public.supporters_club_managers(uuid) from public, anon;
grant execute on function public.supporters_club_managers(uuid) to authenticated;
