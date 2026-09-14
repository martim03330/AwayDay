-- Coach messages: written when the app opens and by the daily push, at most one per context.
-- The context (facts and key) is computed here, in SQL; the Edge Functions only turn it into a sentence.
-- Messages reuse the nudge table, so they show up in Novidades with the same read state and privacy.

-- "One per context" replaces "one per day" and "once per fixture": a match day has several phases.
alter table public.nudge drop constraint nudge_one_per_day;
drop index public.nudge_once_per_fixture;

alter table public.nudge drop constraint nudge_kind_check;
alter table public.nudge add constraint nudge_kind_check check (
  kind in (
    'dia_de_jogo_manha', 'dia_de_jogo_chegada', 'dia_de_jogo_antes_do_apito', 'dia_de_jogo_fim',
    'checkin_ativo', 'marco_passaporte', 'estadio_novo',
    -- Earlier kinds, kept only for rows that already exist.
    'tasco_primeira_visita', 'estadio_novo_em_casa', 'clube_perto_de_ti'
  )
);

-- 'in_app': written for the app when it opened, never pushed.
alter table public.nudge drop constraint nudge_push_status_check;
alter table public.nudge add constraint nudge_push_status_check
  check (push_status in ('pending', 'sent', 'no_device', 'failed', 'in_app'));

alter table public.nudge add column context_key text check (char_length(context_key) between 1 and 300);
create unique index nudge_one_per_context on public.nudge (profile_id, context_key)
  where context_key is not null;

-- What the coach remembers about each user: when the app last asked, the passport count at that moment
-- (to spot a milestone reached since then) and when a message was last delivered (for the 6-hour rule).
create table public.coach_state (
  profile_id uuid primary key references public.profile (id) on delete cascade,
  last_opened_at timestamptz,
  last_passport_count integer check (last_passport_count >= 0),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger coach_state_set_updated_at
  before update on public.coach_state
  for each row execute function public.set_updated_at();

alter table public.coach_state enable row level security;

create policy "users read their own coach state"
  on public.coach_state for select to authenticated
  using ((select auth.uid()) = profile_id);
-- No insert, update or delete policies: only the Edge Functions (service role) write it.

revoke all on public.coach_state from anon, authenticated;
grant select on public.coach_state to authenticated;

-- Replaced by coach_context and coach_push_candidates.
drop function public.nudge_candidates(timestamptz);

-- Facts about a venue, a club and the nearest place on foot, in the shape the Edge Functions expect.
create function public.coach_venue_facts(p_venue_id text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'name', v.name, 'article', v.name_article,
    'short_name', v.short_name, 'short_article', v.short_name_article
  )
  from public.venue as v
  where v.id = p_venue_id;
$$;

create function public.coach_club_facts(p_club_id text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('name', c.short_name, 'article', c.name_article)
  from public.club as c
  where c.id = p_club_id;
$$;

create function public.coach_nearby_place(p_venue_id text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('name', pl.name, 'article', pl.name_article, 'walking_minutes', pl.walking_minutes)
  from public.place as pl
  where pl.venue_id = p_venue_id and pl.walking_minutes <= 10
  order by pl.walking_minutes, pl.id
  limit 1;
$$;

-- The one context worth a message for a user right now, or none. Priority: an active check-in, then the
-- supported club's match day (by phase), then a passport milestone reached since the app last asked, then a
-- stadium never visited where one of the user's clubs plays soon. During a match the coach stays quiet.
-- `p_now` may be moved by the app's demo mode; check-ins always use the real clock.
-- The key changes when any of these change: nearest fixture, phase, stadium, last check-in, passport count.
create function public.coach_context(p_profile_id uuid, p_now timestamptz default now())
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
  elsif checkin_at is not null and checkin_at >= now() - interval '3 hours' then
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
    select f.venue_id
      into context_venue
    from public.fixture_attendance as fa
    join public.fixture as f on f.id = fa.fixture_id
    where fa.profile_id = p_profile_id and fa.status = 'attended'
    order by f.kickoff_at desc, f.id
    limit 1;
    facts := jsonb_build_object('count', milestone, 'venue', public.coach_venue_facts(context_venue));
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
      coalesce(phase, '-'),
      coalesce(context_venue, nearest_venue, '-'),
      coalesce(checkin_id::text, '-'),
      passport::text
    ) end
  );
end;
$$;

-- Who gets today's push: wants suggestions, has a phone registered, got no message in the last 6 hours and
-- has a context worth a message. An active check-in is left to the app (the user is already using it).
create function public.coach_push_candidates(p_now timestamptz default now())
returns table (profile_id uuid, context jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select candidate.profile_id, candidate.context
  from (
    select p.id as profile_id, public.coach_context(p.id, p_now) as context
    from public.profile as p
    left join public.coach_state as cs on cs.profile_id = p.id
    where p.nudges_enabled
      and exists (select 1 from public.device_token as dt where dt.profile_id = p.id)
      and (cs.last_message_at is null or cs.last_message_at <= p_now - interval '6 hours')
  ) as candidate
  where candidate.context ->> 'kind' is not null
    and candidate.context ->> 'kind' <> 'checkin_ativo';
$$;

-- Only the service role runs these (they read every user's activity).
revoke execute on function public.coach_venue_facts(text) from public, anon, authenticated;
revoke execute on function public.coach_club_facts(text) from public, anon, authenticated;
revoke execute on function public.coach_nearby_place(text) from public, anon, authenticated;
revoke execute on function public.coach_context(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.coach_push_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.coach_venue_facts(text) to service_role;
grant execute on function public.coach_club_facts(text) to service_role;
grant execute on function public.coach_nearby_place(text) to service_role;
grant execute on function public.coach_context(uuid, timestamptz) to service_role;
grant execute on function public.coach_push_candidates(timestamptz) to service_role;
