-- Two more ride notices, so nobody has to open the app to know (asked 2026-10-15):
-- - a ride is offered in a plan  -> whoever answered «Vou» or «Talvez» to it;
-- - someone gets a seat in a car -> the rest of the car (the driver only when they did not accept it themselves).
-- Both can be turned off with the new «Boleias» switch (`rides`). The answers to one's own requests (seat requested,
-- accepted, declined, ride cancelled) stay as they are, always on.
--
-- `ride-notify` reads the plan and the car again with the service role: the trigger only sends the keys.

alter table public.notification_preference drop constraint notification_preference_kind_check;
alter table public.notification_preference
  add constraint notification_preference_kind_check check (
    kind in (
      'kickoff_change',
      'weather',
      'group_movement',
      'new_stamp',
      'ride_message',
      'invites',
      'friends',
      'trip_money',
      'group_message',
      -- Rides offered in one's plans, and people getting a seat in one's car.
      'rides'
    )
  );

create or replace function public.notify_ride_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if tg_table_name in ('ride_passenger', 'ride_return_request') then
    payload := jsonb_build_object(
      'kind', case when tg_table_name = 'ride_passenger' then 'passenger' else 'return' end,
      'ride_id', new.ride_id,
      'profile_id', new.profile_id,
      'old_status', case when tg_op = 'UPDATE' then old.status end
    );
  elsif tg_table_name = 'fixture_plan' then
    payload := jsonb_build_object('kind', 'plan_ride', 'ride_id', new.ride_id, 'plan_id', new.id);
  else
    payload := jsonb_build_object('kind', 'ride', 'ride_id', new.id, 'old_status', old.status);
  end if;

  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ride-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret')
    ),
    body := payload,
    timeout_milliseconds := 10000
  );
  return null;
exception when others then
  -- A notification must never block a request or an answer.
  return null;
end;
$$;

-- A car put in a plan (or swapped for another one). Taking the car out of the plan says nothing.
create trigger fixture_plan_ride_notify
  after update of ride_id on public.fixture_plan
  for each row
  when (new.ride_id is not null and new.ride_id is distinct from old.ride_id)
  execute function public.notify_ride_change();
