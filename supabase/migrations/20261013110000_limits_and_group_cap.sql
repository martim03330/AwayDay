-- Limits so that one person or one group cannot weigh on everyone else (review of 2026-10-13).
--
-- 1. Groups have at most 100 members, whatever the way in (code, invite, a ride's group): every message pushes to
--    every member, so an endless group was a load on everyone.
-- 2. Group chat: 2 000 messages a day (300 was too few for a busy group on match day), and at most 30 a minute.
-- 3. Editing chat messages: 60 an hour (each edit is a broadcast to the whole chat).
-- 4. Inviting friends to a group or a car: 30 invites a day, and at most 3 a day from the same person to the same
--    person (inviting, being declined and inviting again was an endless stream of pushes).
-- 5. File uploads (photos of profile, groups, trips, missions and tascos): 150 a day per person. Before, only the
--    database rows were limited, so a script could fill the project's storage with files.
-- 6. Mentions: at most 5 an hour from the same person to the same person go through as «mencionou-te» (mentions
--    reach even people who muted the chat). Used by social-notify.
-- 7. The rate-limit tables are swept every night (rows older than 35 days; the longest window is 30 days).

-- 1. At most 100 members per group.
create function public.group_member_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- One at a time per group, so two joins at once cannot both take the last place.
  perform pg_advisory_xact_lock(hashtextextended('group-members:' || new.group_id::text, 0));
  if (select count(*) from public.fan_group_member where group_id = new.group_id) >= 100 then
    raise exception 'group_full' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function public.group_member_cap() from public, anon, authenticated;

create trigger fan_group_member_cap
  before insert on public.fan_group_member
  for each row execute function public.group_member_cap();

-- 2. Group chat limits.
create or replace function public.send_group_message(
  p_group_id uuid,
  p_body text,
  p_reply_to uuid default null,
  p_mentions uuid[] default null,
  p_mention_all boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  texto text := btrim(coalesce(p_body, ''));
  mencionados uuid[];
  nova uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.is_group_member(p_group_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if char_length(texto) < 1 or char_length(texto) > 500 then
    raise exception 'bad_message' using errcode = '22023';
  end if;
  if p_reply_to is not null and not exists (
    select 1 from public.group_message as m where m.id = p_reply_to and m.group_id = p_group_id
  ) then
    raise exception 'bad_message' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'group-message-minute', 30, interval '1 minute')
    or not public.take_rate_limit(caller, 'group-message', 2000, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  if coalesce(p_mention_all, false)
    and not public.take_rate_limit(caller, 'chat-mention-all', 10, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  -- Only people in this group, never yourself, at most 50.
  select coalesce(array_agg(distinct pessoa), '{}')
  into mencionados
  from unnest(coalesce(p_mentions, '{}')) with ordinality as pedido(pessoa, n)
  where n <= 50 and pessoa <> caller and public.is_group_member(p_group_id, pessoa);

  insert into public.group_message (group_id, profile_id, body, reply_to_id, mentions, mentions_all)
  values (p_group_id, caller, texto, p_reply_to, mencionados, coalesce(p_mention_all, false))
  returning id into nova;

  update public.fan_group set updated_at = now() where id = p_group_id;
  return nova;
end;
$$;

-- 3. Edits.
create or replace function public.edit_group_message(p_message_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  texto text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if char_length(texto) < 1 or char_length(texto) > 500 then
    raise exception 'bad_message' using errcode = '22023';
  end if;
  if not public.take_rate_limit(auth.uid(), 'chat-edit', 60, interval '1 hour') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  update public.group_message as m
  set body = texto, edited_at = now()
  where m.id = p_message_id
    and m.profile_id = auth.uid()
    and m.kind = 'texto'
    and m.hidden_at is null
    and m.created_at > now() - public.chat_edit_window()
    and public.is_group_member(m.group_id, auth.uid());
  if not found then
    raise exception 'not_yours' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.edit_ride_message(p_message_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  texto text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if char_length(texto) < 1 or char_length(texto) > 500 then
    raise exception 'bad_message' using errcode = '22023';
  end if;
  if not public.take_rate_limit(auth.uid(), 'chat-edit', 60, interval '1 hour') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  update public.ride_message as m
  set body = texto, edited_at = now()
  where m.id = p_message_id
    and m.profile_id = auth.uid()
    and m.hidden_at is null
    and m.created_at > now() - public.chat_edit_window()
    and public.in_ride(m.ride_id, auth.uid());
  if not found then
    raise exception 'not_yours' using errcode = '42501';
  end if;
end;
$$;

-- 4. Invites.
create or replace function public.invite_friend_to_group(p_group_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.is_group_member(p_group_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if not public.are_friends(caller, p_profile_id) then
    raise exception 'not_friends' using errcode = '42501';
  end if;
  if public.is_group_member(p_group_id, p_profile_id) then
    raise exception 'already_member' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'friend-invite', 30, interval '1 day')
    or not public.take_rate_limit(p_profile_id, 'invited-by:' || caller::text, 3, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.group_invite (group_id, profile_id, invited_by)
  values (p_group_id, p_profile_id, caller)
  on conflict (group_id, profile_id) do nothing;
end;
$$;

create or replace function public.invite_friend_to_ride(p_ride_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
  if not public.take_rate_limit(caller, 'friend-invite', 30, interval '1 day')
    or not public.take_rate_limit(p_profile_id, 'invited-by:' || caller::text, 3, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.ride_invite (ride_id, profile_id, invited_by)
  values (p_ride_id, p_profile_id, caller)
  on conflict (ride_id, profile_id) do nothing;
end;
$$;

-- 5. Uploads: each new file takes a place in a daily allowance (checked by the upload policies below).
create function public.take_upload_slot()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return auth.uid() is not null and public.take_rate_limit(auth.uid(), 'upload', 150, interval '1 day');
end;
$$;

revoke execute on function public.take_upload_slot() from public, anon;
grant execute on function public.take_upload_slot() to authenticated;

drop policy "group members upload group photos" on storage.objects;
create policy "group members upload group photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'group-photos'
    and public.caller_in_group_folder((storage.foldername(name))[1])
    and public.take_upload_slot()
  );

drop policy "people upload place photos" on storage.objects;
create policy "people upload place photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'place-photos'
    and (storage.foldername(name))[1] = 'anonimas'
    and public.take_upload_slot()
  );

drop policy "people upload their own avatar" on storage.objects;
create policy "people upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.take_upload_slot()
  );

drop policy "users upload mission photo files to their own folder" on storage.objects;
create policy "users upload mission photo files to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'mission-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.take_upload_slot()
  );

drop policy "who went adds trip photos" on storage.objects;
create policy "who went adds trip photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trip-photos'
    and public.caller_is_trip_member(public.trip_folder_session((storage.foldername(name))[1]))
    and public.take_upload_slot()
  );

-- 6. Mentions that go through as «mencionou-te»: at most 5 an hour from one person to the same person.
create function public.mention_slots(p_sender uuid, p_recipients uuid[])
returns uuid[]
language sql
security definer
set search_path = ''
as $$
  select coalesce(array_agg(pessoa), '{}')
  from unnest(coalesce(p_recipients, '{}')) as pessoa
  where public.take_rate_limit(pessoa, 'mention-from:' || p_sender::text, 5, interval '1 hour');
$$;

revoke execute on function public.mention_slots(uuid, uuid[]) from public, anon, authenticated;

-- 7. Nightly sweep of the rate-limit tables.
select cron.schedule(
  'delete-old-rate-limit-hits',
  '53 3 * * *',
  $$
    delete from public.rate_limit_hit where created_at < now() - interval '35 days';
    delete from public.anon_rate_limit_hit where created_at < now() - interval '35 days';
  $$
);
