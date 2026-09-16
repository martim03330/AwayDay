-- As notificações do resto da app.
--
-- As boleias já avisavam (pedidos de lugar, aceites, cancelamentos). Faltava tudo o que foi entrando depois: a
-- conversa do carro, os convites, os amigos e o dinheiro das contas. Os triggers chamam a função `social-notify`
-- pelo mesmo caminho de sempre — pg_net com o segredo do cron —, e **uma notificação nunca pode travar o que a
-- originou**: se o envio falhar, a mensagem, o convite ou a despesa ficam na mesma.
--
-- Cada tipo pode ser desligado nas definições. Quem desligar deixa de receber, e o servidor é que respeita isso.

alter table public.notification_preference drop constraint notification_preference_kind_check;
alter table public.notification_preference
  add constraint notification_preference_kind_check check (
    kind in (
      'kickoff_change',
      'weather',
      'group_movement',
      'new_stamp',
      -- Mensagens na conversa do carro.
      'ride_message',
      -- Convites para uma boleia ou para um grupo.
      'invites',
      -- Pedidos de amizade e respostas.
      'friends',
      -- Despesas e pagamentos das contas da viagem.
      'trip_money'
    )
  );

create function public.notify_social(p_payload jsonb)
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
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := p_payload,
    timeout_milliseconds := 10000
  );
exception when others then
  -- Uma notificação nunca trava uma mensagem, um convite ou uma despesa.
  return;
end;
$$;

create function public.notify_ride_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_social(jsonb_build_object(
    'kind', 'ride_message',
    'ride_id', new.ride_id,
    'profile_id', new.profile_id,
    'body', new.body
  ));
  return null;
end;
$$;

create function public.notify_ride_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_social(jsonb_build_object(
    'kind', 'ride_invite',
    'ride_id', new.ride_id,
    'profile_id', new.profile_id,
    'invited_by', new.invited_by
  ));
  return null;
end;
$$;

create function public.notify_group_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_social(jsonb_build_object(
    'kind', 'group_invite',
    'group_id', new.group_id,
    'profile_id', new.profile_id,
    'invited_by', new.invited_by
  ));
  return null;
end;
$$;

create function public.notify_friendship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_social(jsonb_build_object(
    'kind', case when new.status = 'aceite' then 'friend_accepted' else 'friend_request' end,
    'requester_id', new.requester_id,
    'addressee_id', new.addressee_id
  ));
  return null;
end;
$$;

-- A despesa é escrita primeiro e as pessoas que entram nela logo a seguir. Por isso o aviso não sai da despesa:
-- sai das **partes**, num trigger por instrução (que corre uma vez por escrita, já com a lista toda). A despesa da
-- boleia entra sozinha e não é novidade para ninguém — essa não avisa.
create function public.notify_trip_expense_shares()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  despesa record;
begin
  for despesa in
    select e.id, e.session_id, e.created_by, e.description, e.cents
    from (select distinct expense_id from novas) as escritas
    join public.trip_expense as e on e.id = escritas.expense_id
    where e.source = 'manual'
  loop
    perform public.notify_social(jsonb_build_object(
      'kind', 'trip_expense',
      'session_id', despesa.session_id,
      'expense_id', despesa.id,
      'created_by', despesa.created_by,
      'description', despesa.description,
      'cents', despesa.cents
    ));
  end loop;
  return null;
end;
$$;

create function public.notify_trip_settlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_social(jsonb_build_object(
    'kind', 'trip_settlement',
    'session_id', new.session_id,
    'from_profile_id', new.from_profile_id,
    'to_profile_id', new.to_profile_id,
    'created_by', new.created_by,
    'cents', new.cents
  ));
  return null;
end;
$$;

create trigger ride_message_notify
  after insert on public.ride_message
  for each row execute function public.notify_ride_message();

create trigger ride_invite_notify
  after insert on public.ride_invite
  for each row execute function public.notify_ride_invite();

create trigger group_invite_notify
  after insert on public.group_invite
  for each row execute function public.notify_group_invite();

create trigger friendship_notify
  after insert or update of status on public.friendship
  for each row execute function public.notify_friendship();

create trigger trip_expense_share_notify
  after insert on public.trip_expense_share
  referencing new table as novas
  for each statement execute function public.notify_trip_expense_shares();

create trigger trip_settlement_notify
  after insert on public.trip_settlement
  for each row execute function public.notify_trip_settlement();

revoke execute on function public.notify_social(jsonb) from public, anon, authenticated;
revoke execute on function public.notify_ride_message() from public, anon, authenticated;
revoke execute on function public.notify_ride_invite() from public, anon, authenticated;
revoke execute on function public.notify_group_invite() from public, anon, authenticated;
revoke execute on function public.notify_friendship() from public, anon, authenticated;
revoke execute on function public.notify_trip_expense_shares() from public, anon, authenticated;
revoke execute on function public.notify_trip_settlement() from public, anon, authenticated;
