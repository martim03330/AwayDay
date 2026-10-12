-- Mentions in the group and car chats (testers' feedback, 2026-10-12): «@Nome» and «@todos».
--
-- The app sends who was mentioned; the server keeps only people who are really in that chat (never the author) and
-- notifies them with their own push, «X mencionou-te», even if they turned that chat's notifications off — like
-- WhatsApp. «@todos» does the same for everyone in the chat, so it is limited to 10 a day per person.
-- Old app builds keep working: the new parameters have defaults and the reading functions only add a column.

alter table public.group_message
  add column mentions uuid[] not null default '{}',
  add column mentions_all boolean not null default false;
alter table public.ride_message
  add column mentions uuid[] not null default '{}',
  add column mentions_all boolean not null default false;

-- ---------------------------------------------------------------------------------------------------------------------
-- Sending

drop function public.send_group_message(uuid, text, uuid);

create function public.send_group_message(
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
  if not public.take_rate_limit(caller, 'group-message', 300, interval '1 day') then
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

drop function public.send_ride_message(uuid, text, uuid);

create function public.send_ride_message(
  p_ride_id uuid,
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
  fecha timestamptz;
  mencionados uuid[];
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
  if coalesce(p_mention_all, false)
    and not public.take_rate_limit(caller, 'chat-mention-all', 10, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct pessoa), '{}')
  into mencionados
  from unnest(coalesce(p_mentions, '{}')) with ordinality as pedido(pessoa, n)
  where n <= 50 and pessoa <> caller and public.in_ride(p_ride_id, pessoa);

  insert into public.ride_message (ride_id, profile_id, body, reply_to_id, mentions, mentions_all)
  values (p_ride_id, caller, texto, p_reply_to, mencionados, coalesce(p_mention_all, false))
  returning id into nova;

  return nova;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Reading: whether a message mentions the reader (directly or with «@todos»)

drop function public.group_messages(uuid, timestamptz, integer);

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
  reactions jsonb,
  mentions_me boolean
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
    ), '[]'::jsonb),
    m.mentions_all or auth.uid() = any(m.mentions)
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
  reactions jsonb,
  mentions_me boolean
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
    ), '[]'::jsonb),
    m.mentions_all or auth.uid() = any(m.mentions)
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

-- ---------------------------------------------------------------------------------------------------------------------
-- Notifications: social-notify gets who was mentioned

create or replace function public.notify_group_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_social(jsonb_build_object(
    'kind', 'group_message',
    'group_id', new.group_id,
    'profile_id', new.profile_id,
    'message_kind', new.kind,
    'body', new.body,
    'plan_id', new.plan_id,
    'mentions', to_jsonb(new.mentions),
    'mentions_all', new.mentions_all
  ));
  return null;
end;
$$;

create or replace function public.notify_ride_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_social(jsonb_build_object(
    'kind', 'ride_message',
    'ride_id', new.ride_id,
    'profile_id', new.profile_id,
    'body', new.body,
    'mentions', to_jsonb(new.mentions),
    'mentions_all', new.mentions_all
  ));
  return null;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Grants

revoke execute on function public.send_group_message(uuid, text, uuid, uuid[], boolean) from public, anon;
revoke execute on function public.send_ride_message(uuid, text, uuid, uuid[], boolean) from public, anon;
revoke execute on function public.group_messages(uuid, timestamptz, integer) from public, anon;
revoke execute on function public.ride_messages(uuid, integer) from public, anon;
revoke execute on function public.notify_group_message() from public, anon, authenticated;
revoke execute on function public.notify_ride_message() from public, anon, authenticated;

grant execute on function public.send_group_message(uuid, text, uuid, uuid[], boolean) to authenticated;
grant execute on function public.send_ride_message(uuid, text, uuid, uuid[], boolean) to authenticated;
grant execute on function public.group_messages(uuid, timestamptz, integer) to authenticated;
grant execute on function public.ride_messages(uuid, integer) to authenticated;
