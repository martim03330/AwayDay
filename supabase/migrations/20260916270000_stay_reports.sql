-- Dormir fora: quanto custou a quem já lá foi.
--
-- Para jogos no estrangeiro e nas ilhas, a app leva ao Airbnb com a cidade, as datas do jogo e o número de pessoas já
-- preenchidos. Esse link é uma *pesquisa*, nunca um anúncio: mostra sempre o que está disponível naquele momento e não
-- pode ficar desatualizado. Guardar o link de um apartamento seria prometer uma coisa que não controlamos — o Airbnb
-- não tem API pública e um anúncio apagado devolve HTTP 200 na mesma (verificado a 2026-09-16), por isso não há forma
-- honesta de saber se ainda existe.
--
-- O que guardamos é outra coisa: o que os adeptos pagaram, com a data. Um preço com data é informação; um preço sem
-- data é uma promessa que ninguém pode cumprir.
--
-- - um relato por pessoa e por jogo, em cêntimos inteiros;
-- - quem lá for e não encontrar nada parecido desmente: dois desmentidos escondem o relato;
-- - os relatos morrem 30 dias depois do jogo — a essa altura já não servem para planear nada.

create table public.stay_report (
  id uuid primary key default gen_random_uuid(),
  fixture_id text not null references public.fixture (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  -- Total per night for the place, in cents (never per person: people say "paguei 120 € a noite").
  cents_per_night integer not null check (cents_per_night between 500 and 100000),
  people smallint not null check (people between 1 and 12),
  nights smallint not null check (nights between 1 and 14),
  note text check (char_length(btrim(note)) between 2 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, profile_id)
);

create index stay_report_fixture_idx on public.stay_report (fixture_id);

create trigger stay_report_set_updated_at
  before update on public.stay_report
  for each row execute function public.set_updated_at();

create table public.stay_report_denial (
  report_id uuid not null references public.stay_report (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, profile_id)
);

alter table public.stay_report enable row level security;
alter table public.stay_report_denial enable row level security;
revoke all on public.stay_report from anon, authenticated;
revoke all on public.stay_report_denial from anon, authenticated;

-- Only away trips where sleeping over is part of going: abroad and the islands.
create function public.fixture_needs_stay(p_fixture_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.fixture as f
    join public.venue as v on v.id = f.venue_id
    where f.id = p_fixture_id
      and (v.country is distinct from 'Portugal' or v.district in ('Madeira', 'Açores'))
  );
$$;

-- Telling the others what it cost. One report per person per game; sending it again corrects the previous one.
create function public.report_stay(
  p_fixture_id text,
  p_cents_per_night integer,
  p_people smallint,
  p_nights smallint,
  p_note text
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
  novo uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.fixture_needs_stay(p_fixture_id) then
    raise exception 'stay_not_needed' using errcode = '22023';
  end if;
  if p_cents_per_night is null or p_cents_per_night < 500 or p_cents_per_night > 100000
    or p_people is null or p_people < 1 or p_people > 12
    or p_nights is null or p_nights < 1 or p_nights > 14 then
    raise exception 'bad_stay' using errcode = '22023';
  end if;
  if nota is not null and (char_length(nota) < 2 or char_length(nota) > 200) then
    raise exception 'bad_stay' using errcode = '22023';
  end if;

  select f.kickoff_at into kickoff from public.fixture as f where f.id = p_fixture_id;
  -- Prices are only worth telling from a few months before the game until a few days after it.
  if now() < kickoff - interval '120 days' or now() > kickoff + interval '7 days' then
    raise exception 'outside_window' using errcode = '22023';
  end if;

  if not public.take_rate_limit(caller, 'stay-report', 10, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.stay_report (fixture_id, profile_id, cents_per_night, people, nights, note)
  values (p_fixture_id, caller, p_cents_per_night, p_people, p_nights, nota)
  on conflict (fixture_id, profile_id) do update
    set cents_per_night = excluded.cents_per_night,
        people = excluded.people,
        nights = excluded.nights,
        note = excluded.note
  returning id into novo;

  -- A corrected report starts clean: the old denials were about the old price.
  delete from public.stay_report_denial where report_id = novo;
  return novo;
end;
$$;

-- "Já não encontro nada parecido": two of these hide the report from everyone.
create function public.deny_stay_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if exists (select 1 from public.stay_report as r where r.id = p_report_id and r.profile_id = caller) then
    raise exception 'own_report' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'stay-denial', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  insert into public.stay_report_denial (report_id, profile_id)
  values (p_report_id, caller)
  on conflict do nothing;
end;
$$;

-- What people paid for this game, newest first. Reports two people have denied are gone.
create function public.fixture_stays(p_fixture_id text)
returns table (
  id uuid,
  display_name text,
  cents_per_night integer,
  people smallint,
  nights smallint,
  note text,
  reported_on date,
  is_mine boolean,
  denied_by_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    p.display_name,
    r.cents_per_night,
    r.people,
    r.nights,
    r.note,
    r.updated_at::date,
    r.profile_id = auth.uid(),
    exists (
      select 1 from public.stay_report_denial as d
      where d.report_id = r.id and d.profile_id = auth.uid()
    )
  from public.stay_report as r
  join public.profile as p on p.id = r.profile_id
  where r.fixture_id = p_fixture_id
    and (select count(*) from public.stay_report_denial as d where d.report_id = r.id) < 2
  order by r.updated_at desc;
$$;

revoke execute on function public.report_stay(text, integer, smallint, smallint, text) from public, anon;
revoke execute on function public.deny_stay_report(uuid) from public, anon;
revoke execute on function public.fixture_stays(text) from public, anon;
revoke execute on function public.fixture_needs_stay(text) from public, anon;
grant execute on function public.report_stay(text, integer, smallint, smallint, text) to authenticated;
grant execute on function public.deny_stay_report(uuid) to authenticated;
grant execute on function public.fixture_stays(text) to authenticated;
grant execute on function public.fixture_needs_stay(text) to authenticated;

-- Thirty days after the game a price helps nobody plan anything.
create function public.delete_old_stay_reports()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.stay_report as r
    using public.fixture as f
    where f.id = r.fixture_id and f.kickoff_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function public.delete_old_stay_reports() from public, anon, authenticated;

select cron.schedule('delete-old-stay-reports', '37 3 * * *', $$ select public.delete_old_stay_reports(); $$);
