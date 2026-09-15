-- Real presence on match day (slice 3).
-- - checkin: who is at which tasco right now. Only the `check-in` Edge Function changes it, through start_checkin and
--   end_checkin (service role only). No RLS policies: the app never reads it. It stores no coordinates: the phone's
--   position is only used inside the function to measure the distance to the place.
-- - place_pulse: the public aggregates, published only with at least 5 people. Clubs with fewer than 5 people go
--   into `others`.
-- - Check-ins stop counting after 3 hours and are deleted after 48 hours (pg_cron).
-- - Verified visits ("check-in" source) can only be created by the server now; the app adds "manual" visits only.
-- - Rankings show other people only when they opted in (profile.show_in_rankings).
-- - A noise reading needs a verified check-in that day at a tasco near the fixture's stadium.

create table public.checkin (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profile (id) on delete cascade,
  place_id text not null references public.place (id) on delete cascade,
  -- The person's club when they checked in, for the per-club breakdown. Never published below 5 people.
  club_id text references public.club (id) on delete set null,
  -- The verified visit this check-in created in the person's own history.
  place_visit_id uuid references public.place_visit (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '3 hours',
  ended_at timestamptz,
  constraint checkin_expires_after_start check (expires_at > created_at)
);

create index checkin_active_place_idx on public.checkin (place_id) where ended_at is null;
create index checkin_profile_created_idx on public.checkin (profile_id, created_at desc);
create index checkin_created_at_idx on public.checkin (created_at);
create index checkin_club_id_idx on public.checkin (club_id);
create index checkin_place_visit_id_idx on public.checkin (place_visit_id);

alter table public.checkin enable row level security;
-- No policies on purpose: only the service role (Edge Functions) and pg_cron touch this table.
revoke all on public.checkin from anon, authenticated;

create table public.place_pulse (
  place_id text primary key references public.place (id) on delete cascade,
  venue_id text not null references public.venue (id) on delete cascade,
  people integer not null check (people >= 5),
  -- [{"club_id": "benfica", "people": 7}, ...]: only clubs with at least 5 people.
  clubs jsonb not null default '[]'::jsonb check (jsonb_typeof(clubs) = 'array'),
  -- People whose club is unknown or has fewer than 5 people here.
  others integer not null default 0 check (others >= 0),
  updated_at timestamptz not null default now()
);

create index place_pulse_venue_id_idx on public.place_pulse (venue_id);

alter table public.place_pulse enable row level security;

create policy "place pulse is readable by everyone"
  on public.place_pulse for select to anon, authenticated using (true);

revoke all on public.place_pulse from anon, authenticated;
grant select on public.place_pulse to anon, authenticated;

-- Recomputes every aggregate from the active check-ins. Small enough to run in full on each check-in.
create function public.refresh_place_pulse()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  published integer;
begin
  perform pg_advisory_xact_lock(hashtext('place_pulse'));

  with active as (
    select c.place_id, c.club_id
    from public.checkin as c
    where c.ended_at is null and c.expires_at > now()
  ),
  totals as (
    select a.place_id, count(*)::integer as people
    from active as a
    group by a.place_id
    having count(*) >= 5
  ),
  by_club as (
    select a.place_id, a.club_id, count(*)::integer as people
    from active as a
    join totals as t on t.place_id = a.place_id
    where a.club_id is not null
    group by a.place_id, a.club_id
    having count(*) >= 5
  ),
  pulse_rows as (
    select
      t.place_id,
      pl.venue_id,
      t.people,
      coalesce(
        (
          select jsonb_agg(jsonb_build_object('club_id', b.club_id, 'people', b.people) order by b.people desc, b.club_id)
          from by_club as b
          where b.place_id = t.place_id
        ),
        '[]'::jsonb
      ) as clubs,
      t.people - coalesce((select sum(b.people) from by_club as b where b.place_id = t.place_id), 0)::integer
        as others
    from totals as t
    join public.place as pl on pl.id = t.place_id
  ),
  removed as (
    delete from public.place_pulse as pp
    where not exists (select 1 from pulse_rows as r where r.place_id = pp.place_id)
  )
  insert into public.place_pulse (place_id, venue_id, people, clubs, others, updated_at)
  select r.place_id, r.venue_id, r.people, r.clubs, r.others, now()
  from pulse_rows as r
  on conflict (place_id) do update
    set venue_id = excluded.venue_id,
        people = excluded.people,
        clubs = excluded.clubs,
        others = excluded.others,
        updated_at = excluded.updated_at;

  get diagnostics published = row_count;
  return published;
end;
$$;

-- Starts (or keeps) the person's presence at a place, after the Edge Function checked the distance. Any other active
-- check-in of theirs ends: nobody is in two tascos at once. Creates the verified visit in their history.
create function public.start_checkin(p_profile_id uuid, p_place_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.checkin;
  created public.checkin;
  visit public.place_visit;
  supporter text;
begin
  perform pg_advisory_xact_lock(hashtext('checkin:' || p_profile_id::text));

  select * into existing
  from public.checkin as c
  where c.profile_id = p_profile_id and c.place_id = p_place_id and c.ended_at is null and c.expires_at > now()
  order by c.created_at desc
  limit 1;

  if found then
    select * into visit from public.place_visit as v where v.id = existing.place_visit_id;
    return jsonb_build_object(
      'visit_id', existing.place_visit_id,
      'visited_at', coalesce(visit.visited_at, existing.created_at),
      'expires_at', existing.expires_at
    );
  end if;

  update public.checkin set ended_at = now() where profile_id = p_profile_id and ended_at is null;

  select pc.club_id into supporter
  from public.profile_club as pc
  where pc.profile_id = p_profile_id and pc.relation = 'supporter';

  insert into public.place_visit (profile_id, place_id, source)
  values (p_profile_id, p_place_id, 'check-in')
  returning * into visit;

  insert into public.checkin (profile_id, place_id, club_id, place_visit_id)
  values (p_profile_id, p_place_id, supporter, visit.id)
  returning * into created;

  perform public.refresh_place_pulse();

  return jsonb_build_object('visit_id', visit.id, 'visited_at', visit.visited_at, 'expires_at', created.expires_at);
end;
$$;

-- Undoes the person's active check-in at a place: presence ends and the visit it created leaves their history.
create function public.end_checkin(p_profile_id uuid, p_place_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ended public.checkin;
begin
  perform pg_advisory_xact_lock(hashtext('checkin:' || p_profile_id::text));

  update public.checkin as c
  set ended_at = now()
  where c.id = (
    select a.id
    from public.checkin as a
    where a.profile_id = p_profile_id and a.place_id = p_place_id and a.ended_at is null and a.expires_at > now()
    order by a.created_at desc
    limit 1
  )
  returning * into ended;

  if not found then
    return false;
  end if;

  if ended.place_visit_id is not null then
    delete from public.place_visit as v where v.id = ended.place_visit_id and v.profile_id = p_profile_id;
  end if;

  perform public.refresh_place_pulse();
  return true;
end;
$$;

revoke execute on function public.refresh_place_pulse() from public, anon, authenticated;
revoke execute on function public.start_checkin(uuid, text) from public, anon, authenticated;
revoke execute on function public.end_checkin(uuid, text) from public, anon, authenticated;
grant execute on function public.refresh_place_pulse() to service_role;
grant execute on function public.start_checkin(uuid, text) to service_role;
grant execute on function public.end_checkin(uuid, text) to service_role;

-- Expired check-ins leave the aggregates within 5 minutes; every check-in is deleted after 48 hours.
select cron.schedule('refresh-place-pulse', '*/5 * * * *', $$select public.refresh_place_pulse()$$);
select cron.schedule(
  'delete-old-checkins',
  '17 * * * *',
  $$delete from public.checkin where created_at < now() - interval '48 hours'$$
);

-- Verified visits only come from start_checkin.
drop policy "users add visits to their own history, never in the future" on public.place_visit;
create policy "users add unverified visits to their own history, never in the future"
  on public.place_visit for insert to authenticated
  with check (
    (select auth.uid()) = profile_id
    and source = 'manual'
    and visited_at <= now() + interval '5 minutes'
  );

-- Rankings: other people only appear when they say so.
alter table public.profile add column show_in_rankings boolean not null default false;
grant update (show_in_rankings) on public.profile to authenticated;

-- Distinct tascos with a verified visit. The caller always gets their own line; others only if they opted in and
-- have at least one. Positions follow the order (ties: the caller first).
create function public.verified_places_ranking(p_limit integer default 10)
returns table (rank_position integer, is_me boolean, display_name text, club_id text, verified_places integer)
language sql
stable
security definer
set search_path = ''
as $$
  with scores as (
    select v.profile_id, count(distinct v.place_id)::integer as verified_places
    from public.place_visit as v
    where v.source = 'check-in'
    group by v.profile_id
  ),
  eligible as (
    select
      p.id as profile_id,
      p.display_name,
      coalesce(s.verified_places, 0) as verified_places,
      p.id = auth.uid() as is_me
    from public.profile as p
    left join scores as s on s.profile_id = p.id
    where (p.show_in_rankings and s.verified_places > 0) or p.id = auth.uid()
  ),
  ranked as (
    select
      e.*,
      row_number() over (order by e.verified_places desc, e.is_me desc, e.display_name, e.profile_id)::integer
        as ordinal
    from eligible as e
  )
  select r.ordinal, r.is_me, r.display_name, pc.club_id, r.verified_places
  from ranked as r
  left join public.profile_club as pc on pc.profile_id = r.profile_id and pc.relation = 'supporter'
  where r.ordinal <= least(greatest(coalesce(p_limit, 10), 1), 50) or r.is_me
  order by r.ordinal;
$$;

-- The best reading per person in one fixture. Same visibility rule as above.
create function public.noise_ranking(p_fixture_id text, p_limit integer default 10)
returns table (rank_position integer, is_me boolean, display_name text, club_id text, level integer)
language sql
stable
security definer
set search_path = ''
as $$
  with best as (
    select m.profile_id, max(m.level)::integer as level
    from public.noise_measurement as m
    where m.fixture_id = p_fixture_id
    group by m.profile_id
  ),
  eligible as (
    select b.profile_id, p.display_name, b.level, p.id = auth.uid() as is_me
    from best as b
    join public.profile as p on p.id = b.profile_id
    where p.show_in_rankings or p.id = auth.uid()
  ),
  ranked as (
    select
      e.*,
      row_number() over (order by e.level desc, e.is_me desc, e.display_name, e.profile_id)::integer as ordinal
    from eligible as e
  )
  select r.ordinal, r.is_me, r.display_name, pc.club_id, r.level
  from ranked as r
  left join public.profile_club as pc on pc.profile_id = r.profile_id and pc.relation = 'supporter'
  where r.ordinal <= least(greatest(coalesce(p_limit, 10), 1), 50) or r.is_me
  order by r.ordinal;
$$;

revoke execute on function public.verified_places_ranking(integer) from public, anon;
revoke execute on function public.noise_ranking(text, integer) from public, anon;
grant execute on function public.verified_places_ranking(integer) to authenticated;
grant execute on function public.noise_ranking(text, integer) to authenticated;

-- Noise readings now also need a verified check-in that day (in Lisbon) at a tasco near the fixture's stadium.
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

  if not exists (
    select 1
    from public.place_visit as v
    join public.place as pl on pl.id = v.place_id
    where v.profile_id = caller
      and v.source = 'check-in'
      and pl.venue_id = fixture_venue
      and (v.visited_at at time zone 'Europe/Lisbon')::date = (kickoff at time zone 'Europe/Lisbon')::date
  ) then
    raise exception 'noise_needs_checkin' using errcode = '42501';
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
