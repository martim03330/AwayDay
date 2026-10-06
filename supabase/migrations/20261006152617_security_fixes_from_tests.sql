-- Holes found by the access tests (supabase/tests/acesso_*.test.sql). Each fix has a test asserting the right
-- behaviour; the tests are the specification.
--
--  1. A group kept no owner when its owner deleted their account.
--  2. Helper functions answered questions about OTHER people (who is friends with whom, who is in which group, who
--     went where) to any signed-in account. They are only for the server's own functions now; the storage policies
--     that needed three of them use new wrappers that only ever ask about the caller.
--  3. The display name could be changed without the weekly limit (direct column grant).
--  4. Feedback without an account had no limit at all.
--  5. Rides: a seat home could be asked for in a group-only car by outsiders; the no-show suspension could be skipped
--     through a group plan or a ride invite; invites and plans could overbook a round trip's way back.
--  6. The names of people in a group-only house were visible to anyone with its id.
--  7. An old, broken overload of set_stay_plan was still callable.
--  8. Who sent a tasco photo, suggested a dish or a tasco could be read by anyone (the photographer is never shown).
--  9. A home-fan street or zone could be published from 3 people; every aggregate needs 5 different people.
-- 10. A stadium could be stamped from up to 1049 m (the distance was rounded before the 1000 m check).

-- 1. Ownership passes on however a member leaves (leave_group already did it; account deletion did not).
create function public.fan_group_member_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  seguinte uuid;
begin
  if old.role <> 'owner' or not exists (select 1 from public.fan_group where id = old.group_id) then
    return null;
  end if;
  if exists (select 1 from public.fan_group_member where group_id = old.group_id and role = 'owner') then
    return null;
  end if;
  select profile_id into seguinte
  from public.fan_group_member where group_id = old.group_id
  order by joined_at limit 1;
  if seguinte is null then
    delete from public.fan_group where id = old.group_id;
  else
    update public.fan_group_member set role = 'owner'
    where group_id = old.group_id and profile_id = seguinte;
  end if;
  return null;
end;
$$;

revoke execute on function public.fan_group_member_after_delete() from public, anon, authenticated;

create trigger fan_group_member_owner_handover
  after delete on public.fan_group_member
  for each row execute function public.fan_group_member_after_delete();

-- 2. Storage policies ask only about the caller.
create function public.caller_in_group_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_group_folder_member(p_folder, auth.uid());
$$;

create function public.caller_is_trip_member(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_trip_member(p_session_id, auth.uid());
$$;

create function public.caller_sees_trip_memories(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_see_trip_memories(p_session_id, auth.uid());
$$;

revoke execute on function public.caller_in_group_folder(text) from public, anon;
revoke execute on function public.caller_is_trip_member(uuid) from public, anon;
revoke execute on function public.caller_sees_trip_memories(uuid) from public, anon;
grant execute on function public.caller_in_group_folder(text) to authenticated;
grant execute on function public.caller_is_trip_member(uuid) to authenticated;
grant execute on function public.caller_sees_trip_memories(uuid) to authenticated;

drop policy "group members see group photos" on storage.objects;
drop policy "group members upload group photos" on storage.objects;
drop policy "group members replace group photos" on storage.objects;
drop policy "group members delete group photos" on storage.objects;
drop policy "trip memories are seen by who went and their groups" on storage.objects;
drop policy "who went adds trip photos" on storage.objects;

create policy "group members see group photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'group-photos' and public.caller_in_group_folder((storage.foldername(name))[1]));
create policy "group members upload group photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'group-photos' and public.caller_in_group_folder((storage.foldername(name))[1]));
create policy "group members replace group photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'group-photos' and public.caller_in_group_folder((storage.foldername(name))[1]))
  with check (bucket_id = 'group-photos' and public.caller_in_group_folder((storage.foldername(name))[1]));
create policy "group members delete group photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'group-photos' and public.caller_in_group_folder((storage.foldername(name))[1]));
create policy "trip memories are seen by who went and their groups"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'trip-photos'
    and public.caller_sees_trip_memories(public.trip_folder_session((storage.foldername(name))[1]))
  );
create policy "who went adds trip photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trip-photos'
    and public.caller_is_trip_member(public.trip_folder_session((storage.foldername(name))[1]))
  );

revoke execute on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.trips_together(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.is_group_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.closed_plan_elsewhere(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.can_see_private_ride(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.can_see_private_stay(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.is_fixture_plan_house(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.can_see_fixture_plan(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.is_group_folder_member(text, uuid) from public, anon, authenticated;
revoke execute on function public.is_trip_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.can_see_trip_memories(uuid, uuid) from public, anon, authenticated;

-- 3. The name changes only through set_display_name, which keeps the weekly limit.
revoke update (display_name) on public.profile from authenticated;

-- 4. Feedback without an account: a shared limit.
CREATE OR REPLACE FUNCTION public.send_feedback(p_kind text, p_area text, p_body text, p_device text DEFAULT NULL::text, p_app_version text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  caller uuid := auth.uid();
  texto text := btrim(coalesce(p_body, ''));
  novo uuid;
begin
  if p_kind not in ('erro', 'ideia')
     or p_area not in ('jogos', 'boleias', 'contas', 'locais', 'mapa', 'perfil', 'grupos', 'outro') then
    raise exception 'bad_feedback' using errcode = '22023';
  end if;
  if char_length(texto) < 10 or char_length(texto) > 1000 then
    raise exception 'bad_body' using errcode = '22023';
  end if;
  -- Sem conta também se pode reportar: um erro não espera por um registo. Com conta, 10 por dia; sem conta, um
  -- limite comum a todos (não há identidade), para a caixa não poder ser inundada.
  if caller is not null and not public.take_rate_limit(caller, 'feedback', 10, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  if caller is null then
    perform pg_advisory_xact_lock(hashtextextended('feedback:anon', 0));
    if (
      select count(*) from public.feedback
      where profile_id is null and created_at > now() - interval '1 hour'
    ) >= 30 then
      raise exception 'rate_limited' using errcode = '22023';
    end if;
  end if;

  insert into public.feedback (profile_id, kind, area, body, device, app_version)
  values (caller, p_kind, p_area, texto, left(p_device, 120), left(p_app_version, 40))
  returning id into novo;

  return novo;
end;
$$;

-- 5. Rides.
CREATE OR REPLACE FUNCTION public.request_return_seat(p_ride_id uuid, p_latitude double precision, p_longitude double precision, p_accept_rules boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  caller uuid := auth.uid();
  target public.ride;
  kickoff timestamptz;
  car extensions.geography;
  here extensions.geography;
  distance integer;
  people integer;
  free integer;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_accept_rules is not true then
    raise exception 'rules_not_accepted' using errcode = '22023';
  end if;
  if p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'bad_location' using errcode = '22023';
  end if;
  if public.ride_ban_until(caller) is not null then
    raise exception 'suspended' using errcode = '22023';
  end if;

  select * into target from public.ride where id = p_ride_id for update;
  if target.id is null then
    raise exception 'ride_not_found' using errcode = 'P0002';
  end if;
  if target.visibility = 'grupo'
    and not public.can_see_private_ride(target.id, target.group_id, caller) then
    raise exception 'ride_not_found' using errcode = 'P0002';
  end if;
  if target.driver_id = caller then
    raise exception 'own_ride' using errcode = '22023';
  end if;
  if target.status <> 'open' or not target.round_trip or not target.accepts_return_requests then
    raise exception 'no_return_seats' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.ride_passenger as rp
    where rp.ride_id = p_ride_id and rp.profile_id = caller and rp.status = 'accepted'
  ) then
    raise exception 'already_going' using errcode = '22023';
  end if;

  select f.kickoff_at, v.location into kickoff, car
  from public.fixture as f
  join public.venue as v on v.id = f.venue_id
  where f.id = target.fixture_id;
  if kickoff is null then
    raise exception 'ride_not_found' using errcode = 'P0002';
  end if;
  if now() < public.ride_return_opens_at(kickoff) or now() > public.ride_return_closes_at(kickoff) then
    raise exception 'outside_window' using errcode = '22023';
  end if;

  -- Where the car is: the car park the driver chose, or the stadium when they did not choose one.
  select coalesce(ps.location, car) into car
  from public.ride as r
  left join public.parking_spot as ps on ps.id = r.parking_spot_id
  where r.id = p_ride_id;

  people := public.ride_return_people_count(p_ride_id);
  free := target.seats_offered
    - (select count(*) from public.ride_passenger as rp where rp.ride_id = p_ride_id and rp.status = 'accepted')
    - (select count(*) from public.ride_return_request as rr
       where rr.ride_id = p_ride_id and rr.status = 'accepted');
  if free <= 0 then
    raise exception 'ride_full' using errcode = '22023';
  end if;

  if not public.take_rate_limit(caller, 'ride-return-request', 10, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  here := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography;
  distance := (round(extensions.st_distance(car, here) / 100) * 100)::integer;
  -- Far enough away and it is not a seat home from this game any more.
  if distance > 20000 then
    raise exception 'too_far' using errcode = '22023';
  end if;

  insert into public.ride_return_request (
    ride_id, profile_id, status, distance_to_car_m, share_cents, rules_accepted_at
  )
  values (
    p_ride_id, caller, 'pending', distance,
    public.ride_return_share_cents(target.total_cents, people + 1), now()
  )
  on conflict (ride_id, profile_id) do update
    set status = 'pending',
        distance_to_car_m = excluded.distance_to_car_m,
        share_cents = excluded.share_cents,
        rules_accepted_at = now(),
        answered_at = null
    where public.ride_return_request.status in ('declined', 'cancelled', 'expired');
end;
$$;

/** Seats taken on a ride: on the way there, and on the way back (accepted passengers plus accepted seats home). */
create function public.ride_seats_full(p_ride_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    ida.n >= r.seats_offered
    or (r.round_trip and ida.n + volta.n >= r.seats_offered)
  from public.ride as r
  cross join lateral (
    select count(*)::integer as n from public.ride_passenger as rp
    where rp.ride_id = r.id and rp.status = 'accepted'
  ) as ida
  cross join lateral (
    select count(*)::integer as n from public.ride_return_request as rr
    where rr.ride_id = r.id and rr.status = 'accepted'
  ) as volta
  where r.id = p_ride_id;
$$;

revoke execute on function public.ride_seats_full(uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_plan_ride(p_plan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
  boleia public.ride;
begin
  select * into plano from public.fixture_plan where id = p_plan_id;
  if caller is null or plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.status = 'cancelado' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;
  if public.ride_ban_until(caller) is not null then
    raise exception 'suspended' using errcode = '22023';
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
  if public.ride_seats_full(boleia.id) then
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

CREATE OR REPLACE FUNCTION public.accept_ride_invite(p_ride_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  caller uuid := auth.uid();
  boleia public.ride;
  sessao uuid;
begin
  select * into boleia from public.ride where id = p_ride_id for update;
  if not exists (
    select 1 from public.ride_invite where ride_id = p_ride_id and profile_id = caller
  ) then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  if public.ride_ban_until(caller) is not null then
    raise exception 'suspended' using errcode = '22023';
  end if;
  if boleia.status <> 'open' or now() >= boleia.departure_at then
    raise exception 'ride_closed' using errcode = '22023';
  end if;

  if public.ride_seats_full(p_ride_id) then
    raise exception 'ride_full' using errcode = '22023';
  end if;

  insert into public.ride_passenger (ride_id, profile_id, status)
  values (p_ride_id, caller, 'accepted')
  on conflict (ride_id, profile_id) do update set status = 'accepted';

  delete from public.ride_invite where ride_id = p_ride_id and profile_id = caller;

  sessao := public.ride_session_id(p_ride_id);
  if sessao is not null then
    insert into public.trip_session_member (session_id, profile_id, added_by)
    values (sessao, caller, caller)
    on conflict (session_id, profile_id) do nothing;
    perform public.sync_ride_trip_expense(sessao);
  end if;
end;
$$;

CREATE OR REPLACE FUNCTION public.invite_friend_to_ride(p_ride_id uuid, p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  caller uuid := auth.uid();
  boleia public.ride;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select * into boleia from public.ride where id = p_ride_id;
  if boleia.id is null or boleia.driver_id <> caller or boleia.status <> 'open' then
    raise exception 'not_driver' using errcode = '42501';
  end if;
  if not public.are_friends(caller, p_profile_id) then
    raise exception 'not_friends' using errcode = '42501';
  end if;

  if now() >= boleia.departure_at then
    raise exception 'ride_closed' using errcode = '22023';
  end if;
  if public.ride_seats_full(p_ride_id) then
    raise exception 'ride_full' using errcode = '22023';
  end if;

  insert into public.ride_invite (ride_id, profile_id, invited_by)
  values (p_ride_id, p_profile_id, caller)
  on conflict (ride_id, profile_id) do nothing;
end;
$$;

-- 6. People in a group-only house: only for who can see the house.
CREATE OR REPLACE FUNCTION public.stay_place_people(p_plan_id uuid)
 RETURNS TABLE(profile_id uuid, display_name text, status text, member_since date, rides_completed integer, rides_faults integer, is_mine boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  select sp.profile_id, p.display_name, sp.status, p.created_at::date, rep.completed, rep.faults,
    sp.profile_id = auth.uid()
  from public.stay_place as sp
  join public.profile as p on p.id = sp.profile_id
  join public.stay_plan as s on s.id = sp.plan_id
  cross join lateral public.ride_reputation(array[sp.profile_id]) as rep
  where sp.plan_id = p_plan_id
    and auth.uid() is not null
    and (s.visibility <> 'grupo' or public.can_see_private_stay(s.id, s.group_id, auth.uid()))
    and (
      sp.status = 'aceite'
      or ((s.profile_id = auth.uid() or sp.profile_id = auth.uid()) and sp.status = 'pedido')
    )
  order by sp.status, sp.created_at;
$$;

-- 7. The old overload writes columns that no longer exist.
drop function public.set_stay_plan(text, text, integer, smallint, text, smallint, text);

-- 8. Nobody can tell who sent a tasco photo, a dish or a tasco.
--    New photo files go to «anonimas/», not to a folder named after the sender; who sent it is the storage object's
--    owner, which only the server reads. The sender columns are no longer readable by clients.
create or replace function public.place_photo_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    return new;
  end if;
  if new.storage_path not like 'anonimas/%' or not exists (
    select 1 from storage.objects as o
    where o.bucket_id = 'place-photos' and o.name = new.storage_path and o.owner_id = caller::text
  ) then
    raise exception 'place_photo_path_not_owned' using errcode = '42501';
  end if;
  if not public.take_rate_limit(caller, 'place_photo', 10, interval '1 day') then
    raise exception 'place_photo_rate_limited' using errcode = 'P0001';
  end if;
  new.submitted_by := caller;
  new.status := 'pending';
  return new;
end;
$$;

drop policy "people upload place photos to their own folder" on storage.objects;
drop policy "people read their own place photo files" on storage.objects;
drop policy "people delete their own place photo files" on storage.objects;

create policy "people upload place photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'place-photos' and (storage.foldername(name))[1] = 'anonimas');
create policy "people read their own place photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'place-photos' and owner_id = (select auth.uid())::text);
-- An approved photo stays: its sender can no longer pull the file from under the tasco.
create policy "people delete their own pending place photo files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'place-photos'
    and owner_id = (select auth.uid())::text
    and not exists (
      select 1 from public.place_photo as ph where ph.storage_path = name and ph.status = 'approved'
    )
  );

revoke select on public.place_photo from anon, authenticated;
grant select (id, place_id, storage_path, status, created_at) on public.place_photo to anon, authenticated;

revoke select on public.dish from anon, authenticated;
grant select (
  id, place_id, name, price_cents, prep_minutes, temperature, is_specialty, status, recommendations_count,
  created_at, updated_at, currency, source_url, checked_on
) on public.dish to anon, authenticated;

revoke select on public.place from anon, authenticated;
grant select (
  id, name, name_article, kind, venue_id, walking_minutes, distance_m, location, created_at, source, osm_id,
  opening_hours, price_level, specialty, attribution, updated_at, latitude, longitude, confirmation, quick_and_cheap,
  suitability, votes_yes, votes_no, rejection_reason, matchday_note, matchday_sources, home_fans_heavy, toilet_yes,
  toilet_no, photo_url, photo_author, photo_license, photo_source_url, suggested_at, fan_note
) on public.place to anon, authenticated;

/** How many of the caller's tasco photos were approved (the photo missions), without exposing the sender column. */
create function public.my_approved_place_photo_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.place_photo
  where submitted_by = auth.uid() and status = 'approved';
$$;

revoke execute on function public.my_approved_place_photo_count() from public, anon;
grant execute on function public.my_approved_place_photo_count() to authenticated;

-- 9. Every aggregate needs 5 different people.
CREATE OR REPLACE FUNCTION public.roll_up_home_fan_reports()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  counted integer := 0;
  game record;
begin
  for game in
    select f.id, f.venue_id
    from public.fixture as f
    where f.kickoff_at < now() - interval '6 hours'
      and f.kickoff_at > now() - interval '30 days'
      and not exists (select 1 from public.home_fan_rollup as r where r.fixture_id = f.id)
      and exists (select 1 from public.home_fan_report as hr where hr.fixture_id = f.id)
  loop
    insert into public.home_fan_cell as c (venue_id, cell_latitude, cell_longitude, fixtures, reporters, last_seen_at)
    select game.venue_id, hr.cell_latitude, hr.cell_longitude, 1, count(distinct hr.reporter_id)::integer, now()
    from public.home_fan_report as hr
    where hr.fixture_id = game.id
    group by hr.cell_latitude, hr.cell_longitude
    -- A game only counts for a cell with 5 different people: a usual street then always rests on 5 or more.
    having count(distinct hr.reporter_id) >= 5
    on conflict (venue_id, cell_latitude, cell_longitude) do update
      set fixtures = c.fixtures + 1,
          reporters = c.reporters + excluded.reporters,
          last_seen_at = now();

    insert into public.home_fan_rollup (fixture_id) values (game.id);
    counted := counted + 1;
  end loop;
  return counted;
end;
$$;

CREATE OR REPLACE FUNCTION public.home_fan_zones(p_fixture_id text)
 RETURNS TABLE(latitude double precision, longitude double precision, reporters integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  select r.cell_latitude::double precision, r.cell_longitude::double precision, count(distinct r.reporter_id)::integer
  from public.home_fan_report as r
  join public.fixture as f on f.id = r.fixture_id
  where r.fixture_id = p_fixture_id
    and now() between f.kickoff_at - interval '6 hours' and f.kickoff_at + interval '6 hours'
  group by r.cell_latitude, r.cell_longitude
  having count(distinct r.reporter_id) >= 5;
$$;

-- 10. Stamping: the real distance decides.
CREATE OR REPLACE FUNCTION public.stamp_stadium(p_fixture_id text, p_latitude double precision, p_longitude double precision)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
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
  -- The 1000 m limit is checked on the real distance; only the answer is rounded.
  if extensions.st_distance(casa, aqui) > 1000 then
    raise exception 'too_far' using errcode = '22023';
  end if;
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

-- The vote policies looked up place.suggested_by with the voter's own privileges; that column is closed now, so they
-- ask a server function instead (same rule: an open suggestion, not your own).
create function public.place_open_for_my_vote(p_place_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.place as p
    where p.id = p_place_id
      and p.confirmation = 'suggested'
      and p.suggested_by is distinct from auth.uid()
  );
$$;

revoke execute on function public.place_open_for_my_vote(text) from public, anon;
grant execute on function public.place_open_for_my_vote(text) to authenticated;

drop policy "users vote on suggestions as themselves" on public.place_vote;
drop policy "users change their own votes on suggestions" on public.place_vote;

create policy "users vote on suggestions as themselves"
  on public.place_vote for insert to authenticated
  with check ((select auth.uid()) = profile_id and public.place_open_for_my_vote(place_id));
create policy "users change their own votes on suggestions"
  on public.place_vote for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id and public.place_open_for_my_vote(place_id));
