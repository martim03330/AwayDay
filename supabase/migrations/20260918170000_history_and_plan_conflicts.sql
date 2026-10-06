-- O histórico do grupo, como recordação; e um só plano fechado por pessoa e por jogo.
--
-- **Histórico.** Passa a ser das viagens que já aconteceram (o jogo já passou) em que foram **pelo menos duas pessoas
-- do grupo** — não é preciso ter ido toda a gente, e assim quem ficou em casa vê o que perdeu. Cada viagem guarda o
-- que é giro de lembrar: quem foi, o álbum de fotos, quanto se gastou e a maior extravagância. As fotos são de quem
-- foi (só essas pessoas as põem), e vê-as quem foi e quem é de um grupo que teve pelo menos duas pessoas na viagem.
-- Ficam num balde privado (`trip-photos`), numa pasta por sessão.
--
-- **Planos em conflito.** Quem já está num plano **fechado** para um jogo (disse «vou») não pode dizer que vai noutro
-- plano para o mesmo jogo, noutro grupo. Nesse outro plano aparece «já vais com a Malta do café», e aos outros
-- aparece que essa pessoa já vai com outro grupo.

-- Histórico e álbum -------------------------------------------------------------------------------------------------

/** Esta pessoa vê as recordações da viagem: foi, ou é de um grupo que teve pelo menos duas pessoas lá. */
create function public.can_see_trip_memories(p_session_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile_id is not null and (
    public.is_trip_member(p_session_id, p_profile_id)
    or exists (
      select 1
      from public.fan_group_member as eu
      where eu.profile_id = p_profile_id
        and (
          select count(*)
          from public.fan_group_member as m
          join public.trip_session_people(p_session_id) as foi on foi.profile_id = m.profile_id
          where m.group_id = eu.group_id
        ) >= 2
    )
  );
$$;

/** A pasta do balde é de uma sessão (sem rebentar com nomes que não são um uuid). */
create function public.trip_folder_session(p_folder text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_folder::uuid
  end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-photos', 'trip-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/heic'])
on conflict (id) do nothing;

create policy "trip memories are seen by who went and their groups"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'trip-photos'
    and public.can_see_trip_memories(
      public.trip_folder_session((storage.foldername(name))[1]), (select auth.uid())
    )
  );
create policy "who went adds trip photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trip-photos'
    and public.is_trip_member(
      public.trip_folder_session((storage.foldername(name))[1]), (select auth.uid())
    )
  );
create policy "who went removes their trip photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'trip-photos'
    and owner_id = (select auth.uid())::text
  );

create table public.trip_photo (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.trip_session (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  storage_path text not null check (storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$'),
  caption text check (caption is null or char_length(btrim(caption)) between 1 and 140),
  created_at timestamptz not null default now()
);

create index trip_photo_session_idx on public.trip_photo (session_id, created_at);

alter table public.trip_photo enable row level security;
revoke all on public.trip_photo from anon, authenticated;

create function public.add_trip_photo(p_session_id uuid, p_path text, p_caption text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  nova uuid;
begin
  if caller is null or not public.is_trip_member(p_session_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_path is null or p_path !~ ('^' || p_session_id::text || '/[A-Za-z0-9._-]{1,100}$') then
    raise exception 'bad_path' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'trip-photo', 60, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  insert into public.trip_photo (session_id, profile_id, storage_path, caption)
  values (p_session_id, caller, p_path, nullif(btrim(coalesce(p_caption, '')), ''))
  returning id into nova;
  return nova;
end;
$$;

create function public.remove_trip_photo(p_photo_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caminho text;
begin
  delete from public.trip_photo where id = p_photo_id and profile_id = auth.uid()
  returning storage_path into caminho;
  if caminho is null then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  return caminho;
end;
$$;

create function public.trip_photos(p_session_id uuid)
returns table (id uuid, profile_id uuid, display_name text, storage_path text, caption text, created_at timestamptz, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, f.profile_id, p.display_name, f.storage_path, f.caption, f.created_at, f.profile_id = auth.uid()
  from public.trip_photo as f
  join public.profile as p on p.id = f.profile_id
  where f.session_id = p_session_id and public.can_see_trip_memories(p_session_id, auth.uid())
  order by f.created_at;
$$;

/**
 * O histórico de um grupo: as viagens já feitas (jogo passado) em que foram pelo menos duas pessoas do grupo. Da mais
 * recente para a mais antiga, com o que se mostra no cartão.
 */
create function public.group_history(p_group_id uuid)
returns table (
  session_id uuid,
  fixture_id text,
  kickoff_at timestamptz,
  companions text[],
  companions_count integer,
  people integer,
  total_cents integer,
  photos integer,
  cover_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.fixture_id,
    f.kickoff_at,
    array(
      select p.display_name
      from public.trip_session_people(s.id) as foi
      join public.fan_group_member as m on m.profile_id = foi.profile_id and m.group_id = p_group_id
      join public.profile as p on p.id = foi.profile_id
      order by p.display_name
    ),
    da_malta.n,
    (select count(*)::integer from public.trip_session_people(s.id)),
    coalesce((select sum(e.cents)::integer from public.trip_expense as e where e.session_id = s.id), 0),
    (select count(*)::integer from public.trip_photo as ph where ph.session_id = s.id),
    (select ph.storage_path from public.trip_photo as ph where ph.session_id = s.id order by ph.created_at limit 1)
  from public.trip_session as s
  join public.fixture as f on f.id = s.fixture_id
  cross join lateral (
    select count(*)::integer as n
    from public.trip_session_people(s.id) as foi
    join public.fan_group_member as m on m.profile_id = foi.profile_id and m.group_id = p_group_id
  ) as da_malta
  where public.is_group_member(p_group_id, auth.uid())
    and f.kickoff_at < now()
    and da_malta.n >= 2
  order by f.kickoff_at desc;
$$;

/** Uma viagem, como recordação: quem foi, quanto se gastou, a maior despesa e as fotos. */
create function public.trip_memory(p_session_id uuid)
returns table (
  session_id uuid,
  name text,
  fixture_id text,
  kickoff_at timestamptz,
  people_names text[],
  total_cents integer,
  expenses integer,
  biggest_description text,
  biggest_cents integer,
  photos integer,
  i_went boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.name,
    s.fixture_id,
    f.kickoff_at,
    array(
      select p.display_name
      from public.trip_session_people(s.id) as foi
      join public.profile as p on p.id = foi.profile_id
      order by p.display_name
    ),
    coalesce((select sum(e.cents)::integer from public.trip_expense as e where e.session_id = s.id), 0),
    (select count(*)::integer from public.trip_expense as e where e.session_id = s.id),
    maior.description,
    maior.cents,
    (select count(*)::integer from public.trip_photo as ph where ph.session_id = s.id),
    public.is_trip_member(s.id, auth.uid())
  from public.trip_session as s
  join public.fixture as f on f.id = s.fixture_id
  left join lateral (
    select e.description, e.cents from public.trip_expense as e
    where e.session_id = s.id and e.source = 'manual'
    order by e.cents desc
    limit 1
  ) as maior on true
  where s.id = p_session_id and public.can_see_trip_memories(p_session_id, auth.uid());
$$;

-- Planos em conflito ------------------------------------------------------------------------------------------------

/** O grupo do plano fechado em que esta pessoa já vai a este jogo, fora deste plano. `null` se não houver. */
create function public.closed_plan_elsewhere(p_plan_id uuid, p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select g.name
  from public.fixture_plan as este
  join public.fixture_plan as outro
    on outro.fixture_id = este.fixture_id and outro.id <> este.id and outro.status = 'fechado'
  join public.fixture_plan_answer as a
    on a.plan_id = outro.id and a.profile_id = p_profile_id and a.answer = 'vou'
  join public.fan_group as g on g.id = outro.group_id
  where este.id = p_plan_id
  order by outro.closed_at
  limit 1;
$$;

/** Para cada plano pedido, o grupo com que já vou a esse jogo noutro plano fechado. */
create function public.my_plan_conflicts(p_plan_ids uuid[])
returns table (plan_id uuid, other_group text)
language sql
stable
security definer
set search_path = ''
as $$
  select fp.id, public.closed_plan_elsewhere(fp.id, auth.uid())
  from public.fixture_plan as fp
  where fp.id = any (p_plan_ids)
    and auth.uid() is not null
    and public.can_see_fixture_plan(fp.id, auth.uid())
    and public.closed_plan_elsewhere(fp.id, auth.uid()) is not null;
$$;

-- Quem respondeu passa a trazer o grupo com que já vai, se for o caso.
drop function public.fixture_plan_people(uuid);

create function public.fixture_plan_people(p_plan_id uuid)
returns table (profile_id uuid, display_name text, answer text, is_me boolean, other_group text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.profile_id, p.display_name, a.answer, a.profile_id = auth.uid(),
    public.closed_plan_elsewhere(p_plan_id, a.profile_id)
  from public.fixture_plan_answer as a
  join public.profile as p on p.id = a.profile_id
  where a.plan_id = p_plan_id and public.can_see_fixture_plan(p_plan_id, auth.uid())
  order by case a.answer when 'vou' then 0 else 1 end, a.updated_at;
$$;

-- Dizer que vai (ou entrar no carro) noutro plano para o mesmo jogo fica recusado.
create or replace function public.answer_fixture_plan(p_plan_id uuid, p_answer text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  estado text;
begin
  if caller is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  select fp.status into estado from public.fixture_plan as fp where fp.id = p_plan_id;
  if estado <> 'aberto' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;
  if p_answer is null then
    delete from public.fixture_plan_answer where plan_id = p_plan_id and profile_id = caller;
    return;
  end if;
  if p_answer not in ('vou', 'talvez') then
    raise exception 'bad_answer' using errcode = '22023';
  end if;
  if public.closed_plan_elsewhere(p_plan_id, caller) is not null then
    raise exception 'already_going' using errcode = '22023';
  end if;
  insert into public.fixture_plan_answer (plan_id, profile_id, answer)
  values (p_plan_id, caller, p_answer)
  on conflict (plan_id, profile_id) do update set answer = excluded.answer, updated_at = now();
end;
$$;

-- Entrar direto no carro de outro plano para o mesmo jogo também.
create or replace function public.join_plan_ride(p_plan_id uuid)
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
  if public.closed_plan_elsewhere(p_plan_id, caller) is not null then
    raise exception 'already_going' using errcode = '22023';
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

revoke execute on function public.can_see_trip_memories(uuid, uuid) from public, anon;
revoke execute on function public.trip_folder_session(text) from public, anon;
revoke execute on function public.add_trip_photo(uuid, text, text) from public, anon;
revoke execute on function public.remove_trip_photo(uuid) from public, anon;
revoke execute on function public.trip_photos(uuid) from public, anon;
revoke execute on function public.group_history(uuid) from public, anon;
revoke execute on function public.trip_memory(uuid) from public, anon;
revoke execute on function public.closed_plan_elsewhere(uuid, uuid) from public, anon;
revoke execute on function public.my_plan_conflicts(uuid[]) from public, anon;
revoke execute on function public.fixture_plan_people(uuid) from public, anon;
grant execute on function public.can_see_trip_memories(uuid, uuid) to authenticated;
grant execute on function public.trip_folder_session(text) to authenticated;
grant execute on function public.add_trip_photo(uuid, text, text) to authenticated;
grant execute on function public.remove_trip_photo(uuid) to authenticated;
grant execute on function public.trip_photos(uuid) to authenticated;
grant execute on function public.group_history(uuid) to authenticated;
grant execute on function public.trip_memory(uuid) to authenticated;
grant execute on function public.closed_plan_elsewhere(uuid, uuid) to authenticated;
grant execute on function public.my_plan_conflicts(uuid[]) to authenticated;
grant execute on function public.fixture_plan_people(uuid) to authenticated;
