-- A plan that closes says so in the group's chat (test round, 2026-10-27: when the car filled, the plan closed by
-- itself and only the pinned card said «fechado»; nobody in the chat saw it happen).
--
-- When a plan goes to 'fechado' — by itself because the car filled (`closed_reason = 'carro_cheio'`) or by whoever
-- invited — a system notice (`kind = 'aviso'`, the existing kind for server notices about a plan, shown as a small
-- line in the chat) goes to the plan's group and to the groups it was sent to:
--   · «Plano Porto x Estoril fechado: Rui já tem o carro cheio.» is written as the driver;
--   · «Ana fechou o plano Porto x Estoril.» as whoever closed it.
--
-- No push for these notices. The people in the car were already told by the ride's own notifications (seat accepted)
-- and whoever closed it by hand knows; a push to the whole group for a status change, again on every reopen and
-- close, would be noise. The chat line, the pinned card and the group going up the Malta list are enough. The
-- notice is marked quiet for the push trigger through a transaction-local setting, set and cleared around the insert.

create or replace function public.notify_group_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Quiet notices (a plan closing) stay in the chat without a push.
  if coalesce(current_setting('awayday.quiet_notice', true), '') = 'on' then
    return null;
  end if;
  perform public.notify_social(jsonb_build_object('kind', 'group_message', 'message_id', new.id));
  return null;
end;
$$;

/** Tells the plan's groups that it closed, without a push. */
create function public.tell_groups_plan_closed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jogo text := coalesce(public.fixture_short_title(new.fixture_id), 'deste jogo');
  autor uuid;
  quem text;
  texto text;
  grupo uuid;
begin
  if new.closed_reason = 'carro_cheio' and new.ride_id is not null then
    select r.driver_id, p.display_name into autor, quem
    from public.ride as r
    left join public.profile as p on p.id = r.driver_id
    where r.id = new.ride_id;
    texto := case
      when quem is null then format('Plano %s fechado: o carro já está cheio.', jogo)
      else format('Plano %s fechado: %s já tem o carro cheio.', jogo, quem)
    end;
  else
    autor := coalesce(auth.uid(), new.created_by);
    select p.display_name into quem from public.profile as p where p.id = autor;
    texto := case
      when quem is null then format('Plano %s fechado.', jogo)
      else format('%s fechou o plano %s.', quem, jogo)
    end;
  end if;
  autor := coalesce(autor, new.created_by);
  if autor is null then
    return null;
  end if;

  perform set_config('awayday.quiet_notice', 'on', true);
  for grupo in
    select new.group_id
    union
    select fg.group_id from public.fixture_plan_group as fg where fg.plan_id = new.id
  loop
    perform public.post_plan_notice(grupo, autor, new.id, texto);
  end loop;
  perform set_config('awayday.quiet_notice', '', true);
  return null;
end;
$$;

create trigger fixture_plan_closed_tells_groups
  after update of status on public.fixture_plan
  for each row
  when (new.status = 'fechado' and old.status is distinct from 'fechado')
  execute function public.tell_groups_plan_closed();
