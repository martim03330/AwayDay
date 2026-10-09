-- The chat notices about inviting another group to a plan say «convidou» / «retirou o convite» instead of «mandou o
-- plano» / «deixou de abrir», matching the app (2026-10-09). Same functions, only the texts change.

CREATE OR REPLACE FUNCTION public.share_fixture_plan(p_plan_id uuid, p_group_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    format('%s convidou a malta do «%3$s» para o plano %2$s. Podem pedir lugar no carro e na casa.',
      coalesce(quem, 'Alguém'), jogo, coalesce(destino, 'outro grupo'))
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.unshare_fixture_plan(p_plan_id uuid, p_group_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    format('%s retirou o convite do plano %s à malta do «%s». Os lugares já aceites ficam como estão.',
      coalesce(quem, 'Alguém'), jogo, coalesce(destino, 'outro grupo'))
  );
  perform public.post_plan_notice(
    p_group_id, caller, p_plan_id,
    format('%s retirou o convite deste grupo para o plano %s.', coalesce(quem, 'Alguém'), jogo)
  );
end;
$function$;
