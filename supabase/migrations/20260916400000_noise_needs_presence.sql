-- Medir o barulho: basta estar no sítio, seja qual for a prova.
--
-- A regra pedia check-in num tasco perto do estádio — foi escrita antes de existir o carimbo do estádio, e deixava
-- de fora exatamente quem está lá dentro a fazer o barulho. Agora vale qualquer uma das duas coisas, no dia do jogo:
-- o carimbo do estádio (confirmado no local) ou o check-in num tasco desse estádio.

create or replace function public.record_noise_measurement(p_fixture_id text, p_level integer)
returns public.noise_measurement
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  match_length constant interval := interval '115 minutes';
  min_gap constant interval := interval '8 minutes';
  kickoff timestamptz;
  fixture_venue text;
  dia_do_jogo date;
  measurement public.noise_measurement;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_level is null or p_level < 0 or p_level > 100 then
    raise exception 'noise_level_out_of_range' using errcode = '22023';
  end if;

  select f.kickoff_at, f.venue_id into kickoff, fixture_venue from public.fixture as f where f.id = p_fixture_id;
  if kickoff is null then
    raise exception 'fixture_not_found' using errcode = 'P0002';
  end if;
  if now() < kickoff or now() >= kickoff + match_length then
    raise exception 'fixture_not_live' using errcode = '42501';
  end if;

  dia_do_jogo := (kickoff at time zone 'Europe/Lisbon')::date;

  if not exists (
    -- Carimbou o estádio hoje: está lá dentro.
    select 1
    from public.stadium_visit as sv
    where sv.profile_id = caller and sv.venue_id = fixture_venue and sv.visited_on = dia_do_jogo
  ) and not exists (
    -- Ou fez check-in num tasco deste estádio, hoje: está a ver o jogo com a malta.
    select 1
    from public.place_visit as v
    join public.place as pl on pl.id = v.place_id
    where v.profile_id = caller
      and v.source = 'check-in'
      and pl.venue_id = fixture_venue
      and (v.visited_at at time zone 'Europe/Lisbon')::date = dia_do_jogo
  ) then
    raise exception 'noise_needs_presence' using errcode = '42501';
  end if;

  -- One reading at a time per person and fixture, so parallel calls cannot slip past the gap.
  perform pg_advisory_xact_lock(hashtext('noise:' || caller::text || ':' || p_fixture_id));
  if exists (
    select 1
    from public.noise_measurement as m
    where m.profile_id = caller and m.fixture_id = p_fixture_id and m.measured_at > now() - min_gap
  ) then
    raise exception 'noise_measurement_too_soon' using errcode = 'P0001';
  end if;

  insert into public.noise_measurement (profile_id, fixture_id, level)
  values (caller, p_fixture_id, p_level)
  returning * into measurement;
  return measurement;
end;
$$;
