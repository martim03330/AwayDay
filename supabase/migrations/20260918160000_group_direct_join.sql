-- Dentro do grupo não se pede: entra-se.
--
-- As boleias e as casas públicas têm pedidos e respostas porque são entre desconhecidos. Dentro de um plano do grupo
-- isso é burocracia: a malta conhece-se. Passa a haver:
--
-- **Boleia do plano: «Vou nesta boleia».** Quem vê o plano entra direto no carro, se houver lugar — sem pedido nem
-- aceitação. Fica logo como «vou» no plano e, se a sessão já existir, entra nas contas (e na despesa do carro).
--
-- **Casa do plano: escolher, fechar a escolha, entrar.** Enquanto a escolha está aberta, a malta diz qual prefere
-- (como até aqui). Quem convidou **fecha a escolha** na casa do plano; a partir daí, cada um **entra direto** na casa
-- com um toque e o preço por pessoa vai descendo à vista. A escolha pode voltar a abrir, se alguém encontrar melhor.
--
-- **O tasco onde fazes check-in, nos teus grupos.** Quem quiser (pergunta-se uma vez, e muda-se nas definições) passa a
-- dizer sozinho aos seus grupos em que tasco fez check-in — o mesmo «estou aqui», sem ter de o escolher grupo a grupo.
-- A app continua sem ler check-ins: é a Edge Function do check-in que o faz, no servidor, só para quem disse que sim.
-- `null` quer dizer «ainda não perguntámos», e aí não se partilha nada.

-- Boleia do plano -------------------------------------------------------------------------------------------------

/** Quem vê o plano entra direto no carro do plano. */
create function public.join_plan_ride(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
  boleia public.ride;
  ocupados integer;
begin
  select * into plano from public.fixture_plan where id = p_plan_id;
  if caller is null or plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.status = 'cancelado' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;

  select * into boleia from public.ride where id = plano.ride_id for update;
  if boleia.id is null or boleia.status <> 'open' then
    raise exception 'ride_not_found' using errcode = 'P0002';
  end if;
  if boleia.driver_id = caller then
    raise exception 'own_ride' using errcode = '22023';
  end if;
  if now() >= boleia.departure_at then
    raise exception 'ride_closed' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.ride_passenger
    where ride_id = boleia.id and profile_id = caller and status = 'accepted'
  ) then
    return;
  end if;
  select count(*) into ocupados from public.ride_passenger where ride_id = boleia.id and status = 'accepted';
  if ocupados >= boleia.seats_offered then
    raise exception 'ride_full' using errcode = '22023';
  end if;

  insert into public.ride_passenger (ride_id, profile_id, status, rules_accepted_at)
  values (boleia.id, caller, 'accepted', now())
  on conflict (ride_id, profile_id) do update set status = 'accepted', left_at = null, updated_at = now();

  insert into public.fixture_plan_answer (plan_id, profile_id, answer)
  values (p_plan_id, caller, 'vou')
  on conflict (plan_id, profile_id) do update set answer = 'vou', updated_at = now();

  -- Se a sessão já existe, entra nas contas e na despesa do carro.
  if plano.session_id is not null then
    insert into public.trip_session_member (session_id, profile_id, added_by)
    values (plano.session_id, caller, caller)
    on conflict (session_id, profile_id) do nothing;
    perform public.sync_ride_trip_expense(plano.session_id);
  end if;
end;
$$;

-- Casa do plano ---------------------------------------------------------------------------------------------------

alter table public.fixture_plan add column stay_locked_at timestamptz;

/** Fechar a escolha da casa (fica a casa do plano) ou voltar a abri-la. Só quem convidou. */
create function public.set_plan_stay_locked(p_plan_id uuid, p_locked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
begin
  select * into plano from public.fixture_plan where id = p_plan_id for update;
  if caller is null or plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.created_by is distinct from caller then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if p_locked and plano.stay_plan_id is null then
    raise exception 'stay_not_found' using errcode = 'P0002';
  end if;
  update public.fixture_plan
  set stay_locked_at = case when p_locked then now() end, updated_at = now()
  where id = p_plan_id;
end;
$$;

/** Com a escolha fechada, quem vê o plano entra direto na casa do plano, se houver cama. */
create function public.join_plan_stay(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
  casa public.stay_plan;
  ocupados integer;
begin
  select * into plano from public.fixture_plan where id = p_plan_id;
  if caller is null or plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.status = 'cancelado' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;
  if plano.stay_locked_at is null then
    raise exception 'stay_not_locked' using errcode = '22023';
  end if;

  select * into casa from public.stay_plan where id = plano.stay_plan_id for update;
  if casa.id is null then
    raise exception 'stay_not_found' using errcode = 'P0002';
  end if;
  if casa.profile_id = caller then
    raise exception 'own_house' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.stay_place where plan_id = casa.id and profile_id = caller and status = 'aceite'
  ) then
    return;
  end if;
  select count(*) into ocupados from public.stay_place where plan_id = casa.id and status = 'aceite';
  if ocupados >= casa.spare_places then
    raise exception 'house_full' using errcode = '22023';
  end if;

  insert into public.stay_place (plan_id, profile_id, status)
  values (casa.id, caller, 'aceite')
  on conflict (plan_id, profile_id) do update set status = 'aceite', updated_at = now();

  insert into public.fixture_plan_answer (plan_id, profile_id, answer)
  values (p_plan_id, caller, 'vou')
  on conflict (plan_id, profile_id) do update set answer = 'vou', updated_at = now();
end;
$$;

-- As casas do plano passam a dizer se a escolha está fechada e quem já está lá dentro.
drop function public.fixture_plan_houses(uuid);

create function public.fixture_plan_houses(p_plan_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  owner_name text,
  total_cents integer,
  nights smallint,
  spare_places smallint,
  taken integer,
  share_now_cents integer,
  share_full_cents integer,
  listing_url text,
  status text,
  note text,
  is_mine boolean,
  my_status text,
  votes integer,
  my_vote boolean,
  chosen boolean,
  locked boolean,
  people_names text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.profile_id,
    p.display_name,
    s.total_cents,
    s.nights,
    s.spare_places,
    ocupados.n,
    public.stay_share_cents(s.total_cents, 1 + ocupados.n),
    public.stay_share_cents(s.total_cents, 1 + s.spare_places),
    s.listing_url,
    s.status,
    s.note,
    s.profile_id = auth.uid(),
    meu.status,
    (select count(*)::integer from public.fixture_plan_house_vote as v where v.plan_id = p_plan_id and v.stay_plan_id = s.id),
    exists (
      select 1 from public.fixture_plan_house_vote as v
      where v.plan_id = p_plan_id and v.stay_plan_id = s.id and v.profile_id = auth.uid()
    ),
    s.id = fp.stay_plan_id,
    fp.stay_locked_at is not null,
    array[p.display_name] || array(
      select quem.display_name
      from public.stay_place as sp
      join public.profile as quem on quem.id = sp.profile_id
      where sp.plan_id = s.id and sp.status = 'aceite'
      order by sp.updated_at
    )
  from public.fixture_plan as fp
  join public.stay_plan as s on s.fixture_id = fp.fixture_id
  join public.profile as p on p.id = s.profile_id
  cross join lateral (
    select count(*)::integer as n from public.stay_place as sp
    where sp.plan_id = s.id and sp.status = 'aceite'
  ) as ocupados
  left join public.stay_place as meu on meu.plan_id = s.id and meu.profile_id = auth.uid()
  where fp.id = p_plan_id
    and auth.uid() is not null
    and public.can_see_fixture_plan(p_plan_id, auth.uid())
    and public.is_fixture_plan_house(p_plan_id, s.id)
    and (
      s.visibility = 'publica'
      or s.profile_id = auth.uid()
      or public.can_see_private_stay(s.id, s.group_id, auth.uid())
    )
    -- Com a escolha fechada, só a casa do plano.
    and (fp.stay_locked_at is null or s.id = fp.stay_plan_id)
  order by
    s.id = fp.stay_plan_id desc,
    (select count(*) from public.fixture_plan_house_vote as v where v.plan_id = p_plan_id and v.stay_plan_id = s.id) desc,
    s.created_at;
$$;

-- O tasco do check-in, nos grupos ------------------------------------------------------------------------------

alter table public.profile add column share_checkins_with_groups boolean;

/** Sim ou não à partilha automática do check-in com os grupos. */
create function public.set_share_checkins_with_groups(p_share boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  update public.profile set share_checkins_with_groups = p_share where id = auth.uid();
end;
$$;

/**
 * Chamada pela Edge Function do check-in, depois de um check-in verificado: põe «estou aqui» em cada grupo da
 * pessoa, se ela disse que sim. Não repete o mesmo tasco no mesmo grupo dentro de três horas. Devolve em quantos
 * grupos avisou.
 */
create function public.share_checkin_with_groups(p_profile_id uuid, p_place_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  frase text;
  avisados integer := 0;
  grupo uuid;
begin
  if not coalesce((select share_checkins_with_groups from public.profile where id = p_profile_id), false) then
    return 0;
  end if;

  select
    case p.name_article
      when 'o' then 'no '
      when 'a' then 'na '
      when 'os' then 'nos '
      when 'as' then 'nas '
      else 'em '
    end || p.name
  into frase
  from public.place as p
  where p.id = p_place_id;
  if frase is null then
    return 0;
  end if;

  for grupo in
    select m.group_id from public.fan_group_member as m where m.profile_id = p_profile_id
  loop
    if not exists (
      select 1 from public.group_message as g
      where g.group_id = grupo
        and g.profile_id = p_profile_id
        and g.kind = 'local'
        and g.place_id = p_place_id
        and g.created_at > now() - interval '3 hours'
    ) then
      insert into public.group_message (group_id, profile_id, kind, body, place_id)
      values (grupo, p_profile_id, 'local', frase, p_place_id);
      update public.fan_group set updated_at = now() where id = grupo;
      avisados := avisados + 1;
    end if;
  end loop;
  return avisados;
end;
$$;

revoke execute on function public.join_plan_ride(uuid) from public, anon;
revoke execute on function public.set_plan_stay_locked(uuid, boolean) from public, anon;
revoke execute on function public.join_plan_stay(uuid) from public, anon;
revoke execute on function public.fixture_plan_houses(uuid) from public, anon;
revoke execute on function public.set_share_checkins_with_groups(boolean) from public, anon;
revoke execute on function public.share_checkin_with_groups(uuid, text) from public, anon, authenticated;
grant execute on function public.join_plan_ride(uuid) to authenticated;
grant execute on function public.set_plan_stay_locked(uuid, boolean) to authenticated;
grant execute on function public.join_plan_stay(uuid) to authenticated;
grant execute on function public.fixture_plan_houses(uuid) to authenticated;
grant execute on function public.set_share_checkins_with_groups(boolean) to authenticated;
grant execute on function public.share_checkin_with_groups(uuid, text) to service_role;
