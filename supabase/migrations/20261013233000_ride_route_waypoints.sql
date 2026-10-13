-- «Ver o caminho no Mapas»: the route line of a ride («Mais rápido · ida e volta») opens Apple Maps (or Google Maps)
-- with the road the driver picked. Maps chooses its own road between two points (usually the fastest), so the link
-- also carries three points along the chosen route (a quarter, half and three quarters of the way), saved when the
-- ride is created. They are tens of kilometres from the start, so they say nothing about the exact meeting point.

alter table public.route_cache add column via_points jsonb not null default '[]'::jsonb;

alter table public.ride add column route_via jsonb not null default '[]'::jsonb;
alter table public.ride add constraint ride_route_via_shape
  check (jsonb_typeof(route_via) = 'array' and jsonb_array_length(route_via) <= 5);

/** The points along a ride's route, for whoever can see the ride on the board (same rule as ride_board). */
create function public.ride_route_via(p_ride_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select r.route_via
  from public.ride as r
  left join public.ride_passenger as mine on mine.ride_id = r.id and mine.profile_id = auth.uid()
  where auth.uid() is not null
    and r.id = p_ride_id
    and r.status = 'open'
    and (
      r.visibility = 'publica'
      or r.driver_id = auth.uid()
      or mine.profile_id is not null
      or public.can_see_private_ride(r.id, r.group_id, auth.uid())
    );
$$;

revoke execute on function public.ride_route_via(uuid) from public, anon;
grant execute on function public.ride_route_via(uuid) to authenticated;
