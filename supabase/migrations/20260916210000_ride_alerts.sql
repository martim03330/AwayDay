-- Ride alerts, so nobody has to open a ride to find out something changed:
-- - a push notification the moment a seat is requested, accepted, declined or expires, a passenger leaves, or the
--   driver cancels (triggers call the `ride-notify` Edge Function with the cron secret);
-- - `my_ride_alerts()`: what needs attention, shown at the top of the app (requests to answer, seats confirmed,
--   requests declined, rides cancelled).

create function public.notify_ride_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if tg_table_name = 'ride_passenger' then
    payload := jsonb_build_object(
      'kind', 'passenger',
      'ride_id', new.ride_id,
      'profile_id', new.profile_id,
      'status', new.status,
      'old_status', case when tg_op = 'UPDATE' then old.status end
    );
  else
    payload := jsonb_build_object('kind', 'ride', 'ride_id', new.id, 'status', new.status, 'old_status', old.status);
  end if;

  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ride-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := payload,
    timeout_milliseconds := 10000
  );
  return null;
exception when others then
  -- A notification must never block a seat request or a cancellation.
  return null;
end;
$$;

revoke execute on function public.notify_ride_change() from public, anon, authenticated;

create trigger ride_passenger_notify
  after insert or update of status on public.ride_passenger
  for each row
  execute function public.notify_ride_change();

create trigger ride_notify
  after update of status on public.ride
  for each row
  when (old.status is distinct from new.status)
  execute function public.notify_ride_change();

-- What needs the signed-in fan's attention about rides, most urgent first.
create function public.my_ride_alerts()
returns table (
  kind text,
  ride_id uuid,
  fixture_id text,
  pending integer,
  requests_close_at timestamptz,
  departure_at timestamptz,
  driver_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Requests waiting for the driver's answer.
  select 'pedidos', r.id, r.fixture_id, count(rp.profile_id)::integer,
    public.ride_requests_close_at(r.departure_at), r.departure_at, null::text
  from public.ride as r
  join public.ride_passenger as rp on rp.ride_id = r.id and rp.status = 'requested'
  where r.driver_id = auth.uid() and r.status = 'open' and now() < public.ride_requests_close_at(r.departure_at)
  group by r.id
  union all
  -- Seats confirmed, until departure.
  select 'aceite', r.id, r.fixture_id, 0, public.ride_requests_close_at(r.departure_at), r.departure_at, p.display_name
  from public.ride_passenger as rp
  join public.ride as r on r.id = rp.ride_id
  join public.profile as p on p.id = r.driver_id
  where rp.profile_id = auth.uid() and rp.status = 'accepted' and r.status = 'open' and r.departure_at > now()
  union all
  -- Requests declined or left unanswered, for a day.
  select case when rp.status = 'expired' then 'sem_resposta' else 'recusado' end, r.id, r.fixture_id, 0,
    public.ride_requests_close_at(r.departure_at), r.departure_at, p.display_name
  from public.ride_passenger as rp
  join public.ride as r on r.id = rp.ride_id
  join public.profile as p on p.id = r.driver_id
  where rp.profile_id = auth.uid() and rp.status in ('declined', 'expired')
    and rp.updated_at > now() - interval '24 hours' and r.departure_at > now()
  union all
  -- Rides the fan had a seat in and the driver cancelled, for a day.
  select 'cancelada', r.id, r.fixture_id, 0, public.ride_requests_close_at(r.departure_at), r.departure_at, p.display_name
  from public.ride_passenger as rp
  join public.ride as r on r.id = rp.ride_id
  join public.profile as p on p.id = r.driver_id
  where rp.profile_id = auth.uid() and rp.status = 'accepted' and r.status = 'cancelled'
    and r.cancelled_at > now() - interval '24 hours' and r.departure_at > now() - interval '1 hour'
  order by 1 desc, 6;
$$;

revoke execute on function public.my_ride_alerts() from public, anon;
grant execute on function public.my_ride_alerts() to authenticated;
