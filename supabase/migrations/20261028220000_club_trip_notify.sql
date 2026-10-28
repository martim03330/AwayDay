-- Viagens da Casa, part 3: the push notifications (docs/superpowers/specs/2026-10-28-viagens-da-casa-design.md).
--
-- * A trip is published  -> the Casa's followers, and the fans of its club who live in the same district as the first
--                           stop (its nearest concelho) or within 50 km of it. One alert per person per game: the
--                           first trip; the later ones show on the game page without a new alert (`club_trip_alert`).
--                           It can be turned off with the new «Autocarros das Casas» switch (`club_trips`).
-- * A trip is cancelled  -> everyone who was booked or waiting in it, in one go (also when the Casa is suspended).
-- * Waiting -> booked    -> «Tens lugar no autocarro».
-- * Waiting -> cancelled because the person got another transport for the game -> «Saíste da lista de espera».
-- * A notice of the Casa -> everyone booked or waiting in the trip.
--
-- The triggers send only the row's key and statuses to `club-trip-notify`, with the notification secret (like
-- `notify_ride_change`); the function reads every row again with the service role.
--
-- Also here (rulings from the Task 1 and Task 2 reviews):
-- * `my_club_booking` shows nothing due while waiting, and `manage_club_booking` marks paid / unpaid only `booked`
--   bookings (`not_booked`);
-- * `accept_supporters_club_invite` refuses a code of a suspended Casa (`club_suspended`);
-- * `content_report` takes reports of a Casa and of a trip: `report_content` and `pending_content_reports` learn the
--   two kinds (`resolve_content_report` needs nothing: a Casa or a trip is only closed or dismissed, and an admin
--   suspends a Casa with decide_supporters_club).

-- =====================================================================================================================
-- 1. One alert per person per game. Server only: RLS on, no policy, no grant.

create table public.club_trip_alert (
  profile_id uuid not null references public.profile (id) on delete cascade,
  fixture_id text not null references public.fixture (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (profile_id, fixture_id)
);

create index club_trip_alert_fixture_idx on public.club_trip_alert (fixture_id);

alter table public.club_trip_alert enable row level security;
revoke all on public.club_trip_alert from anon, authenticated;

-- =====================================================================================================================
-- 2. The new switch, and reports of a Casa or a trip.

alter table public.notification_preference drop constraint notification_preference_kind_check;
alter table public.notification_preference
  add constraint notification_preference_kind_check check (
    kind in (
      'kickoff_change',
      'weather',
      'group_movement',
      'new_stamp',
      'ride_message',
      'invites',
      'friends',
      'trip_money',
      'group_message',
      'rides',
      -- «Autocarros das Casas»: trips published near home.
      'club_trips'
    )
  );

alter table public.content_report drop constraint content_report_kind_check;
alter table public.content_report
  add constraint content_report_kind_check check (
    kind in ('message', 'ride_message', 'profile', 'profile_photo', 'group', 'supporters_club', 'club_trip')
  );

-- =====================================================================================================================
-- 3. Who hears about a new trip. Called only by `club-trip-notify` (service role): it records the alerts and
--    returns who to notify.

/**
 * The fans to alert about this trip, recorded in `club_trip_alert` so nobody is alerted twice for the same game:
 * the Casa's followers, and the supporters of its club whose concelho is in the district of the concelho nearest to
 * the first stop, or within 50 km of the first stop. Left out: the Casa's managers, whoever blocked the person who
 * published the trip, whoever turned `club_trips` off, and whoever was already alerted for the game. Only while the
 * trip is open and its Casa verified.
 */
create function public.claim_club_trip_alerts(p_trip_id uuid)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  viagem public.club_trip;
  casa public.supporters_club;
  primeira extensions.geography;
  distrito text;
begin
  select * into viagem from public.club_trip where id = p_trip_id;
  if viagem.id is null or viagem.status <> 'open' then
    return;
  end if;
  select * into casa from public.supporters_club where id = viagem.supporters_club_id;
  if casa.status <> 'verified' then
    return;
  end if;

  select s.location into primeira
  from public.club_trip_stop as s
  where s.trip_id = p_trip_id
  order by s.position
  limit 1;
  if primeira is null then
    return;
  end if;
  select m.district into distrito
  from public.municipality as m
  order by extensions.st_distance(m.location, primeira), m.id
  limit 1;

  return query
  with candidatos as (
    select f.profile_id
    from public.supporters_club_follower as f
    where f.club_id = casa.id
    union
    select pc.profile_id
    from public.profile_club as pc
    join public.profile_home as ph on ph.profile_id = pc.profile_id
    join public.municipality as m on m.id = ph.municipality_id
    where pc.relation = 'supporter'
      and pc.club_id = casa.club_id
      and (m.district = distrito or extensions.st_dwithin(m.location, primeira, 50000))
  )
  insert into public.club_trip_alert (profile_id, fixture_id)
  select c.profile_id, viagem.fixture_id
  from candidatos as c
  where not exists (
      select 1 from public.supporters_club_manager as g
      where g.club_id = casa.id and g.profile_id = c.profile_id
    )
    and (viagem.created_by is null or not exists (
      select 1 from public.user_block as b
      where b.blocker_id = c.profile_id and b.blocked_id = viagem.created_by
    ))
    and not exists (
      select 1 from public.notification_preference as np
      where np.profile_id = c.profile_id and np.kind = 'club_trips' and not np.enabled
    )
  on conflict (profile_id, fixture_id) do nothing
  returning profile_id;
end;
$$;

-- =====================================================================================================================
-- 4. The triggers.

create function public.notify_club_trip_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if tg_table_name = 'club_trip' then
    payload := jsonb_build_object(
      'kind', 'trip',
      'id', new.id,
      'status', new.status,
      'old_status', case when tg_op = 'UPDATE' then old.status end
    );
  elsif tg_table_name = 'club_trip_booking' then
    payload := jsonb_build_object('kind', 'booking', 'id', new.id, 'status', new.status, 'old_status', old.status);
  else
    payload := jsonb_build_object('kind', 'notice', 'id', new.id);
  end if;

  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/club-trip-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret')
    ),
    body := payload,
    timeout_milliseconds := 10000
  );
  return null;
exception when others then
  -- A notification must never block a trip, a booking or a notice.
  return null;
end;
$$;

create trigger club_trip_notify
  after insert on public.club_trip
  for each row execute function public.notify_club_trip_change();

-- Cancelling a trip cancels its bookings too (`club_trip_cancel`): the trip's own notice tells them all at once.
create trigger club_trip_cancelled_notify
  after update of status on public.club_trip
  for each row
  when (new.status = 'cancelled' and old.status <> 'cancelled')
  execute function public.notify_club_trip_change();

-- Only the changes someone is told about: off the waiting list into a seat, or out of it for another transport.
create trigger club_trip_booking_notify
  after update of status on public.club_trip_booking
  for each row
  when (
    new.profile_id is not null
    and old.status = 'waiting'
    and (new.status = 'booked' or new.cancel_reason = 'other_transport')
  )
  execute function public.notify_club_trip_change();

create trigger club_trip_notice_notify
  after insert on public.club_trip_notice
  for each row execute function public.notify_club_trip_change();

-- =====================================================================================================================
-- 5. Rulings from the reviews.

-- Nothing is due while waiting (no seat yet), nor once cancelled or paid.
create or replace function public.my_club_booking(p_trip_id uuid)
returns table (
  booking_id uuid,
  status text,
  stop_name text,
  passes_at timestamptz,
  vehicle_label text,
  people integer,
  due_cents integer,
  paid boolean,
  position_in_waiting integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  return query
  select
    b.id,
    b.status,
    st.name,
    st.passes_at,
    case when b.status = 'booked' then v.label end,
    b.people,
    case when b.status <> 'booked' or b.paid_at is not null then 0 else t.price_cents * b.people end,
    b.paid_at is not null,
    case when b.status = 'waiting' then (
      select count(*)::integer from public.club_trip_booking as w
      where w.trip_id = b.trip_id and w.status = 'waiting' and (w.created_at, w.id) <= (b.created_at, b.id)
    ) end
  from public.club_trip_booking as b
  join public.club_trip as t on t.id = b.trip_id
  join public.club_trip_stop as st on st.id = b.stop_id
  left join public.club_trip_vehicle as v on v.id = b.vehicle_id
  where b.trip_id = p_trip_id and b.profile_id = caller
  order by (b.status <> 'cancelled') desc, b.created_at desc
  limit 1;
end;
$$;

-- Paid / unpaid, like boarded, only for someone with a seat.
create or replace function public.manage_club_booking(p_booking_id uuid, p_action text, p_vehicle_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reserva public.club_trip_booking;
  viagem public.club_trip;
  livres integer;
begin
  viagem := public.club_trip_for_manager((select trip_id from public.club_trip_booking where id = p_booking_id));
  select * into reserva from public.club_trip_booking where id = p_booking_id;
  if reserva.status = 'cancelled' then
    raise exception 'booking_cancelled' using errcode = '22023';
  end if;

  if p_action = 'move' then
    if viagem.status = 'cancelled' then
      raise exception 'trip_cancelled' using errcode = '22023';
    end if;
    if p_vehicle_id is null
       or not exists (select 1 from public.club_trip_vehicle where id = p_vehicle_id and trip_id = viagem.id) then
      raise exception 'bad_vehicle' using errcode = '22023';
    end if;
    if reserva.status = 'booked' and reserva.vehicle_id = p_vehicle_id then
      return;
    end if;
    select v.seats - coalesce((
      select sum(b.people) from public.club_trip_booking as b
      where b.vehicle_id = v.id and b.status = 'booked'
    ), 0) into livres
    from public.club_trip_vehicle as v where v.id = p_vehicle_id;
    if livres < reserva.people then
      raise exception 'vehicle_full' using errcode = '22023';
    end if;
    update public.club_trip_booking set status = 'booked', vehicle_id = p_vehicle_id where id = p_booking_id;
    if reserva.status = 'booked' then
      perform public.promote_club_trip_waiting(viagem.id);
    end if;
  elsif p_action in ('paid', 'unpaid') then
    if reserva.status <> 'booked' then
      raise exception 'not_booked' using errcode = '22023';
    end if;
    update public.club_trip_booking
    set paid_at = case when p_action = 'paid' then coalesce(paid_at, now()) end
    where id = p_booking_id;
  elsif p_action in ('boarded', 'not_boarded') then
    if reserva.status <> 'booked' then
      raise exception 'not_booked' using errcode = '22023';
    end if;
    update public.club_trip_booking
    set boarded_at = case when p_action = 'boarded' then coalesce(boarded_at, now()) end
    where id = p_booking_id;
  elsif p_action = 'remove' then
    update public.club_trip_booking set status = 'cancelled', cancel_reason = 'manager' where id = p_booking_id;
    perform public.promote_club_trip_waiting(viagem.id);
  else
    raise exception 'bad_action' using errcode = '22023';
  end if;
end;
$$;

-- A suspended Casa is frozen: its manager codes stop working too.
create or replace function public.accept_supporters_club_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  convite public.supporters_club_invite;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.take_rate_limit(caller, 'supporters-club-invite-accept', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  select * into convite
  from public.supporters_club_invite
  where code = lower(btrim(coalesce(p_code, '')))
  for update;
  if convite.code is null then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
  if convite.used_by is not null or convite.used_at is not null then
    raise exception 'invite_used' using errcode = '22023';
  end if;
  if convite.expires_at <= now() then
    raise exception 'invite_expired' using errcode = '22023';
  end if;
  if (select status from public.supporters_club where id = convite.club_id) = 'suspended' then
    raise exception 'club_suspended' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.supporters_club_manager
    where club_id = convite.club_id and profile_id = caller
  ) then
    return convite.club_id;
  end if;

  insert into public.supporters_club_manager (club_id, profile_id, role)
  values (convite.club_id, caller, 'manager');

  update public.supporters_club_invite
  set used_by = caller, used_at = now()
  where code = convite.code;

  return convite.club_id;
end;
$$;

-- =====================================================================================================================
-- 6. Reports of a Casa or a trip (the original definitions are in 20261006115624_report_and_block.sql).

/**
 * Report something. Only what the reporter can see, never their own, and at most 20 a day.
 * A Casa: only a verified one; it is its owner's (its managers cannot report it). A trip: only one the reporter can
 * see; it is whoever published it (the Casa's managers cannot report it).
 */
create or replace function public.report_content(
  p_kind text,
  p_target_id uuid,
  p_reason text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  nota text := nullif(btrim(coalesce(p_note, '')), '');
  autor uuid;
  grupo uuid;
  boleia uuid;
  conteudo text;
  nova uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('ofensivo', 'assedio', 'spam', 'perigoso', 'outro') then
    raise exception 'bad_reason' using errcode = '22023';
  end if;
  if nota is not null and char_length(nota) > 500 then
    raise exception 'bad_note' using errcode = '22023';
  end if;

  if p_kind = 'message' then
    select m.profile_id, m.group_id, m.body into autor, grupo, conteudo
    from public.group_message as m
    where m.id = p_target_id and m.hidden_at is null and public.is_group_member(m.group_id, caller);
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  elsif p_kind = 'ride_message' then
    select m.profile_id, m.ride_id, m.body into autor, boleia, conteudo
    from public.ride_message as m
    where m.id = p_target_id and m.hidden_at is null and public.in_ride(m.ride_id, caller);
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  elsif p_kind in ('profile', 'profile_photo') then
    if p_target_id = caller then
      raise exception 'own_content' using errcode = '22023';
    end if;
    if not public.can_see_profile(caller, p_target_id) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    autor := p_target_id;
    select case when p_kind = 'profile' then p.display_name else p.avatar_path end into conteudo
    from public.profile as p
    where p.id = p_target_id;
    if p_kind = 'profile_photo' and conteudo is null then
      raise exception 'no_photo' using errcode = 'P0002';
    end if;
  elsif p_kind = 'group' then
    if not public.is_group_member(p_target_id, caller) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    grupo := p_target_id;
    select g.name into conteudo from public.fan_group as g where g.id = p_target_id;
  elsif p_kind = 'supporters_club' then
    if public.is_supporters_club_manager(p_target_id) then
      raise exception 'own_content' using errcode = '22023';
    end if;
    select s.name into conteudo from public.supporters_club as s where s.id = p_target_id and s.status = 'verified';
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    select m.profile_id into autor
    from public.supporters_club_manager as m
    where m.club_id = p_target_id and m.role = 'owner'
    order by m.created_at, m.profile_id
    limit 1;
  elsif p_kind = 'club_trip' then
    if public.is_club_trip_manager(p_target_id) then
      raise exception 'own_content' using errcode = '22023';
    end if;
    if not public.can_see_club_trip(p_target_id) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    select t.created_by, t.name || ' (' || s.name || ')' into autor, conteudo
    from public.club_trip as t
    join public.supporters_club as s on s.id = t.supporters_club_id
    where t.id = p_target_id;
  else
    raise exception 'bad_kind' using errcode = '22023';
  end if;

  if autor = caller then
    raise exception 'own_content' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'content-report', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.content_report (
    reporter_id, kind, target_id, reported_profile_id, group_id, ride_id, reason, note, content_snapshot
  )
  values (caller, p_kind, p_target_id, autor, grupo, boleia, p_reason, nota, left(conteudo, 600))
  on conflict (reporter_id, kind, target_id) where status = 'pendente'
  do update set reason = excluded.reason, note = excluded.note, created_at = now()
  returning id into nova;

  return nova;
end;
$$;

/**
 * The open reports, one row per thing reported, newest first. For admins only. Says what was reported and where, but
 * never who reported it. A Casa shows its current name; a trip its current name, in «Viagem da Casa «…»».
 */
create or replace function public.pending_content_reports()
returns table (
  report_id uuid,
  kind text,
  target_id uuid,
  reported_profile_id uuid,
  reported_name text,
  reasons text[],
  notes text[],
  reports integer,
  content text,
  content_gone boolean,
  hidden boolean,
  context text,
  first_reported_at timestamptz,
  last_reported_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with abertas as (
    select
      r.kind,
      r.target_id,
      (array_agg(r.id order by r.created_at desc))[1] as report_id,
      array_agg(distinct r.reason) as reasons,
      array_remove(array_agg(r.note order by r.created_at desc), null) as notes,
      count(*)::integer as reports,
      (array_agg(r.content_snapshot order by r.created_at desc))[1] as snapshot,
      (array_agg(r.reported_profile_id order by r.created_at desc))[1] as reported_profile_id,
      (array_agg(r.group_id order by r.created_at desc))[1] as group_id,
      (array_agg(r.ride_id order by r.created_at desc))[1] as ride_id,
      min(r.created_at) as first_at,
      max(r.created_at) as last_at
    from public.content_report as r
    where r.status = 'pendente' and public.is_admin()
    group by r.kind, r.target_id
  )
  select
    a.report_id,
    a.kind,
    a.target_id,
    a.reported_profile_id,
    quem.display_name,
    a.reasons,
    a.notes,
    a.reports,
    case a.kind
      when 'message' then coalesce(gm.body, a.snapshot)
      when 'ride_message' then coalesce(rm.body, a.snapshot)
      when 'profile' then coalesce(quem.display_name, a.snapshot)
      when 'profile_photo' then coalesce(quem.avatar_path, a.snapshot)
      when 'supporters_club' then coalesce(casa.name, a.snapshot)
      when 'club_trip' then coalesce(viagem.name, a.snapshot)
      else coalesce(g.name, a.snapshot)
    end,
    case a.kind
      when 'message' then gm.id is null
      when 'ride_message' then rm.id is null
      when 'profile' then quem.id is null
      when 'profile_photo' then quem.avatar_path is null
      when 'supporters_club' then casa.id is null
      when 'club_trip' then viagem.id is null
      else g.id is null
    end,
    coalesce(gm.hidden_at, rm.hidden_at) is not null,
    case a.kind
      when 'message' then 'Conversa do grupo «' || coalesce(g.name, '?') || '»'
      when 'ride_message' then 'Conversa do carro de ' || coalesce(condutor.display_name, '?')
      when 'group' then 'Grupo'
      when 'supporters_club' then 'Casa'
      when 'club_trip' then 'Viagem da Casa «' || coalesce(casa_da_viagem.name, '?') || '»'
      else 'Perfil'
    end,
    a.first_at,
    a.last_at
  from abertas as a
  left join public.group_message as gm on a.kind = 'message' and gm.id = a.target_id
  left join public.ride_message as rm on a.kind = 'ride_message' and rm.id = a.target_id
  left join public.profile as quem on quem.id = a.reported_profile_id
  left join public.fan_group as g on g.id = a.group_id
  left join public.ride as rd on rd.id = a.ride_id
  left join public.profile as condutor on condutor.id = rd.driver_id
  left join public.supporters_club as casa on a.kind = 'supporters_club' and casa.id = a.target_id
  left join public.club_trip as viagem on a.kind = 'club_trip' and viagem.id = a.target_id
  left join public.supporters_club as casa_da_viagem on casa_da_viagem.id = viagem.supporters_club_id
  order by a.last_at desc;
$$;

-- =====================================================================================================================
-- 7. Grants: the new functions are server only (create or replace keeps the grants of the others).

revoke execute on function public.claim_club_trip_alerts(uuid) from public, anon, authenticated;
revoke execute on function public.notify_club_trip_change() from public, anon, authenticated;
