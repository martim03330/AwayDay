-- A check-in ends by itself when a game starts at that tasco's stadium: whoever was at the tasco went to the game.
-- Nobody has to remember to check out, and the coach stops saying "you are still at the tasco" after kick-off.
-- 1. refresh_place_pulse (every 5 minutes and on every check-in) first ends those check-ins.
-- 2. coach_context only reports an active check-in until kick-off. It also uses p_now instead of now(), so the
--    demo clock gives the same answer as the app.

create or replace function public.refresh_place_pulse()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  published integer;
begin
  perform pg_advisory_xact_lock(hashtext('place_pulse'));

  -- Kick-off at the tasco's stadium after the check-in: presence ends at kick-off.
  update public.checkin as c
  set ended_at = f.kickoff_at
  from public.place as pl, public.fixture as f
  where c.ended_at is null
    and c.expires_at > now()
    and pl.id = c.place_id
    and f.venue_id = pl.venue_id
    and f.kickoff_at > c.created_at
    and f.kickoff_at <= now();

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

revoke execute on function public.refresh_place_pulse() from public, anon, authenticated;
grant execute on function public.refresh_place_pulse() to service_role;

create or replace function public.coach_context(p_profile_id uuid, p_now timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  -- Same numbers as the app's match-day clock (src/lib/jogos.ts and src/lib/relogio.ts).
  match_length constant interval := interval '115 minutes';
  after_match constant interval := interval '3 hours';
  today constant date := (p_now at time zone 'Europe/Lisbon')::date;

  passport integer;
  baseline integer;
  milestone integer;

  checkin_id uuid;
  checkin_at timestamptz;
  checkin_venue text;
  checkin_place jsonb;
  checkin_kickoff timestamptz;

  nearest_fixture text;
  nearest_venue text;

  match_fixture text;
  match_venue text;
  match_kickoff timestamptz;
  match_club text;
  phase text;

  new_fixture text;
  new_venue text;
  new_kickoff timestamptz;
  new_club text;
  new_going boolean;

  context_kind text;
  context_fixture text;
  context_venue text;
  facts jsonb;
begin
  -- Passport: different stadiums where the user marked attendance.
  select count(distinct f.venue_id)::integer
    into passport
  from public.fixture_attendance as fa
  join public.fixture as f on f.id = fa.fixture_id
  where fa.profile_id = p_profile_id and fa.status = 'attended';

  select cs.last_passport_count
    into baseline
  from public.coach_state as cs
  where cs.profile_id = p_profile_id;

  -- A milestone passed since the app last asked. Never on the first ask: there is nothing to compare with.
  select max(m)
    into milestone
  from unnest(array[3, 5, 10, 15, 20, 25, 30, 40, 50]) as m
  where baseline is not null and m > baseline and m <= passport;

  -- The user's latest check-in (their own history only).
  select pv.id, pv.visited_at, pl.venue_id,
         jsonb_build_object('name', pl.name, 'article', pl.name_article, 'walking_minutes', pl.walking_minutes)
    into checkin_id, checkin_at, checkin_venue, checkin_place
  from public.place_visit as pv
  join public.place as pl on pl.id = pv.place_id
  where pv.profile_id = p_profile_id and pv.source = 'check-in'
  order by pv.visited_at desc, pv.id
  limit 1;

  -- Nearest fixture of the user's clubs that is not over (up to 3 hours after the final whistle).
  select f.id, f.venue_id
    into nearest_fixture, nearest_venue
  from public.fixture as f
  where f.kickoff_at + match_length + after_match > p_now
    and exists (
      select 1 from public.profile_club as pc
      where pc.profile_id = p_profile_id and pc.club_id in (f.home_club_id, f.away_club_id)
    )
  order by f.kickoff_at, f.id
  limit 1;

  -- Match day of the supported club: from midnight in Lisbon until 3 hours after the final whistle.
  select f.id, f.venue_id, f.kickoff_at, pc.club_id
    into match_fixture, match_venue, match_kickoff, match_club
  from public.fixture as f
  join public.profile_club as pc
    on pc.profile_id = p_profile_id
   and pc.relation = 'supporter'
   and pc.club_id in (f.home_club_id, f.away_club_id)
  where f.kickoff_at + match_length + after_match > p_now
    and (f.kickoff_at at time zone 'Europe/Lisbon')::date <= today
  order by f.kickoff_at, f.id
  limit 1;

  if match_fixture is not null then
    phase := case
      when p_now >= match_kickoff + match_length then 'fim'
      when p_now >= match_kickoff then 'a_decorrer'
      when match_kickoff - p_now > interval '4 hours' then 'manha'
      when match_kickoff - p_now > interval '90 minutes' then 'chegada'
      else 'antes_do_apito'
    end;
  end if;

  -- A stadium the user has never been to, where one of their clubs plays within 7 days. At least 2 days
  -- ahead, so there is time to plan the trip; closer than that only if they already said they are going.
  select f.id, f.venue_id, f.kickoff_at, pc.club_id, coalesce(fa.status = 'going', false)
    into new_fixture, new_venue, new_kickoff, new_club, new_going
  from public.fixture as f
  join public.profile_club as pc
    on pc.profile_id = p_profile_id and pc.club_id in (f.home_club_id, f.away_club_id)
  left join public.fixture_attendance as fa
    on fa.profile_id = p_profile_id and fa.fixture_id = f.id
  where f.kickoff_at > p_now
    and f.kickoff_at <= p_now + interval '7 days'
    and (f.kickoff_at >= p_now + interval '2 days' or fa.status = 'going')
    and not exists (
      select 1
      from public.fixture_attendance as fa2
      join public.fixture as f2 on f2.id = fa2.fixture_id
      where fa2.profile_id = p_profile_id and fa2.status = 'attended' and f2.venue_id = f.venue_id
    )
  order by f.kickoff_at, (pc.relation = 'supporter') desc, f.id
  limit 1;

  if phase = 'a_decorrer' then
    context_kind := null;
  elsif checkin_at is not null
    and checkin_at >= p_now - interval '3 hours'
    and checkin_at <= p_now
    -- A game started at that stadium since the check-in: they left for the game, the check-in is over.
    and not exists (
      select 1 from public.fixture as f
      where f.venue_id = checkin_venue and f.kickoff_at > checkin_at and f.kickoff_at <= p_now
    ) then
    context_kind := 'checkin_ativo';
    context_venue := checkin_venue;
    select f.id, f.kickoff_at
      into context_fixture, checkin_kickoff
    from public.fixture as f
    where f.venue_id = checkin_venue and (f.kickoff_at at time zone 'Europe/Lisbon')::date = today
    order by f.kickoff_at, f.id
    limit 1;
    facts := jsonb_build_object(
      'place', checkin_place,
      'venue', public.coach_venue_facts(checkin_venue),
      'kickoff_at', checkin_kickoff
    );
  elsif phase is not null then
    context_kind := 'dia_de_jogo_' || phase;
    context_fixture := match_fixture;
    context_venue := match_venue;
    facts := jsonb_build_object(
      'club', public.coach_club_facts(match_club),
      'venue', public.coach_venue_facts(match_venue),
      'kickoff_at', match_kickoff,
      'place', public.coach_nearby_place(match_venue)
    );
  elsif milestone is not null then
    context_kind := 'marco_passaporte';
    -- The newest stamp: the stadium whose first visit is the most recent.
    select first_visit.venue_id
      into context_venue
    from (
      select f.venue_id, min(f.kickoff_at) as first_kickoff
      from public.fixture_attendance as fa
      join public.fixture as f on f.id = fa.fixture_id
      where fa.profile_id = p_profile_id and fa.status = 'attended'
      group by f.venue_id
    ) as first_visit
    order by first_visit.first_kickoff desc, first_visit.venue_id
    limit 1;
    -- The real count: `milestone` only decides that there is something to celebrate.
    facts := jsonb_build_object(
      'count', passport,
      'milestone', milestone,
      'venue', public.coach_venue_facts(context_venue)
    );
  elsif new_fixture is not null then
    context_kind := 'estadio_novo';
    context_fixture := new_fixture;
    context_venue := new_venue;
    facts := jsonb_build_object(
      'club', public.coach_club_facts(new_club),
      'venue', public.coach_venue_facts(new_venue),
      'kickoff_at', new_kickoff,
      'going', new_going,
      'place', public.coach_nearby_place(new_venue)
    );
  end if;

  return jsonb_build_object(
    'passport_count', passport,
    'kind', context_kind,
    'fixture_id', context_fixture,
    'facts', facts,
    'context_key', case when context_kind is null then null else concat_ws('|',
      'v1',
      context_kind,
      coalesce(context_fixture, nearest_fixture, '-'),
      coalesce(case when context_kind = 'checkin_ativo' then null else phase end, '-'),
      coalesce(context_venue, nearest_venue, '-'),
      coalesce(checkin_id::text, '-'),
      passport::text
    ) end
  );
end;
$$;
