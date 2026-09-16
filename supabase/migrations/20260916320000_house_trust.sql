-- A casa é só casa, e só entra quem já é alguém na app.
--
-- 1. Fora o «preciso de cama». Dizer que se precisa de cama não levava a lado nenhum: quem propõe uma casa não tinha
--    como convidar ninguém, e a lista enchia-se de gente à espera. A dormida passa a ser só isto: casas propostas,
--    com lugares, que a malta divide.
--
-- 2. Quem pode propor ou entrar numa casa. Dormir com desconhecidos e adiantar dinheiro não é como partilhar uma
--    viagem de carro, por isso pede-se um mínimo de pé na app: conta com mais de uma semana **ou** pelo menos uma
--    boleia terminada, e nunca quem está suspenso por faltas. Não é uma verificação de identidade — a app não faz
--    isso e não o vai fingir —, é só não deixar que uma conta criada há cinco minutos recolha dinheiro de ninguém.
--
-- 3. O que se sabe de cada pessoa fica à vista: desde quando está na app, quantas boleias fez e quantas faltas tem.
--    É pouco, mas é verdade, e é melhor do que uma fotografia que qualquer um descarrega da internet.

delete from public.stay_plan where kind = 'procura';

alter table public.stay_plan
  drop constraint stay_plan_shape,
  drop column kind,
  alter column total_cents set not null,
  alter column spare_places set not null,
  alter column commitment set not null;

-- Pé na app que se pede para propor uma casa ou entrar numa: nada de identidade, só história.
create function public.can_share_house(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.ride_ban_until(p_profile_id) is null
    and (
      exists (
        select 1 from public.profile as p
        where p.id = p_profile_id and p.created_at < now() - interval '7 days'
      )
      or exists (
        select 1 from public.ride_outcome as o
        where o.profile_id = p_profile_id and o.outcome = 'completed'
      )
    );
$$;

revoke execute on function public.can_share_house(uuid) from public, anon;
grant execute on function public.can_share_house(uuid) to authenticated;

drop function if exists public.set_stay_plan(text, text, smallint, integer, smallint, text, text, text);

-- Propor uma casa para este jogo. Uma por pessoa; repetir corrige a que já lá está.
create function public.set_stay_plan(
  p_fixture_id text,
  p_nights smallint,
  p_total_cents integer,
  p_spare_places smallint,
  p_commitment text,
  p_note text default null,
  p_listing_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  kickoff timestamptz;
  nota text := nullif(btrim(coalesce(p_note, '')), '');
  link text := nullif(btrim(coalesce(p_listing_url, '')), '');
  novo uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.fixture_needs_stay(p_fixture_id) then
    raise exception 'stay_not_needed' using errcode = '22023';
  end if;
  if not public.can_share_house(caller) then
    raise exception 'needs_history' using errcode = '22023';
  end if;
  if p_nights is null or p_nights < 1 or p_nights > 14
    or p_total_cents is null or p_total_cents < 1000 or p_total_cents > 1000000
    or p_spare_places is null or p_spare_places < 1 or p_spare_places > 10
    or p_commitment is null or p_commitment not in ('certo', 'se_houver')
    or (link is not null and (link !~ '^https://' or char_length(link) > 500))
    or (nota is not null and char_length(nota) > 200) then
    raise exception 'bad_stay' using errcode = '22023';
  end if;

  select f.kickoff_at into kickoff from public.fixture as f where f.id = p_fixture_id;
  if now() < kickoff - interval '180 days' or now() > kickoff + interval '1 day' then
    raise exception 'outside_window' using errcode = '22023';
  end if;

  if not public.take_rate_limit(caller, 'stay-plan', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.stay_plan (
    fixture_id, profile_id, total_cents, nights, commitment, spare_places, note,
    listing_url, listing_seen_on
  )
  values (
    p_fixture_id, caller, p_total_cents, p_nights, p_commitment, p_spare_places, nota,
    link, case when link is not null then current_date end
  )
  on conflict (fixture_id, profile_id) do update
    set total_cents = excluded.total_cents,
        nights = excluded.nights,
        commitment = excluded.commitment,
        spare_places = excluded.spare_places,
        note = excluded.note,
        listing_url = excluded.listing_url,
        listing_seen_on = case
          when excluded.listing_url is distinct from public.stay_plan.listing_url
            then excluded.listing_seen_on
          else public.stay_plan.listing_seen_on
        end
  returning id into novo;

  return novo;
end;
$$;

-- Entrar numa casa pede o mesmo pé na app que propor uma.
create or replace function public.request_stay_place(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  casa public.stay_plan;
  ocupados integer;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.can_share_house(caller) then
    raise exception 'needs_history' using errcode = '22023';
  end if;
  select * into casa from public.stay_plan where id = p_plan_id for update;
  if casa.id is null then
    raise exception 'house_not_found' using errcode = 'P0002';
  end if;
  if casa.profile_id = caller then
    raise exception 'own_house' using errcode = '22023';
  end if;
  if casa.status = 'reservada' then
    raise exception 'house_full' using errcode = '22023';
  end if;
  select count(*) into ocupados from public.stay_place
  where plan_id = p_plan_id and status = 'aceite';
  if ocupados >= casa.spare_places then
    raise exception 'house_full' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'stay-place', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.stay_place (plan_id, profile_id, status)
  values (p_plan_id, caller, 'pedido')
  on conflict (plan_id, profile_id) do update
    set status = 'pedido'
    where public.stay_place.status in ('recusado', 'saiu');
end;
$$;

drop function if exists public.fixture_stay_plans(text);

-- As casas propostas para este jogo, com as contas feitas e o que se sabe de quem as propôs.
create function public.fixture_stay_plans(p_fixture_id text)
returns table (
  id uuid,
  display_name text,
  member_since date,
  rides_completed integer,
  rides_faults integer,
  total_cents integer,
  nights smallint,
  commitment text,
  spare_places smallint,
  taken integer,
  share_now_cents integer,
  share_full_cents integer,
  listing_url text,
  listing_seen_on date,
  status text,
  note text,
  updated_on date,
  is_mine boolean,
  my_status text,
  pending integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    p.display_name,
    p.created_at::date,
    rep.completed,
    rep.faults,
    s.total_cents,
    s.nights,
    s.commitment,
    s.spare_places,
    ocupados.n,
    public.stay_share_cents(s.total_cents, 1 + ocupados.n),
    public.stay_share_cents(s.total_cents, 1 + s.spare_places),
    s.listing_url,
    s.listing_seen_on,
    s.status,
    s.note,
    s.updated_at::date,
    s.profile_id = auth.uid(),
    meu.status,
    case when s.profile_id = auth.uid() then pedidos.n else 0 end
  from public.stay_plan as s
  join public.profile as p on p.id = s.profile_id
  cross join lateral public.ride_reputation(array[s.profile_id]) as rep
  cross join lateral (
    select count(*)::integer as n from public.stay_place as sp
    where sp.plan_id = s.id and sp.status = 'aceite'
  ) as ocupados
  cross join lateral (
    select count(*)::integer as n from public.stay_place as sp
    where sp.plan_id = s.id and sp.status = 'pedido'
  ) as pedidos
  left join public.stay_place as meu on meu.plan_id = s.id and meu.profile_id = auth.uid()
  where s.fixture_id = p_fixture_id and auth.uid() is not null
  order by
    case when s.status = 'reservada' then 1 else 0 end,
    s.updated_at desc;
$$;

drop function if exists public.stay_place_people(uuid);

-- Quem está numa casa. Toda a gente vê quem já foi aceite (é com essas pessoas que se vai dormir); os pedidos por
-- responder só os vê quem propôs a casa.
create function public.stay_place_people(p_plan_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  status text,
  member_since date,
  rides_completed integer,
  rides_faults integer,
  is_mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select sp.profile_id, p.display_name, sp.status, p.created_at::date, rep.completed, rep.faults,
    sp.profile_id = auth.uid()
  from public.stay_place as sp
  join public.profile as p on p.id = sp.profile_id
  join public.stay_plan as s on s.id = sp.plan_id
  cross join lateral public.ride_reputation(array[sp.profile_id]) as rep
  where sp.plan_id = p_plan_id
    and auth.uid() is not null
    and (
      sp.status = 'aceite'
      or ((s.profile_id = auth.uid() or sp.profile_id = auth.uid()) and sp.status = 'pedido')
    )
  order by sp.status, sp.created_at;
$$;

revoke execute on function public.set_stay_plan(text, smallint, integer, smallint, text, text, text)
  from public, anon;
revoke execute on function public.fixture_stay_plans(text) from public, anon;
revoke execute on function public.stay_place_people(uuid) from public, anon;
grant execute on function public.set_stay_plan(text, smallint, integer, smallint, text, text, text)
  to authenticated;
grant execute on function public.fixture_stay_plans(text) to authenticated;
grant execute on function public.stay_place_people(uuid) to authenticated;

-- Marcar como reservada já não tem de perguntar se é uma casa: agora são todas.
create or replace function public.mark_stay_house(p_plan_id uuid, p_booked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.stay_plan
  set status = case when p_booked then 'reservada' else 'a_juntar' end
  where id = p_plan_id and profile_id = auth.uid();
  if not found then
    raise exception 'not_owner' using errcode = '42501';
  end if;
end;
$$;
