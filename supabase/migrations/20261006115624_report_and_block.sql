-- Report and block (App Store guideline 1.2: user-generated content).
--
-- People write to each other in group chats and car chats, and show a name and a photo. Until now only a profile photo
-- could be reported and nobody could be blocked. This adds:
--
-- 1. **Blocking.** `user_block (blocker_id, blocked_id)`. Only the blocker ever sees the row: the blocked person is
--    never told. Effects, all enforced on the server:
--    - messages from someone you blocked are left out of the group and car chats you read (and of the chat lists,
--      unread counts and push notifications). Group plan cards stay: they are the group's plan, not a personal message;
--    - blocking ends any friendship and pending friend request between the two, and drops pending direct invites
--      (group or ride) between them. While the block lasts, the blocked person can't ask you for friendship (the
--      request looks sent to them but goes nowhere) and so can't invite you directly to a group or a ride, which
--      only friends can do;
--    - group membership and rides are untouched: both can still be in the same group or car.
--    Unblocking restores the messages (nothing was deleted), but not the friendship.
--
-- 2. **Reports.** `content_report`, one queue for everything that can be reported: a group message, a car message,
--    a person (their name), a profile photo, a group. It replaces `profile_photo_report` (its rows are carried over).
--    Reports go in only through `report_content`, which checks the reporter can actually see what they report and
--    rate-limits them. Only admins read and resolve them.
--
-- 3. **Admin actions.** Dismiss a report, or hide the reported message for everyone (`hidden_at`/`hidden_by` on both
--    message tables), or take down a reported profile photo.

-- ---------------------------------------------------------------------------------------------------------------------
-- Blocking

create table public.user_block (
  blocker_id uuid not null references public.profile (id) on delete cascade,
  blocked_id uuid not null references public.profile (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_block_not_self check (blocker_id <> blocked_id)
);

create index user_block_blocked_idx on public.user_block (blocked_id);

alter table public.user_block enable row level security;
revoke all on public.user_block from anon, authenticated;
grant select, insert, delete on public.user_block to authenticated;

-- Only ever as the blocker. The blocked person has no policy that shows them the row.
create policy "people see who they blocked"
  on public.user_block for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy "people block for themselves"
  on public.user_block for insert to authenticated
  with check (blocker_id = (select auth.uid()));
create policy "people unblock for themselves"
  on public.user_block for delete to authenticated
  using (blocker_id = (select auth.uid()));

/** Did `p_blocker` block `p_blocked`? Server-side only: callable by clients it would tell people who blocked them. */
create function public.has_blocked(p_blocker uuid, p_blocked uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_blocker is not null and p_blocked is not null and exists (
    select 1 from public.user_block as b
    where b.blocker_id = p_blocker and b.blocked_id = p_blocked
  );
$$;

/** A block ends the friendship and drops pending direct invites between the two, whichever way it came in. */
create function public.apply_user_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendship
  where (requester_id = new.blocker_id and addressee_id = new.blocked_id)
     or (requester_id = new.blocked_id and addressee_id = new.blocker_id);
  delete from public.group_invite
  where (profile_id = new.blocker_id and invited_by = new.blocked_id)
     or (profile_id = new.blocked_id and invited_by = new.blocker_id);
  delete from public.ride_invite
  where (profile_id = new.blocker_id and invited_by = new.blocked_id)
     or (profile_id = new.blocked_id and invited_by = new.blocker_id);
  return null;
end;
$$;

create trigger user_block_apply
  after insert on public.user_block
  for each row execute function public.apply_user_block();

create function public.block_user(p_profile_id uuid)
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
  if p_profile_id is null or p_profile_id = caller then
    raise exception 'bad_request' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profile where id = p_profile_id) then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  insert into public.user_block (blocker_id, blocked_id)
  values (caller, p_profile_id)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$$;

create function public.unblock_user(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  delete from public.user_block where blocker_id = auth.uid() and blocked_id = p_profile_id;
end;
$$;

/** The people I blocked, most recent first. */
create function public.my_blocked_people()
returns table (profile_id uuid, display_name text, avatar_path text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.avatar_path, b.created_at
  from public.user_block as b
  join public.profile as p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

-- Friends: never while a block stands, either way. Invites to a group or a ride go only to friends, so this also
-- closes direct invites.
create or replace function public.are_friends(p_one uuid, p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_one is not null and p_other is not null
    and exists (
      select 1 from public.friendship as f
      where f.status = 'aceite'
        and ((f.requester_id = p_one and f.addressee_id = p_other)
          or (f.requester_id = p_other and f.addressee_id = p_one))
    )
    and not public.has_blocked(p_one, p_other)
    and not public.has_blocked(p_other, p_one);
$$;

-- Someone who was blocked can still "send" a request: it says 'pedido' as always, and nothing is stored. Telling
-- them they were blocked is exactly what we don't do.
create or replace function public.send_friend_request(p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  estado text;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_profile_id is null or p_profile_id = caller then
    raise exception 'bad_request' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profile where id = p_profile_id) then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  if not public.have_crossed_paths(caller, p_profile_id) then
    raise exception 'never_met' using errcode = '42501';
  end if;
  if public.has_blocked(caller, p_profile_id) then
    raise exception 'blocked' using errcode = '42501';
  end if;
  if public.has_blocked(p_profile_id, caller) then
    return 'pedido';
  end if;

  -- There was already a request from that person to me: accept it, instead of making one the other way round.
  update public.friendship
  set status = 'aceite', responded_at = now()
  where requester_id = p_profile_id and addressee_id = caller and status = 'pendente';
  if found then
    return 'amigos';
  end if;

  select f.status into estado
  from public.friendship as f
  where (f.requester_id = caller and f.addressee_id = p_profile_id)
     or (f.requester_id = p_profile_id and f.addressee_id = caller);
  if estado is not null then
    return case when estado = 'aceite' then 'amigos' else 'pedido' end;
  end if;

  if not public.take_rate_limit(caller, 'friend-request', 30, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.friendship (requester_id, addressee_id) values (caller, p_profile_id);
  return 'pedido';
end;
$$;

-- Someone I blocked has nothing to offer me: 'nada', the same as for someone I never met. The other way round
-- nothing changes on screen (the request just goes nowhere), so the blocked person can't tell.
create or replace function public.friendship_states(p_profile_ids uuid[])
returns table (profile_id uuid, state text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pessoa.id,
    case
      when public.has_blocked(auth.uid(), pessoa.id) then 'nada'
      when f.status = 'aceite' then 'amigos'
      when f.status = 'pendente' and f.requester_id = auth.uid() then 'pedido_enviado'
      when f.status = 'pendente' then 'pedido_recebido'
      when public.have_crossed_paths(auth.uid(), pessoa.id) then 'pode_pedir'
      else 'nada'
    end
  from unnest(p_profile_ids) as pessoa(id)
  left join public.friendship as f
    on (f.requester_id = auth.uid() and f.addressee_id = pessoa.id)
    or (f.requester_id = pessoa.id and f.addressee_id = auth.uid())
  where auth.uid() is not null and pessoa.id <> auth.uid();
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Hidden messages

alter table public.group_message
  add column hidden_at timestamptz,
  add column hidden_by uuid references public.profile (id) on delete set null;
alter table public.ride_message
  add column hidden_at timestamptz,
  add column hidden_by uuid references public.profile (id) on delete set null;

/**
 * Does this group message show for this reader? Not if an admin hid it, and not if the reader blocked whoever wrote
 * it — except a plan card, which is the group's invite to a game rather than something personal.
 */
create function public.group_message_visible(p_message public.group_message, p_reader uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_message.hidden_at is null
    and (p_message.kind = 'plano' or not public.has_blocked(p_reader, p_message.profile_id));
$$;

create or replace function public.group_messages(
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
  created_at timestamptz
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
    m.created_at
  from public.group_message as m
  join public.profile as p on p.id = m.profile_id
  where m.group_id = p_group_id
    and public.is_group_member(p_group_id, auth.uid())
    and public.group_message_visible(m, auth.uid())
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc, m.id desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;

create or replace function public.my_group_inbox()
returns table (
  group_id uuid,
  name text,
  role text,
  members integer,
  invite_code text,
  photo_path text,
  chat_background text,
  chat_background_path text,
  unread integer,
  last_kind text,
  last_body text,
  last_name text,
  last_mine boolean,
  last_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.name,
    eu.role,
    (select count(*)::integer from public.fan_group_member as x where x.group_id = g.id),
    g.invite_code,
    g.photo_path,
    g.chat_background,
    g.chat_background_path,
    (
      select count(*)::integer
      from public.group_message as m
      where m.group_id = g.id
        and m.profile_id <> auth.uid()
        and m.created_at > greatest(coalesce(lido.last_read_at, 'epoch'::timestamptz), eu.joined_at)
        and public.group_message_visible(m, auth.uid())
    ),
    ultima.kind,
    ultima.body,
    quem.display_name,
    ultima.profile_id = auth.uid(),
    ultima.created_at
  from public.fan_group as g
  join public.fan_group_member as eu on eu.group_id = g.id and eu.profile_id = auth.uid()
  left join public.group_message_read as lido on lido.group_id = g.id and lido.profile_id = auth.uid()
  left join lateral (
    select m.kind, m.body, m.created_at, m.profile_id
    from public.group_message as m
    where m.group_id = g.id and public.group_message_visible(m, auth.uid())
    order by m.created_at desc
    limit 1
  ) as ultima on true
  left join public.profile as quem on quem.id = ultima.profile_id
  where auth.uid() is not null
  order by coalesce(ultima.created_at, g.updated_at) desc;
$$;

create or replace function public.ride_messages(p_ride_id uuid, p_limit integer default 100)
returns table (
  id uuid,
  profile_id uuid,
  display_name text,
  body text,
  mine boolean,
  can_remove boolean,
  created_at timestamptz
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
    m.created_at
  from public.ride_message as m
  join public.ride as r on r.id = m.ride_id
  join public.profile as p on p.id = m.profile_id
  where m.ride_id = p_ride_id
    and public.in_ride(p_ride_id, auth.uid())
    and m.hidden_at is null
    and not public.has_blocked(auth.uid(), m.profile_id)
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

create or replace function public.my_ride_chats()
returns table (
  ride_id uuid,
  fixture_id text,
  unread integer,
  last_body text,
  last_name text,
  last_at timestamptz,
  open boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.fixture_id,
    (
      select count(*)::integer
      from public.ride_message as m
      where m.ride_id = r.id
        and m.profile_id <> auth.uid()
        and m.created_at > coalesce(lido.last_read_at, 'epoch'::timestamptz)
        and m.hidden_at is null
        and not public.has_blocked(auth.uid(), m.profile_id)
    ),
    ultima.body,
    quem.display_name,
    ultima.created_at,
    now() <= public.ride_chat_closes_at(f.kickoff_at)
  from public.ride as r
  join public.fixture as f on f.id = r.fixture_id
  left join public.ride_message_read as lido
    on lido.ride_id = r.id and lido.profile_id = auth.uid()
  left join lateral (
    select m.body, m.created_at, m.profile_id
    from public.ride_message as m
    where m.ride_id = r.id
      and m.hidden_at is null
      and not public.has_blocked(auth.uid(), m.profile_id)
    order by m.created_at desc
    limit 1
  ) as ultima on true
  left join public.profile as quem on quem.id = ultima.profile_id
  where auth.uid() is not null
    and r.status = 'open'
    and public.in_ride(r.id, auth.uid())
    and now() <= public.ride_chat_closes_at(f.kickoff_at) + interval '30 days'
  order by ultima.created_at desc nulls last;
$$;

-- A hidden message leaves open group chats straight away, like a deleted one.
create trigger group_message_hidden_broadcast
  after update of hidden_at on public.group_message
  for each row
  when (new.hidden_at is distinct from old.hidden_at)
  execute function public.broadcast_group_message();

-- ---------------------------------------------------------------------------------------------------------------------
-- Reports

create table public.content_report (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profile (id) on delete cascade,
  -- 'message': a group chat message; 'ride_message': a car chat message; 'profile': a person (their name);
  -- 'profile_photo': a person's photo; 'group': a group (its name or photo).
  kind text not null check (kind in ('message', 'ride_message', 'profile', 'profile_photo', 'group')),
  -- The message, person or group reported, depending on `kind`.
  target_id uuid not null,
  -- Who wrote the message, or the person reported. Empty for a group.
  reported_profile_id uuid references public.profile (id) on delete cascade,
  group_id uuid references public.fan_group (id) on delete cascade,
  ride_id uuid references public.ride (id) on delete cascade,
  reason text not null check (reason in ('ofensivo', 'assedio', 'spam', 'perigoso', 'outro')),
  note text check (note is null or char_length(note) <= 500),
  -- What it said when it was reported, so the report still makes sense if the author deletes it.
  content_snapshot text check (content_snapshot is null or char_length(content_snapshot) <= 600),
  status text not null default 'pendente' check (status in ('pendente', 'resolvida', 'rejeitada')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profile (id) on delete set null,
  constraint content_report_resolution check ((status = 'pendente') = (resolved_at is null))
);

-- One open report per person and thing: reporting again updates the reason.
create unique index content_report_one_open
  on public.content_report (reporter_id, kind, target_id)
  where status = 'pendente';
create index content_report_open_idx on public.content_report (kind, target_id) where status = 'pendente';

alter table public.content_report enable row level security;
revoke all on public.content_report from anon, authenticated;
grant select, update on public.content_report to authenticated;

-- Reporters write only through report_content. Only admins read and resolve.
create policy "admins read reports"
  on public.content_report for select to authenticated
  using ((select public.is_admin()));
create policy "admins resolve reports"
  on public.content_report for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

/**
 * Can this person see that one, anywhere in the app? Someone they crossed paths with (same group, car or trip), a
 * driver on the ride board, or someone who asked for a seat in their car.
 */
create function public.can_see_profile(p_viewer uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_viewer is not null and p_profile_id is not null and p_viewer <> p_profile_id and (
    public.have_crossed_paths(p_viewer, p_profile_id)
    or exists (select 1 from public.ride as r where r.driver_id = p_profile_id and r.status = 'open')
    or exists (
      select 1
      from public.ride as r
      join public.ride_passenger as rp on rp.ride_id = r.id
      where r.driver_id = p_viewer and rp.profile_id = p_profile_id
    )
  );
$$;

/** Report something. Only what the reporter can see, never their own, and at most 20 a day. */
create function public.report_content(
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
 * never who reported it.
 */
create function public.pending_content_reports()
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
      else coalesce(g.name, a.snapshot)
    end,
    case a.kind
      when 'message' then gm.id is null
      when 'ride_message' then rm.id is null
      when 'profile' then quem.id is null
      when 'profile_photo' then quem.avatar_path is null
      else g.id is null
    end,
    coalesce(gm.hidden_at, rm.hidden_at) is not null,
    case a.kind
      when 'message' then 'Conversa do grupo «' || coalesce(g.name, '?') || '»'
      when 'ride_message' then 'Conversa do carro de ' || coalesce(condutor.display_name, '?')
      when 'group' then 'Grupo'
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
  order by a.last_at desc;
$$;

/**
 * Close every open report on the same thing. 'esconder' hides a message for everyone; 'tirar_foto' takes a profile
 * photo down; 'resolver' closes it as dealt with; 'rejeitar' dismisses it.
 */
create function public.resolve_content_report(p_report_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  denuncia public.content_report;
  estado text;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  select * into denuncia from public.content_report where id = p_report_id;
  if denuncia.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if p_action = 'esconder' then
    if denuncia.kind = 'message' then
      update public.group_message set hidden_at = now(), hidden_by = caller
      where id = denuncia.target_id and hidden_at is null;
    elsif denuncia.kind = 'ride_message' then
      update public.ride_message set hidden_at = now(), hidden_by = caller
      where id = denuncia.target_id and hidden_at is null;
    else
      raise exception 'bad_action' using errcode = '22023';
    end if;
    estado := 'resolvida';
  elsif p_action = 'tirar_foto' then
    if denuncia.kind <> 'profile_photo' then
      raise exception 'bad_action' using errcode = '22023';
    end if;
    update public.profile set avatar_path = null where id = denuncia.target_id;
    estado := 'resolvida';
  elsif p_action = 'resolver' then
    estado := 'resolvida';
  elsif p_action = 'rejeitar' then
    estado := 'rejeitada';
  else
    raise exception 'bad_action' using errcode = '22023';
  end if;

  update public.content_report
  set status = estado, resolved_at = now(), resolved_by = caller
  where kind = denuncia.kind and target_id = denuncia.target_id and status = 'pendente';
end;
$$;

-- Profile photo reports move into the one queue. The old functions keep their signatures.
insert into public.content_report (reporter_id, kind, target_id, reported_profile_id, reason, note, content_snapshot, created_at)
select r.reported_by, 'profile_photo', r.profile_id, r.profile_id, 'outro', r.reason, p.avatar_path, r.created_at
from public.profile_photo_report as r
join public.profile as p on p.id = r.profile_id
where r.reported_by <> r.profile_id
on conflict do nothing;

create or replace function public.report_profile_photo(p_profile_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.report_content('profile_photo', p_profile_id, 'outro', left(p_reason, 500));
end;
$$;

create or replace function public.reported_profile_photos()
returns table (profile_id uuid, display_name text, avatar_path text, reports integer, last_report timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.avatar_path, count(*)::integer, max(r.created_at)
  from public.content_report as r
  join public.profile as p on p.id = r.target_id
  where r.kind = 'profile_photo' and r.status = 'pendente'
    and public.is_admin()
    and p.avatar_path is not null
  group by p.id, p.display_name, p.avatar_path
  order by max(r.created_at) desc;
$$;

create or replace function public.admin_clear_profile_photo(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  update public.profile set avatar_path = null where id = p_profile_id;
  update public.content_report
  set status = 'resolvida', resolved_at = now(), resolved_by = auth.uid()
  where kind = 'profile_photo' and target_id = p_profile_id and status = 'pendente';
end;
$$;

drop table public.profile_photo_report;

-- ---------------------------------------------------------------------------------------------------------------------
-- Grants

revoke execute on function public.has_blocked(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.apply_user_block() from public, anon, authenticated;
revoke execute on function public.group_message_visible(public.group_message, uuid) from public, anon, authenticated;
revoke execute on function public.can_see_profile(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.block_user(uuid) from public, anon;
revoke execute on function public.unblock_user(uuid) from public, anon;
revoke execute on function public.my_blocked_people() from public, anon;
revoke execute on function public.report_content(text, uuid, text, text) from public, anon;
revoke execute on function public.pending_content_reports() from public, anon;
revoke execute on function public.resolve_content_report(uuid, text) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.my_blocked_people() to authenticated;
grant execute on function public.report_content(text, uuid, text, text) to authenticated;
grant execute on function public.pending_content_reports() to authenticated;
grant execute on function public.resolve_content_report(uuid, text) to authenticated;
