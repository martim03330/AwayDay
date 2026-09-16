-- Casas propostas: alguém vê uma casa no Airbnb, propõe-na, e a malta junta-se até dar para reservar.
--
-- O desenho anterior pedia «até quanto pagas por pessoa e por noite», e confundia: ninguém pensa assim quando está a
-- planear uma ida. O que as pessoas fazem é encontrar uma casa concreta e perguntar «quem alinha?». Por isso:
--
-- - **propor uma casa**: o link do que se viu (opcional), o custo total, quantas noites e quantos lugares tem. O
--   preço por pessoa é calculado aqui e desce a cada pessoa que entra, como na boleia;
-- - **entrar numa casa**: pede-se lugar e quem propôs decide, também como na boleia;
-- - **convicção de quem propõe**: reserva de qualquer maneira, ou só se a casa encher. É o que diz aos outros se
--   podem contar com aquilo;
-- - **precisar de cama**: quem ainda não viu nada diz só que precisa, sem preço nenhum. Serve para quem procura casa
--   saber quanta gente há.
--
-- O link é de quem o propôs e fica com a data em que o viu: ninguém garante que a casa continua lá, e a app diz isso
-- à frente. Quem propõe pode marcar a casa como reservada quando a fechar.

-- A ordem importa: a regra antiga proíbe justamente o que é preciso escrever a seguir, por isso sai primeiro (e sai
-- sozinha, porque largar a coluna do orçamento já a levava com ela).
alter table public.stay_plan drop constraint stay_plan_shape;
alter table public.stay_plan drop column cents_per_person;

alter table public.stay_plan
  add column listing_url text check (listing_url ~ '^https://' and char_length(listing_url) <= 500),
  add column listing_seen_on date,
  add column status text not null default 'a_juntar' check (status in ('a_juntar', 'reservada'));

-- Linhas escritas no desenho anterior: uma casa proposta sem convicção fica na opção prudente (só reserva se
-- encher), e quem só disse que precisa de cama deixa de ter convicção, que ali não quer dizer nada.
update public.stay_plan set commitment = 'se_houver' where kind = 'tem_casa' and commitment is null;
update public.stay_plan set commitment = null where kind = 'procura' and commitment is not null;

alter table public.stay_plan
  add constraint stay_plan_shape check (
    (
      kind = 'procura'
      and total_cents is null
      and spare_places is null
      and commitment is null
      and listing_url is null
    )
    or (kind = 'tem_casa' and total_cents is not null and spare_places is not null and commitment is not null)
  );

drop function if exists public.set_stay_plan(text, text, integer, smallint, text, smallint, text, integer);

-- Propor uma casa, ou dizer que se precisa de cama. Um por pessoa e por jogo.
create function public.set_stay_plan(
  p_fixture_id text,
  p_kind text,
  p_nights smallint,
  p_total_cents integer default null,
  p_spare_places smallint default null,
  p_commitment text default null,
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
  casa boolean := p_kind = 'tem_casa';
  total integer := case when casa then p_total_cents end;
  lugares smallint := case when casa then p_spare_places end;
  compromisso text := case when casa then p_commitment end;
  link text := case when casa then nullif(btrim(coalesce(p_listing_url, '')), '') end;
  novo uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.fixture_needs_stay(p_fixture_id) then
    raise exception 'stay_not_needed' using errcode = '22023';
  end if;
  if p_kind not in ('procura', 'tem_casa')
    or p_nights is null or p_nights < 1 or p_nights > 14
    or (casa and (total is null or total < 1000 or total > 1000000))
    or (casa and (lugares is null or lugares < 1 or lugares > 10))
    or (casa and (compromisso is null or compromisso not in ('certo', 'se_houver')))
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
    fixture_id, profile_id, kind, total_cents, nights, commitment, spare_places, note,
    listing_url, listing_seen_on
  )
  values (
    p_fixture_id, caller, p_kind, total, p_nights, compromisso, lugares, nota,
    link, case when link is not null then current_date end
  )
  on conflict (fixture_id, profile_id) do update
    set kind = excluded.kind,
        total_cents = excluded.total_cents,
        nights = excluded.nights,
        commitment = excluded.commitment,
        spare_places = excluded.spare_places,
        note = excluded.note,
        listing_url = excluded.listing_url,
        -- A data é de quando o link foi visto; um link novo traz data nova.
        listing_seen_on = case
          when excluded.listing_url is distinct from public.stay_plan.listing_url
            then excluded.listing_seen_on
          else public.stay_plan.listing_seen_on
        end,
        status = case when excluded.kind = 'tem_casa' then public.stay_plan.status else 'a_juntar' end
  returning id into novo;

  -- Deixar de ter casa não deixa ninguém pendurado: os lugares dados caem.
  if not casa then
    delete from public.stay_place where plan_id = novo;
  end if;

  return novo;
end;
$$;

-- Quem propôs marca a casa como reservada quando a fecha (ou volta atrás).
create function public.mark_stay_house(p_plan_id uuid, p_booked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.stay_plan
  set status = case when p_booked then 'reservada' else 'a_juntar' end
  where id = p_plan_id and profile_id = auth.uid() and kind = 'tem_casa';
  if not found then
    raise exception 'not_owner' using errcode = '42501';
  end if;
end;
$$;

drop function if exists public.fixture_stay_plans(text);

create function public.fixture_stay_plans(p_fixture_id text)
returns table (
  id uuid,
  display_name text,
  kind text,
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
    s.kind,
    s.total_cents,
    s.nights,
    s.commitment,
    s.spare_places,
    ocupados.n,
    case when s.kind = 'tem_casa' then public.stay_share_cents(s.total_cents, 1 + ocupados.n) end,
    case when s.kind = 'tem_casa'
      then public.stay_share_cents(s.total_cents, 1 + s.spare_places) end,
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
    case when s.kind = 'tem_casa' then 0 else 1 end,
    case when s.status = 'reservada' then 1 else 0 end,
    s.updated_at desc;
$$;

revoke execute on function public.set_stay_plan(text, text, smallint, integer, smallint, text, text, text)
  from public, anon;
revoke execute on function public.mark_stay_house(uuid, boolean) from public, anon;
revoke execute on function public.fixture_stay_plans(text) from public, anon;
grant execute on function public.set_stay_plan(text, text, smallint, integer, smallint, text, text, text)
  to authenticated;
grant execute on function public.mark_stay_house(uuid, boolean) to authenticated;
grant execute on function public.fixture_stay_plans(text) to authenticated;
