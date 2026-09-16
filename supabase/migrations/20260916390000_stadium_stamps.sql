-- Carimbos de estádio: os que valem são os que a app confirmou no local.
--
-- Até agora um estádio contava como visitado por declaração: bastava marcar que se esteve no jogo. Para um passaporte
-- entre amigos chega, mas para um ranking público não vale nada — basta marcar tudo. Os tascos já eram confirmados
-- pela localização; os estádios passam a ser também:
--
-- - **carimbo verificado**: em dia de jogo, perto do estádio, a app lê a posição uma vez e o servidor confirma a
--   distância. Só estes contam para o ranking;
-- - **carimbo declarado**: o que já estava marcado (e o que se marque de jogos passados) continua a contar no
--   passaporte, mas aparece como declarado e fica de fora do ranking.
--
-- A posição não fica guardada: guarda-se que a pessoa lá esteve, o estádio, o jogo e o dia.

create table public.stadium_visit (
  profile_id uuid not null references public.profile (id) on delete cascade,
  venue_id text not null references public.venue (id) on delete cascade,
  fixture_id text references public.fixture (id) on delete set null,
  visited_on date not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, venue_id, visited_on)
);

create index stadium_visit_profile_idx on public.stadium_visit (profile_id);
create index stadium_visit_venue_idx on public.stadium_visit (venue_id);

alter table public.stadium_visit enable row level security;
revoke all on public.stadium_visit from anon, authenticated;

/** Quanto tempo à volta do apito conta como estar no jogo, e a que distância do estádio. */
create function public.stadium_stamp_window(p_kickoff timestamptz)
returns tstzrange
language sql
immutable
set search_path = ''
as $$
  select tstzrange(p_kickoff - interval '4 hours', p_kickoff + interval '5 hours');
$$;

-- Carimbar o estádio, estando lá. Devolve a distância a que a pessoa estava, arredondada a 100 m, para a app poder
-- explicar-se; a posição em si não é guardada.
create function public.stamp_stadium(
  p_fixture_id text,
  p_latitude double precision,
  p_longitude double precision
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  jogo public.fixture;
  casa extensions.geography;
  aqui extensions.geography;
  distancia integer;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'bad_location' using errcode = '22023';
  end if;

  select * into jogo from public.fixture where id = p_fixture_id;
  if jogo.id is null then
    raise exception 'fixture_not_found' using errcode = 'P0002';
  end if;
  if not public.stadium_stamp_window(jogo.kickoff_at) @> now() then
    raise exception 'outside_window' using errcode = '22023';
  end if;

  select v.location into casa from public.venue as v where v.id = jogo.venue_id;
  if casa is null then
    raise exception 'fixture_not_found' using errcode = 'P0002';
  end if;

  if not public.take_rate_limit(caller, 'stadium-stamp', 10, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  aqui := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography;
  distancia := (round(extensions.st_distance(casa, aqui) / 100) * 100)::integer;
  -- Um estádio e o que o rodeia: mais de um quilómetro já não é estar lá.
  if distancia > 1000 then
    raise exception 'too_far' using errcode = '22023';
  end if;

  insert into public.stadium_visit (profile_id, venue_id, fixture_id, visited_on)
  values (caller, jogo.venue_id, jogo.id, (now() at time zone 'Europe/Lisbon')::date)
  on conflict (profile_id, venue_id, visited_on) do update set fixture_id = excluded.fixture_id;

  -- Estar no estádio é ter ido ao jogo: o resto da app já sabia disto por outras vias.
  insert into public.fixture_attendance (profile_id, fixture_id, status)
  values (caller, p_fixture_id, 'attended')
  on conflict (profile_id, fixture_id) do update set status = 'attended';

  return distancia;
end;
$$;

-- Os meus carimbos verificados: um por estádio, com quantas vezes e a última vez.
create function public.my_stadium_stamps()
returns table (venue_id text, visits integer, last_visit date)
language sql
stable
security definer
set search_path = ''
as $$
  select v.venue_id, count(*)::integer, max(v.visited_on)
  from public.stadium_visit as v
  where v.profile_id = auth.uid()
  group by v.venue_id;
$$;

-- Ranking público de estádios: quantos estádios diferentes cada um carimbou no local. Só aparece quem quis aparecer
-- (`show_in_rankings`), mais a própria pessoa, para se ver onde está.
create function public.stadium_ranking(p_limit integer default 20)
returns table (profile_id uuid, display_name text, stadiums integer, visits integer, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with contagem as (
    select v.profile_id, count(distinct v.venue_id)::integer as estadios, count(*)::integer as visitas
    from public.stadium_visit as v
    group by v.profile_id
  )
  select c.profile_id, p.display_name, c.estadios, c.visitas, c.profile_id = auth.uid()
  from contagem as c
  join public.profile as p on p.id = c.profile_id
  where p.show_in_rankings or p.id = auth.uid()
  order by c.estadios desc, c.visitas desc, p.display_name
  limit greatest(1, least(p_limit, 100));
$$;

revoke execute on function public.stamp_stadium(text, double precision, double precision) from public, anon;
revoke execute on function public.my_stadium_stamps() from public, anon;
revoke execute on function public.stadium_ranking(integer) from public, anon;
revoke execute on function public.stadium_stamp_window(timestamptz) from public, anon, authenticated;
grant execute on function public.stamp_stadium(text, double precision, double precision) to authenticated;
grant execute on function public.my_stadium_stamps() to authenticated;
grant execute on function public.stadium_ranking(integer) to authenticated;
