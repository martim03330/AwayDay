-- Onde dormir, outra vez: de «o que paguei» para «o que estou disposto a pagar».
--
-- O primeiro desenho pedia às pessoas o preço que tinham pago. Errado: quem está a planear uma ida ainda não pagou
-- nada, e o que interessa é juntar gente para dividir uma casa. Agora cada adepto diz uma de duas coisas:
--
-- - **procuro casa**: até quanto paga, por pessoa e por noite, e com que convicção — reserva de qualquer maneira, ou
--   só se houver com quem dividir. Essa convicção é o que permite aos outros saber se podem contar com ele;
-- - **já tenho casa**: quantos lugares sobram e quanto fica por pessoa.
--
-- Não há aqui preços de anúncios nem disponibilidade: isso vê-se no Airbnb, pela pesquisa que a app abre. Aqui são
-- intenções de pessoas, que valem enquanto o jogo não passa.

do $$
begin
  perform cron.unschedule('delete-old-stay-reports');
exception when others then
  null;
end $$;

drop function if exists public.fixture_stays(text);
drop function if exists public.report_stay(text, integer, smallint, smallint, text);
drop function if exists public.deny_stay_report(uuid);
drop function if exists public.delete_old_stay_reports();
drop table if exists public.stay_report_denial;
drop table if exists public.stay_report;

create table public.stay_plan (
  id uuid primary key default gen_random_uuid(),
  fixture_id text not null references public.fixture (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  kind text not null check (kind in ('procura', 'tem_casa')),
  -- Per person, per night, in whole cents: the most they will pay ('procura'), or what it costs ('tem_casa').
  cents_per_person integer not null check (cents_per_person between 300 and 50000),
  nights smallint not null check (nights between 1 and 14),
  -- 'certo': books anyway. 'se_houver': only if there is someone to share with. Only for 'procura'.
  commitment text check (commitment in ('certo', 'se_houver')),
  -- Beds still free in a place someone already has. Only for 'tem_casa'.
  spare_places smallint check (spare_places between 1 and 10),
  note text check (char_length(btrim(note)) between 2 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, profile_id),
  constraint stay_plan_shape check (
    (kind = 'procura' and commitment is not null and spare_places is null)
    or (kind = 'tem_casa' and spare_places is not null and commitment is null)
  )
);

create index stay_plan_fixture_idx on public.stay_plan (fixture_id);

create trigger stay_plan_set_updated_at
  before update on public.stay_plan
  for each row execute function public.set_updated_at();

alter table public.stay_plan enable row level security;
revoke all on public.stay_plan from anon, authenticated;

-- Saying what you want to do about sleeping over. One per person per game; saying it again corrects it.
create function public.set_stay_plan(
  p_fixture_id text,
  p_kind text,
  p_cents_per_person integer,
  p_nights smallint,
  p_commitment text,
  p_spare_places smallint,
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
  -- Planning happens before the game; after it, nobody needs a bed any more.
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

create function public.remove_stay_plan(p_fixture_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  delete from public.stay_plan where fixture_id = p_fixture_id and profile_id = auth.uid();
end;
$$;

-- Who is sorting out a bed for this game: first the ones who already have a place with room, then whoever is surest.
create function public.fixture_stay_plans(p_fixture_id text)
returns table (
  id uuid,
  display_name text,
  kind text,
  cents_per_person integer,
  nights smallint,
  commitment text,
  spare_places smallint,
  note text,
  updated_on date,
  is_mine boolean
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
    s.cents_per_person,
    s.nights,
    s.commitment,
    s.spare_places,
    s.note,
    s.updated_at::date,
    s.profile_id = auth.uid()
  from public.stay_plan as s
  join public.profile as p on p.id = s.profile_id
  where s.fixture_id = p_fixture_id and auth.uid() is not null
  order by
    case when s.kind = 'tem_casa' then 0 else 1 end,
    case when s.commitment = 'certo' then 0 else 1 end,
    s.updated_at desc;
$$;

revoke execute on function public.set_stay_plan(text, text, integer, smallint, text, smallint, text)
  from public, anon;
revoke execute on function public.remove_stay_plan(text) from public, anon;
revoke execute on function public.fixture_stay_plans(text) from public, anon;
grant execute on function public.set_stay_plan(text, text, integer, smallint, text, smallint, text)
  to authenticated;
grant execute on function public.remove_stay_plan(text) to authenticated;
grant execute on function public.fixture_stay_plans(text) to authenticated;

-- A day after the game, an intention about a bed is just noise.
create function public.delete_old_stay_plans()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.stay_plan as s
    using public.fixture as f
    where f.id = s.fixture_id and f.kickoff_at < now() - interval '1 day'
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function public.delete_old_stay_plans() from public, anon, authenticated;

select cron.schedule('delete-old-stay-plans', '37 3 * * *', $$ select public.delete_old_stay_plans(); $$);
