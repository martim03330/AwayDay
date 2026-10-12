-- Chat like the fans already know it from WhatsApp (testers' feedback, 2026-10-12):
-- 1. Reply to a message: `reply_to_id`, and the reading functions bring the quoted name and text.
-- 2. Edit your own text message for 15 minutes after sending it; it shows as «editada».
-- 3. React with one emoji per person per message (same emoji again removes it, from the app).
-- 4. The car chat gets Realtime like the group chat (it only refreshed every 15 seconds).
-- 5. A public profile card, opened from a chat: only what the profile cards already show, plus the club and stamps.
--
-- Everything stays behind security definer functions: the tables are closed to anon and authenticated (RLS on, no
-- policies, as for the messages themselves). Old app builds keep working: the new parameters have defaults and the
-- reading functions only add columns.

-- ---------------------------------------------------------------------------------------------------------------------
-- Columns

alter table public.group_message
  add column reply_to_id uuid references public.group_message (id) on delete set null,
  add column edited_at timestamptz;
alter table public.ride_message
  add column reply_to_id uuid references public.ride_message (id) on delete set null,
  add column edited_at timestamptz;

-- Deleting a message sets the replies' reference to null: index it so that delete does not scan the whole table.
create index group_message_reply_to_idx on public.group_message (reply_to_id) where reply_to_id is not null;
create index ride_message_reply_to_idx on public.ride_message (reply_to_id) where reply_to_id is not null;

/** The reactions the app offers. Anything else is refused. */
create function public.chat_reaction_allowed(p_emoji text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_emoji in ('👍', '❤️', '😂', '😮', '😢', '⚽');
$$;

create table public.group_message_reaction (
  message_id uuid not null references public.group_message (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  emoji text not null check (public.chat_reaction_allowed(emoji)),
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);
create index group_message_reaction_profile_idx on public.group_message_reaction (profile_id);

create table public.ride_message_reaction (
  message_id uuid not null references public.ride_message (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  emoji text not null check (public.chat_reaction_allowed(emoji)),
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);
create index ride_message_reaction_profile_idx on public.ride_message_reaction (profile_id);

alter table public.group_message_reaction enable row level security;
alter table public.ride_message_reaction enable row level security;
-- No policies: only the functions below read and write them.
revoke all on public.group_message_reaction from anon, authenticated;
revoke all on public.ride_message_reaction from anon, authenticated;

/** How long after sending a message its author can still edit it. */
create function public.chat_edit_window()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '15 minutes';
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Group chat

drop function public.send_group_message(uuid, text);

create function public.send_group_message(p_group_id uuid, p_body text, p_reply_to uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  texto text := btrim(coalesce(p_body, ''));
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
  -- A reply only to a message of the same group.
  if p_reply_to is not null and not exists (
    select 1 from public.group_message as m where m.id = p_reply_to and m.group_id = p_group_id
  ) then
    raise exception 'bad_message' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'group-message', 300, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.group_message (group_id, profile_id, body, reply_to_id)
  values (p_group_id, caller, texto, p_reply_to)
  returning id into nova;

  update public.fan_group set updated_at = now() where id = p_group_id;
  return nova;
end;
$$;

/** Edit your own text message, within the edit window. Hidden messages stay as they are. */
create function public.edit_group_message(p_message_id uuid, p_body text)
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

/** Your reaction to a message: an emoji, or null to take it away. */
create function public.react_group_message(p_message_id uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  grupo uuid;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select m.group_id into grupo
  from public.group_message as m
  where m.id = p_message_id and public.group_message_visible(m, auth.uid());
  if grupo is null or not public.is_group_member(grupo, auth.uid()) then
    raise exception 'not_member' using errcode = '42501';
  end if;

  if p_emoji is null then
    delete from public.group_message_reaction
    where message_id = p_message_id and profile_id = auth.uid();
    return;
  end if;
  if not public.chat_reaction_allowed(p_emoji) then
    raise exception 'bad_message' using errcode = '22023';
  end if;
  if not public.take_rate_limit(auth.uid(), 'chat-reaction', 600, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  insert into public.group_message_reaction (message_id, profile_id, emoji)
  values (p_message_id, auth.uid(), p_emoji)
  on conflict (message_id, profile_id) do update set emoji = excluded.emoji, created_at = now();
end;
$$;

drop function public.group_messages(uuid, timestamptz, integer);

/**
 * The messages, newest first, with what the app needs to draw them: the quoted message of a reply (null text when it
 * is gone, hidden or from someone the reader blocked), whether it was edited, and the reactions as
 * `[{ emoji, count, mine }]`, most used first.
 */
create function public.group_messages(
  p_group_id uuid,
  p_before timestamptz default null,
  p_limit integer default 60
)
returns table (
  id uuid,
  profile_id uuid,
  display_name text,
  kind text,
  body text,
  place_id text,
  plan_id uuid,
  mine boolean,
  can_remove boolean,
  created_at timestamptz,
  edited_at timestamptz,
  reply_to_id uuid,
  reply_display_name text,
  reply_body text,
  reactions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    m.profile_id,
    p.display_name,
    m.kind,
    m.body,
    m.place_id,
    m.plan_id,
    m.profile_id = auth.uid(),
    m.profile_id = auth.uid() or exists (
      select 1 from public.fan_group_member as dono
      where dono.group_id = m.group_id and dono.profile_id = auth.uid() and dono.role = 'owner'
    ),
    m.created_at,
    m.edited_at,
    m.reply_to_id,
    quem.display_name,
    case when citada.id is not null and public.group_message_visible(citada, auth.uid())
      then left(citada.body, 160)
    end,
    coalesce((
      select jsonb_agg(
        jsonb_build_object('emoji', r.emoji, 'count', r.total, 'mine', r.mine)
        order by r.total desc, r.emoji
      )
      from (
        select x.emoji, count(*)::integer as total, bool_or(x.profile_id = auth.uid()) as mine
        from public.group_message_reaction as x
        where x.message_id = m.id and not public.has_blocked(auth.uid(), x.profile_id)
        group by x.emoji
      ) as r
    ), '[]'::jsonb)
  from public.group_message as m
  join public.profile as p on p.id = m.profile_id
  left join public.group_message as citada on citada.id = m.reply_to_id
  left join public.profile as quem on quem.id = citada.profile_id
  where m.group_id = p_group_id
    and public.is_group_member(p_group_id, auth.uid())
    and public.group_message_visible(m, auth.uid())
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc, m.id desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;

-- An edited message reaches open chats like a new one.
create trigger group_message_edited_broadcast
  after update of body on public.group_message
  for each row
  when (new.body is distinct from old.body)
  execute function public.broadcast_group_message();

/** A reaction changed: tell whoever has the group chat open. Never stops the reaction. */
create function public.broadcast_group_message_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mensagem uuid := coalesce(new.message_id, old.message_id);
  grupo uuid;
begin
  select m.group_id into grupo from public.group_message as m where m.id = mensagem;
  if grupo is null then
    return null;
  end if;
  begin
    perform realtime.send(jsonb_build_object('id', mensagem), 'messages', 'group:' || grupo::text, true);
  exception when others then
    null;
  end;
  return null;
end;
$$;

create trigger group_message_reaction_broadcast
  after insert or update or delete on public.group_message_reaction
  for each row execute function public.broadcast_group_message_reaction();

-- ---------------------------------------------------------------------------------------------------------------------
-- Car chat

drop function public.send_ride_message(uuid, text);

create function public.send_ride_message(p_ride_id uuid, p_body text, p_reply_to uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  texto text := btrim(coalesce(p_body, ''));
  fecha timestamptz;
  nova uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.in_ride(p_ride_id, caller) then
    raise exception 'not_in_ride' using errcode = '42501';
  end if;
  if char_length(texto) < 1 or char_length(texto) > 500 then
    raise exception 'bad_message' using errcode = '22023';
  end if;
  if p_reply_to is not null and not exists (
    select 1 from public.ride_message as m where m.id = p_reply_to and m.ride_id = p_ride_id
  ) then
    raise exception 'bad_message' using errcode = '22023';
  end if;

  select public.ride_chat_closes_at(f.kickoff_at) into fecha
  from public.ride as r
  join public.fixture as f on f.id = r.fixture_id
  where r.id = p_ride_id;
  if fecha is null or now() > fecha then
    raise exception 'chat_closed' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'ride-message', 120, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.ride_message (ride_id, profile_id, body, reply_to_id)
  values (p_ride_id, caller, texto, p_reply_to)
  returning id into nova;

  return nova;
end;
$$;

create function public.edit_ride_message(p_message_id uuid, p_body text)
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

create function public.react_ride_message(p_message_id uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  boleia uuid;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select m.ride_id into boleia
  from public.ride_message as m
  where m.id = p_message_id
    and m.hidden_at is null
    and not public.has_blocked(auth.uid(), m.profile_id);
  if boleia is null or not public.in_ride(boleia, auth.uid()) then
    raise exception 'not_in_ride' using errcode = '42501';
  end if;

  if p_emoji is null then
    delete from public.ride_message_reaction
    where message_id = p_message_id and profile_id = auth.uid();
    return;
  end if;
  if not public.chat_reaction_allowed(p_emoji) then
    raise exception 'bad_message' using errcode = '22023';
  end if;
  if not public.take_rate_limit(auth.uid(), 'chat-reaction', 600, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  insert into public.ride_message_reaction (message_id, profile_id, emoji)
  values (p_message_id, auth.uid(), p_emoji)
  on conflict (message_id, profile_id) do update set emoji = excluded.emoji, created_at = now();
end;
$$;

drop function public.ride_messages(uuid, integer);

create function public.ride_messages(p_ride_id uuid, p_limit integer default 100)
returns table (
  id uuid,
  profile_id uuid,
  display_name text,
  body text,
  mine boolean,
  can_remove boolean,
  created_at timestamptz,
  edited_at timestamptz,
  reply_to_id uuid,
  reply_display_name text,
  reply_body text,
  reactions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    m.profile_id,
    p.display_name,
    m.body,
    m.profile_id = auth.uid(),
    m.profile_id = auth.uid() or r.driver_id = auth.uid(),
    m.created_at,
    m.edited_at,
    m.reply_to_id,
    quem.display_name,
    case when citada.id is not null
      and citada.hidden_at is null
      and not public.has_blocked(auth.uid(), citada.profile_id)
      then left(citada.body, 160)
    end,
    coalesce((
      select jsonb_agg(
        jsonb_build_object('emoji', x.emoji, 'count', x.total, 'mine', x.mine)
        order by x.total desc, x.emoji
      )
      from (
        select y.emoji, count(*)::integer as total, bool_or(y.profile_id = auth.uid()) as mine
        from public.ride_message_reaction as y
        where y.message_id = m.id and not public.has_blocked(auth.uid(), y.profile_id)
        group by y.emoji
      ) as x
    ), '[]'::jsonb)
  from public.ride_message as m
  join public.ride as r on r.id = m.ride_id
  join public.profile as p on p.id = m.profile_id
  left join public.ride_message as citada on citada.id = m.reply_to_id
  left join public.profile as quem on quem.id = citada.profile_id
  where m.ride_id = p_ride_id
    and public.in_ride(p_ride_id, auth.uid())
    and m.hidden_at is null
    and not public.has_blocked(auth.uid(), m.profile_id)
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

-- Realtime for the car: a private channel `ride:<id>` for whoever is in the car (driver and accepted passengers).
create function public.can_use_ride_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_topic ~ '^ride:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.in_ride(substr(p_topic, 6)::uuid, auth.uid())
    else false
  end;
$$;

create policy "car members listen to their car"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and public.can_use_ride_topic((select realtime.topic()))
  );

/** A car message was sent, edited, hidden, deleted or reacted to: tell whoever has the car chat open. */
create function public.broadcast_ride_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mensagem uuid;
  boleia uuid;
begin
  if tg_table_name = 'ride_message_reaction' then
    mensagem := coalesce(new.message_id, old.message_id);
    select m.ride_id into boleia from public.ride_message as m where m.id = mensagem;
  else
    mensagem := coalesce(new.id, old.id);
    boleia := coalesce(new.ride_id, old.ride_id);
  end if;
  if boleia is null then
    return null;
  end if;
  begin
    perform realtime.send(jsonb_build_object('id', mensagem), 'messages', 'ride:' || boleia::text, true);
  exception when others then
    null;
  end;
  return null;
end;
$$;

create trigger ride_message_broadcast
  after insert or delete on public.ride_message
  for each row execute function public.broadcast_ride_message();
create trigger ride_message_changed_broadcast
  after update of body, hidden_at on public.ride_message
  for each row execute function public.broadcast_ride_message();
create trigger ride_message_reaction_broadcast
  after insert or update or delete on public.ride_message_reaction
  for each row execute function public.broadcast_ride_message();

-- ---------------------------------------------------------------------------------------------------------------------
-- Public profile, opened from a chat

/**
 * Someone's card as seen from a chat: the same people who may see their profile card (`can_see_profile_card`), and
 * only public things — name, photo, city, since when, rides, the club they support and how many stadiums they have
 * stamped. Never a location.
 */
create function public.public_profile(p_profile_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  avatar_path text,
  home_city text,
  member_since date,
  rides_completed integer,
  rides_faults integer,
  supporter_club_id text,
  stadiums_stamped integer,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    p.avatar_path,
    p.home_city,
    p.created_at::date,
    rep.completed,
    rep.faults,
    (select pc.club_id from public.profile_club as pc where pc.profile_id = p.id and pc.relation = 'supporter'),
    (select count(distinct v.venue_id)::integer from public.stadium_visit as v where v.profile_id = p.id),
    p.id = auth.uid()
  from public.profile as p
  cross join lateral public.ride_reputation(array[p.id]) as rep
  where p.id = p_profile_id
    and auth.uid() is not null
    and public.can_see_profile_card(auth.uid(), p.id);
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Grants

revoke execute on function public.chat_reaction_allowed(text) from public, anon;
revoke execute on function public.chat_edit_window() from public, anon;
revoke execute on function public.send_group_message(uuid, text, uuid) from public, anon;
revoke execute on function public.edit_group_message(uuid, text) from public, anon;
revoke execute on function public.react_group_message(uuid, text) from public, anon;
revoke execute on function public.group_messages(uuid, timestamptz, integer) from public, anon;
revoke execute on function public.broadcast_group_message_reaction() from public, anon, authenticated;
revoke execute on function public.send_ride_message(uuid, text, uuid) from public, anon;
revoke execute on function public.edit_ride_message(uuid, text) from public, anon;
revoke execute on function public.react_ride_message(uuid, text) from public, anon;
revoke execute on function public.ride_messages(uuid, integer) from public, anon;
revoke execute on function public.can_use_ride_topic(text) from public, anon;
revoke execute on function public.broadcast_ride_message() from public, anon, authenticated;
revoke execute on function public.public_profile(uuid) from public, anon;

grant execute on function public.chat_reaction_allowed(text) to authenticated;
grant execute on function public.chat_edit_window() to authenticated;
grant execute on function public.send_group_message(uuid, text, uuid) to authenticated;
grant execute on function public.edit_group_message(uuid, text) to authenticated;
grant execute on function public.react_group_message(uuid, text) to authenticated;
grant execute on function public.group_messages(uuid, timestamptz, integer) to authenticated;
grant execute on function public.send_ride_message(uuid, text, uuid) to authenticated;
grant execute on function public.edit_ride_message(uuid, text) to authenticated;
grant execute on function public.react_ride_message(uuid, text) to authenticated;
grant execute on function public.ride_messages(uuid, integer) to authenticated;
grant execute on function public.can_use_ride_topic(text) to authenticated;
grant execute on function public.public_profile(uuid) to authenticated;
