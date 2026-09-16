-- Quem procura casa não tem lugares a sobrar, e quem já tem casa não precisa de dizer com que convicção reserva:
-- esses argumentos são opcionais. Ficam com `default null` para a app os poder simplesmente não enviar (e para os
-- tipos gerados dizerem a verdade sobre isso).

create or replace function public.set_stay_plan(
  p_fixture_id text,
  p_kind text,
  p_cents_per_person integer,
  p_nights smallint,
  p_commitment text default null,
  p_spare_places smallint default null,
  p_note text default null
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
  compromisso text := case when p_kind = 'procura' then p_commitment end;
  lugares smallint := case when p_kind = 'tem_casa' then p_spare_places end;
  novo uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.fixture_needs_stay(p_fixture_id) then
    raise exception 'stay_not_needed' using errcode = '22023';
  end if;
  if p_kind not in ('procura', 'tem_casa')
    or p_cents_per_person is null or p_cents_per_person < 300 or p_cents_per_person > 50000
    or p_nights is null or p_nights < 1 or p_nights > 14
    or (p_kind = 'procura' and (compromisso is null or compromisso not in ('certo', 'se_houver')))
    or (p_kind = 'tem_casa' and (lugares is null or lugares < 1 or lugares > 10)) then
    raise exception 'bad_stay' using errcode = '22023';
  end if;
  if nota is not null and char_length(nota) > 200 then
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
    fixture_id, profile_id, kind, cents_per_person, nights, commitment, spare_places, note
  )
  values (p_fixture_id, caller, p_kind, p_cents_per_person, p_nights, compromisso, lugares, nota)
  on conflict (fixture_id, profile_id) do update
    set kind = excluded.kind,
        cents_per_person = excluded.cents_per_person,
        nights = excluded.nights,
        commitment = excluded.commitment,
        spare_places = excluded.spare_places,
        note = excluded.note
  returning id into novo;

  return novo;
end;
$$;

revoke execute on function public.set_stay_plan(text, text, integer, smallint, text, smallint, text)
  from public, anon;
grant execute on function public.set_stay_plan(text, text, integer, smallint, text, smallint, text)
  to authenticated;
