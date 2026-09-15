-- Tascos sugeridos pelos adeptos.
--
-- Até agora todos os tascos vinham do OpenStreetMap ou da pesquisa: quem conhecia um sítio que não estava em lado
-- nenhum não tinha como o pôr na app. Agora tem — com as travas que impedem que isto vire um mural de spam:
--
-- - é preciso conta, no máximo 3 sugestões por dia e 10 por mês;
-- - o sítio tem de ficar até 45 minutos a pé de um estádio com jogos (mais longe do que isso já não é um sítio de
--   dia de jogo, é só um restaurante);
-- - nada de duplicados: não entra se já houver um tasco a menos de 60 m ou com o mesmo nome nesse estádio;
-- - o nome não pode trazer links, emails nem números de telefone;
-- - nasce como sugestão e só passa a confirmado com **5 adeptos diferentes** a dizer que sim, como qualquer outra
--   sugestão. Quem sugere não vota no seu próprio tasco: o voto dele não conta e nem sequer é aceite;
-- - uma sugestão que ninguém votou em 60 dias desaparece sozinha.

alter table public.place
  drop constraint place_source_check,
  add constraint place_source_check check (source in ('osm', 'manual', 'adepto')),
  add column suggested_by uuid references public.profile (id) on delete set null,
  add column suggested_at timestamptz,
  -- Why this fan says the place is worth it. No sources, unlike `matchday_note`: this is someone's word, and the app
  -- shows it as such.
  add column fan_note text check (char_length(btrim(fan_note)) between 2 and 200),
  add constraint place_fan_note_only_from_fans
    check (fan_note is null or source = 'adepto');

create index place_suggested_by_idx on public.place (suggested_by) where suggested_by is not null;

/** Name as it compares: no accents, no punctuation, lower case. */
create function public.place_name_key(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
    lower(translate(p_name,
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')),
    '[^a-z0-9]+', ' ', 'g'));
$$;

-- Suggesting a place. Everything is decided here: which stadium it belongs to, how far it is and whether it is a
-- duplicate. The app never writes to `place`.
create function public.suggest_place(
  p_name text,
  p_kind text,
  p_latitude double precision,
  p_longitude double precision,
  p_note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  nome text := btrim(coalesce(p_name, ''));
  nota text := nullif(btrim(coalesce(p_note, '')), '');
  aqui extensions.geography;
  perto record;
  minutos smallint;
  novo_id text;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if char_length(nome) < 2 or char_length(nome) > 60 then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  -- Links, emails and phone numbers in a name mean an advertisement, not a tasco.
  if nome ~* '(https?://|www\.|@|[0-9]{9})' then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  if p_kind not in ('tasca', 'cervejaria', 'bar', 'roulotte', 'churrasqueira', 'restaurante', 'cafe') then
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  if p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'bad_location' using errcode = '22023';
  end if;
  if nota is not null and char_length(nota) > 200 then
    raise exception 'bad_note' using errcode = '22023';
  end if;

  aqui := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography;

  -- The stadium it belongs to: the nearest one with games, and only if it is walkable from there.
  select v.id as venue_id, extensions.st_distance(v.location, aqui)::integer as distance_m
  into perto
  from public.venue as v
  where v.location is not null
    and exists (select 1 from public.fixture as f where f.venue_id = v.id)
    and extensions.st_dwithin(v.location, aqui, 3000)
  order by extensions.st_distance(v.location, aqui)
  limit 1;

  if perto.venue_id is null then
    raise exception 'too_far' using errcode = '22023';
  end if;

  -- Streets are not straight lines: 80 m a minute, plus a third for the detour.
  minutos := ceil((perto.distance_m * 1.3) / 80.0);
  if minutos > 45 then
    raise exception 'too_far' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.place as p
    where p.venue_id = perto.venue_id
      and p.confirmation <> 'rejected'
      and (
        extensions.st_dwithin(p.location, aqui, 60)
        or public.place_name_key(p.name) = public.place_name_key(nome)
      )
  ) then
    raise exception 'duplicate_place' using errcode = '22023';
  end if;

  if not public.take_rate_limit(caller, 'place-suggestion', 3, interval '1 day')
    or not public.take_rate_limit(caller, 'place-suggestion-month', 10, interval '30 days') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  novo_id := 'adepto-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.place (
    id, name, name_article, kind, venue_id, walking_minutes, distance_m, location, source,
    confirmation, quick_and_cheap, suitability, fan_note, suggested_by, suggested_at
  )
  values (
    novo_id, nome, '', p_kind, perto.venue_id, minutos, perto.distance_m, aqui, 'adepto',
    'suggested', false, 3, nota, caller, now()
  );

  return novo_id;
end;
$$;

revoke execute on function public.suggest_place(text, text, double precision, double precision, text)
  from public, anon;
grant execute on function public.suggest_place(text, text, double precision, double precision, text)
  to authenticated;
revoke execute on function public.place_name_key(text) from public, anon, authenticated;

-- Votes: whoever suggested a place does not confirm their own place.
create or replace function public.place_vote_recount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target text := coalesce(new.place_id, old.place_id);
  dono uuid;
  yes_count integer;
  no_count integer;
begin
  select p.suggested_by into dono from public.place as p where p.id = target;

  select count(*) filter (where v.is_good), count(*) filter (where not v.is_good)
    into yes_count, no_count
  from public.place_vote as v
  where v.place_id = target and (dono is null or v.profile_id <> dono);

  update public.place as p
  set
    votes_yes = yes_count,
    votes_no = no_count,
    confirmation = case
      when p.confirmation <> 'suggested' then p.confirmation
      when yes_count >= 5 and yes_count >= 2 * no_count then 'confirmed'
      when no_count >= 5 and no_count >= 2 * yes_count then 'rejected'
      else 'suggested'
    end
  where p.id = target;

  return null;
end;
$$;

drop policy "users vote on suggestions as themselves" on public.place_vote;
drop policy "users change their own votes on suggestions" on public.place_vote;

create policy "users vote on suggestions as themselves"
  on public.place_vote for insert to authenticated
  with check (
    (select auth.uid()) = profile_id
    and exists (
      select 1 from public.place as p
      where p.id = place_id
        and p.confirmation = 'suggested'
        and p.suggested_by is distinct from (select auth.uid())
    )
  );

create policy "users change their own votes on suggestions"
  on public.place_vote for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check (
    (select auth.uid()) = profile_id
    and exists (
      select 1 from public.place as p
      where p.id = place_id
        and p.confirmation = 'suggested'
        and p.suggested_by is distinct from (select auth.uid())
    )
  );

-- A suggestion nobody ever voted on is not a place: after 60 days it goes, and takes its photos with it.
create function public.delete_stale_fan_places()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.place as p
    where p.source = 'adepto'
      and p.confirmation = 'suggested'
      and p.votes_yes = 0
      and p.votes_no = 0
      and p.suggested_at < now() - interval '60 days'
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function public.delete_stale_fan_places() from public, anon, authenticated;

select cron.schedule('delete-stale-fan-places', '23 4 * * *', $$ select public.delete_stale_fan_places(); $$);
