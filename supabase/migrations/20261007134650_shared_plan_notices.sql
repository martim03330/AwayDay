-- Mandar um plano a outro grupo, às claras — e poder voltar atrás.
--
-- Até agora, mandar o plano a outro grupo punha o cartão na conversa desse grupo e mais nada: o grupo de origem não
-- sabia, e no outro grupo o cartão dizia só «Ana convida», como se o plano (e a boleia) fossem de lá. Agora:
--   · o grupo de origem recebe um aviso na conversa («A Ana mandou o plano Lens x Sporting aos Primos da bola…»);
--   · quem convidou pode deixar de o abrir a esse grupo: o cartão sai da conversa de lá, as respostas de quem deixa
--     de o ver saem, os lugares já aceites na boleia e na casa ficam como estão, e os dois grupos são avisados;
--   · quem é do grupo de origem vê a que grupos o plano foi mandado (`fixture_plan_shared_groups`).
--
-- Os avisos são mensagens de sistema (`kind = 'aviso'`): só o servidor as escreve, e nunca sem plano.

alter table public.group_message drop constraint group_message_kind_check;
alter table public.group_message
  add constraint group_message_kind_check check (kind in ('texto', 'local', 'plano', 'aviso'));
alter table public.group_message
  add constraint group_message_notice_needs_plan check (kind <> 'aviso' or plan_id is not null);

/** Escreve um aviso de sistema sobre um plano na conversa de um grupo. */
create function public.post_plan_notice(p_group_id uuid, p_profile_id uuid, p_plan_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_message (group_id, profile_id, kind, body, plan_id)
  values (p_group_id, p_profile_id, 'aviso', left(p_body, 500), p_plan_id);
  update public.fan_group set updated_at = now() where id = p_group_id;
end;
$$;

revoke execute on function public.post_plan_notice(uuid, uuid, uuid, text) from public, anon, authenticated;

-- --- Mandar: igual a antes, mais o aviso no grupo de origem ---------------------------------------------------------

create or replace function public.share_fixture_plan(p_plan_id uuid, p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
  existente uuid;
  quem text;
  jogo text;
  destino text;
begin
  select * into plano from public.fixture_plan where id = p_plan_id;
  if plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.created_by is distinct from caller then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if plano.status <> 'aberto' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;
  if not public.is_group_member(p_group_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_group_id = plano.group_id then
    raise exception 'same_group' using errcode = '22023';
  end if;

  -- That group already has an invite for this game: this one, sent before, or another.
  existente := public.group_plan_for_fixture(p_group_id, plano.fixture_id);
  if existente is not null then
    raise exception 'plan_exists' using errcode = '22023', detail = existente::text;
  end if;

  if not public.take_rate_limit(caller, 'fixture-plan', 30, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.fixture_plan_group (plan_id, group_id, shared_by)
  values (p_plan_id, p_group_id, caller)
  on conflict (plan_id, group_id) do nothing;

  perform public.post_plan_message(p_plan_id, p_group_id, caller);

  select p.display_name into quem from public.profile as p where p.id = caller;
  jogo := coalesce(public.fixture_short_title(plano.fixture_id), 'um jogo');
  select g.name into destino from public.fan_group as g where g.id = p_group_id;
  perform public.post_plan_notice(
    plano.group_id, caller, p_plan_id,
    format('%s mandou o plano %s ao grupo «%s». Eles veem a boleia e a casa e podem pedir lugar.',
      coalesce(quem, 'Alguém'), jogo, coalesce(destino, 'outro grupo'))
  );
end;
$$;

-- --- Voltar atrás ---------------------------------------------------------------------------------------------------

/**
 * Quem convidou deixa de abrir o plano a um grupo a quem o mandou. O cartão sai da conversa desse grupo e quem deixa
 * de ver o plano perde a resposta («vou» / «talvez»); lugares já aceites na boleia ou na casa não se mexem. Os dois
 * grupos ficam avisados.
 */
create function public.unshare_fixture_plan(p_plan_id uuid, p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
  quem text;
  jogo text;
  destino text;
begin
  select * into plano from public.fixture_plan where id = p_plan_id for update;
  if plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.created_by is distinct from caller then
    raise exception 'not_owner' using errcode = '42501';
  end if;

  delete from public.fixture_plan_group where plan_id = p_plan_id and group_id = p_group_id;
  if not found then
    raise exception 'not_shared' using errcode = '22023';
  end if;

  -- O cartão (e avisos antigos) deste plano saem da conversa desse grupo.
  delete from public.group_message
  where group_id = p_group_id and plan_id = p_plan_id and kind in ('plano', 'aviso');

  -- Quem deixou de ver o plano deixa de contar como «vou» ou «talvez».
  delete from public.fixture_plan_answer as a
  where a.plan_id = p_plan_id and not public.can_see_fixture_plan(p_plan_id, a.profile_id);

  select p.display_name into quem from public.profile as p where p.id = caller;
  jogo := coalesce(public.fixture_short_title(plano.fixture_id), 'um jogo');
  select g.name into destino from public.fan_group as g where g.id = p_group_id;

  perform public.post_plan_notice(
    plano.group_id, caller, p_plan_id,
    format('%s deixou de abrir o plano %s ao grupo «%s». Os lugares já aceites ficam como estão.',
      coalesce(quem, 'Alguém'), jogo, coalesce(destino, 'outro grupo'))
  );
  perform public.post_plan_notice(
    p_group_id, caller, p_plan_id,
    format('%s deixou de abrir o plano %s a este grupo.', coalesce(quem, 'Alguém'), jogo)
  );
end;
$$;

revoke execute on function public.unshare_fixture_plan(uuid, uuid) from public, anon;
grant execute on function public.unshare_fixture_plan(uuid, uuid) to authenticated;

-- --- A que grupos foi mandado ---------------------------------------------------------------------------------------

/** Os grupos a quem o plano foi mandado. Só para quem é do grupo de origem: os outros não precisam de saber. */
create function public.fixture_plan_shared_groups(p_plan_id uuid)
returns table (group_id uuid, group_name text, shared_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select fg.group_id, g.name, fg.created_at
  from public.fixture_plan_group as fg
  join public.fixture_plan as fp on fp.id = fg.plan_id
  join public.fan_group as g on g.id = fg.group_id
  where fg.plan_id = p_plan_id
    and auth.uid() is not null
    and public.is_group_member(fp.group_id, auth.uid())
  order by fg.created_at;
$$;

revoke execute on function public.fixture_plan_shared_groups(uuid) from public, anon;
grant execute on function public.fixture_plan_shared_groups(uuid) to authenticated;

-- --- As notificações sabem de que plano é a mensagem ----------------------------------------------------------------

create or replace function public.notify_group_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_social(jsonb_build_object(
    'kind', 'group_message',
    'group_id', new.group_id,
    'profile_id', new.profile_id,
    'message_kind', new.kind,
    'body', new.body,
    'plan_id', new.plan_id
  ));
  return null;
end;
$$;
