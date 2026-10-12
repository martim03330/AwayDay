-- Notifications: the triggers send only the row's key (and, for rides, the previous status), with their own secret.
--
-- Before, they sent the whole content (message text, amounts, who to notify) with the cron secret, and the functions
-- trusted it: whoever got hold of that secret could push any text to anyone, e.g. «X diz que te pagou 20 €».
-- Now `social-notify` and `ride-notify` read every row again with the service role, and they answer only to
-- NOTIFY_SECRET (vault `notify_secret`), which is not the one the cron jobs use. Security review, 2026-10-13.
--
-- The vault secret and the functions' NOTIFY_SECRET are set outside the migrations (they never go in the repo).

create or replace function public.notify_social(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/social-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret')
    ),
    body := p_payload,
    timeout_milliseconds := 10000
  );
exception when others then
  -- Uma notificação nunca trava uma mensagem, um convite ou uma despesa.
  return;
end;
$$;

create or replace function public.notify_friendship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_social(jsonb_build_object(
    'kind', 'friendship',
    'requester_id', new.requester_id,
    'addressee_id', new.addressee_id
  ));
  return null;
end;
$$;

create or replace function public.notify_group_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_social(jsonb_build_object(
    'kind', 'group_invite',
    'group_id', new.group_id,
    'profile_id', new.profile_id
  ));
  return null;
end;
$$;

create or replace function public.notify_ride_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_social(jsonb_build_object(
    'kind', 'ride_invite',
    'ride_id', new.ride_id,
    'profile_id', new.profile_id
  ));
  return null;
end;
$$;

create or replace function public.notify_group_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_social(jsonb_build_object('kind', 'group_message', 'message_id', new.id));
  return null;
end;
$$;

create or replace function public.notify_ride_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_social(jsonb_build_object('kind', 'ride_message', 'message_id', new.id));
  return null;
end;
$$;

create or replace function public.notify_trip_expense_shares()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  despesa record;
begin
  for despesa in
    select e.id
    from (select distinct expense_id from novas) as escritas
    join public.trip_expense as e on e.id = escritas.expense_id
    where e.source = 'manual'
  loop
    perform public.notify_social(jsonb_build_object('kind', 'trip_expense', 'expense_id', despesa.id));
  end loop;
  return null;
end;
$$;

create or replace function public.notify_trip_settlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_social(jsonb_build_object('kind', 'trip_settlement', 'settlement_id', new.id));
  return null;
end;
$$;

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
