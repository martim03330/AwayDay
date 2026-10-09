-- One car per person per game: whoever offers a ride for a game cannot ask for a seat (or join through a plan) in
-- another ride of the same game, and whoever has a seat or a pending request cannot offer a ride for that game.
-- Checked in triggers, so every way in is covered (request_ride_seat, join_plan_ride, accepting a request, the rides
-- Edge Function creating a ride). Leaving or cancelling first frees the person again.

create or replace function public.passenger_not_driving_same_game()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('requested', 'accepted') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('requested', 'accepted') then
    return new;
  end if;
  if exists (
    select 1
    from public.ride as alvo
    join public.ride as minha
      on minha.fixture_id = alvo.fixture_id and minha.driver_id = new.profile_id and minha.status = 'open'
    where alvo.id = new.ride_id and minha.id <> alvo.id
  ) then
    raise exception 'already_offering' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function public.passenger_not_driving_same_game() from public, anon, authenticated;

create trigger ride_passenger_one_car_per_game
  before insert or update of status on public.ride_passenger
  for each row execute function public.passenger_not_driving_same_game();

create or replace function public.driver_not_passenger_same_game()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'open' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'open' then
    return new;
  end if;
  if exists (
    select 1
    from public.ride_passenger as rp
    join public.ride as r on r.id = rp.ride_id
    where rp.profile_id = new.driver_id
      and rp.status in ('requested', 'accepted')
      and r.fixture_id = new.fixture_id
      and r.status = 'open'
      and r.id <> new.id
  ) then
    raise exception 'already_going' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function public.driver_not_passenger_same_game() from public, anon, authenticated;

create trigger ride_one_car_per_game
  before insert or update of status on public.ride
  for each row execute function public.driver_not_passenger_same_game();
