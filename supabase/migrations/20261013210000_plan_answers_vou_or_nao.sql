-- A plan's answers are «vou» or «não vou» (owner's request, 2026-10-13). «Estou a pensar» was one answer too many:
-- someone who has not answered yet is the one still thinking about it. The «talvez» answers already given go back to
-- no answer. The `maybe` column of fixture_plan_summaries now counts the «não vou».

delete from public.fixture_plan_answer where answer = 'talvez';
alter table public.fixture_plan_answer drop constraint fixture_plan_answer_answer_check;
alter table public.fixture_plan_answer add constraint fixture_plan_answer_answer_check check (answer in ('vou', 'nao'));

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
  if p_answer not in ('vou', 'nao') then
    raise exception 'bad_answer' using errcode = '22023';
  end if;
  -- Saying «não vou» is always allowed; «vou» not while already going with another group.
  if p_answer = 'vou' and public.closed_plan_elsewhere(p_plan_id, caller) is not null then
    raise exception 'already_going' using errcode = '22023';
  end if;
  insert into public.fixture_plan_answer (plan_id, profile_id, answer)
  values (p_plan_id, caller, p_answer)
  on conflict (plan_id, profile_id) do update set answer = excluded.answer, updated_at = now();
end;
$$;

-- Who answered (vou, then nao) and, as «pensar», who has not answered yet: the members of the plan's groups that the
-- caller is in too (never the members of a group the caller is not part of).
create or replace function public.fixture_plan_people(p_plan_id uuid)
returns table (profile_id uuid, display_name text, answer text, is_me boolean, other_group text)
language sql
stable
security definer
set search_path = ''
as $$
  with grupos as (
    select fp.group_id from public.fixture_plan as fp where fp.id = p_plan_id
    union
    select fg.group_id from public.fixture_plan_group as fg where fg.plan_id = p_plan_id
  ),
  gente as (
    select a.profile_id, a.answer, a.updated_at
    from public.fixture_plan_answer as a
    where a.plan_id = p_plan_id
    union all
    select distinct m.profile_id, 'pensar', null::timestamptz
    from public.fan_group_member as m
    join grupos as g on g.group_id = m.group_id
    where public.is_group_member(m.group_id, auth.uid())
      and not exists (
        select 1 from public.fixture_plan_answer as a where a.plan_id = p_plan_id and a.profile_id = m.profile_id
      )
  )
  select x.profile_id, p.display_name, x.answer, x.profile_id = auth.uid(),
    public.closed_plan_elsewhere(p_plan_id, x.profile_id)
  from gente as x
  join public.profile as p on p.id = x.profile_id
  where public.can_see_fixture_plan(p_plan_id, auth.uid())
  order by case x.answer when 'vou' then 0 when 'nao' then 1 else 2 end, x.updated_at nulls last, p.display_name;
$$;

-- Offering a ride or a house for the game is going, also for who had said «não vou».
create or replace function public.plan_for_group_game(p_group_id uuid, p_fixture_id text, p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  plano uuid;
  estado text;
begin
  -- One at a time per group and game, so a ride and a house at once do not make two plans.
  perform pg_advisory_xact_lock(hashtextextended('plan:' || p_group_id::text || ':' || p_fixture_id, 0));

  -- One plan per group and game: a closed one is left as it is.
  select fp.id, fp.status into plano, estado
  from public.fixture_plan as fp
  where fp.group_id = p_group_id and fp.fixture_id = p_fixture_id
  limit 1;
  if plano is not null and estado <> 'aberto' then
    return null;
  end if;

  if plano is null then
    if not exists (select 1 from public.fixture as f where f.id = p_fixture_id and f.kickoff_at > now()) then
      return null;
    end if;
    insert into public.fixture_plan (group_id, fixture_id, created_by)
    values (p_group_id, p_fixture_id, p_profile_id)
    returning id into plano;
    insert into public.fixture_plan_answer (plan_id, profile_id, answer)
    values (plano, p_profile_id, 'vou')
    on conflict (plan_id, profile_id) do update set answer = 'vou', updated_at = now();
    perform public.post_plan_message(plano, p_group_id, p_profile_id);
  else
    insert into public.fixture_plan_answer (plan_id, profile_id, answer)
    values (plano, p_profile_id, 'vou')
    on conflict (plan_id, profile_id) do update set answer = 'vou', updated_at = now();
  end if;

  return plano;
end;
$$;

create or replace function public.fixture_plan_summaries(p_plan_ids uuid[])
returns table (
  id uuid,
  group_id uuid,
  group_name text,
  fixture_id text,
  kickoff_at timestamptz,
  created_by uuid,
  creator_name text,
  is_mine boolean,
  status text,
  closed_reason text,
  going integer,
  maybe integer,
  my_answer text,
  shared_groups integer,
  ride_id uuid,
  ride_driver_id uuid,
  ride_driver_name text,
  ride_departure_at timestamptz,
  ride_seats_offered integer,
  ride_seats_taken integer,
  ride_share_now_cents integer,
  ride_visibility text,
  ride_round_trip boolean,
  ride_accepts_return boolean,
  ride_my_status text,
  stay_id uuid,
  stay_owner_id uuid,
  stay_owner_name text,
  stay_spare integer,
  stay_taken integer,
  stay_status text,
  stay_visibility text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    fp.id,
    fp.group_id,
    g.name,
    fp.fixture_id,
    f.kickoff_at,
    fp.created_by,
    quem.display_name,
    fp.created_by = auth.uid(),
    fp.status,
    fp.closed_reason,
    (select count(*)::integer from public.fixture_plan_answer as a where a.plan_id = fp.id and a.answer = 'vou'),
    (select count(*)::integer from public.fixture_plan_answer as a where a.plan_id = fp.id and a.answer = 'nao'),
    minha.answer,
    (select count(*)::integer from public.fixture_plan_group as fg where fg.plan_id = fp.id),
    r.id,
    r.driver_id,
    condutor.display_name,
    r.departure_at,
    r.seats_offered::integer,
    lugares.n,
    case when r.id is not null then public.ride_share_cents(r.total_cents, 1 + lugares.n) end,
    r.visibility,
    r.round_trip,
    r.accepts_return_requests,
    case
      when r.driver_id = auth.uid() then 'driver'
      else (select rp.status from public.ride_passenger as rp where rp.ride_id = r.id and rp.profile_id = auth.uid())
    end,
    s.id,
    s.profile_id,
    dono.display_name,
    s.spare_places::integer,
    (select count(*)::integer from public.stay_place as sp where sp.plan_id = s.id and sp.status = 'aceite'),
    s.status,
    s.visibility
  from public.fixture_plan as fp
  join public.fixture as f on f.id = fp.fixture_id
  join public.fan_group as g on g.id = fp.group_id
  join public.profile as quem on quem.id = fp.created_by
  left join public.fixture_plan_answer as minha on minha.plan_id = fp.id and minha.profile_id = auth.uid()
  left join public.ride as r on r.id = fp.ride_id and r.status = 'open'
  left join public.profile as condutor on condutor.id = r.driver_id
  left join lateral (
    select count(*)::integer as n from public.ride_passenger as rp
    where rp.ride_id = r.id and rp.status = 'accepted'
  ) as lugares on true
  left join public.stay_plan as s on s.id = fp.stay_plan_id
  left join public.profile as dono on dono.id = s.profile_id
  where fp.id = any (p_plan_ids)
    and auth.uid() is not null
    and public.can_see_fixture_plan(fp.id, auth.uid());
$$;
