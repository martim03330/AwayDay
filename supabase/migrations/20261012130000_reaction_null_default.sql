-- Taking a reaction away is calling without an emoji: `p_emoji` gets a null default, so the generated types let the
-- app leave it out (they had it as a required string). Same bodies as in 20261012120000.

drop function public.react_group_message(uuid, text);
drop function public.react_ride_message(uuid, text);

create function public.react_group_message(p_message_id uuid, p_emoji text default null)
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

create function public.react_ride_message(p_message_id uuid, p_emoji text default null)
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

revoke execute on function public.react_group_message(uuid, text) from public, anon;
revoke execute on function public.react_ride_message(uuid, text) from public, anon;
grant execute on function public.react_group_message(uuid, text) to authenticated;
grant execute on function public.react_ride_message(uuid, text) to authenticated;
