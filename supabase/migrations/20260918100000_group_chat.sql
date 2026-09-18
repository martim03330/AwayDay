-- O grupo passa a ser uma conversa.
--
-- Até aqui um grupo era uma lista de pessoas com um link de convite, escondida no perfil. A malta não combina nada
-- numa lista: combina a falar. O grupo ganha um separador próprio («Malta») e, lá dentro, uma **conversa**, com a
-- cara do grupo (uma foto) e um fundo que o grupo escolhe — um dos da app, ou uma foto do telemóvel.
--
-- **Quem lê e escreve é quem está no grupo.** Tudo por funções, como no resto dos grupos: as tabelas não se leem
-- nem escrevem diretamente. Cada um apaga o que escreveu; quem criou o grupo pode apagar qualquer mensagem.
--
-- **«Estou aqui».** Quem está num tasco pode dizê-lo ao grupo, com um toque. É uma mensagem como as outras, escrita
-- pela própria pessoa, quando quer — a app não segue ninguém. Os check-ins continuam como estavam: nunca são lidos
-- pela app, e o mapa continua a mostrar só agregados. É a alternativa a pintar o tasco no mapa quando «alguém do
-- grupo está lá», que mostrava onde uma pessoa está sem ela o ter dito (ver docs/DECISOES.md, 2026-09-18).
--
-- **Quem está online.** Cada telemóvel com a conversa aberta anuncia-se num canal privado do Realtime, `group:<id>`.
-- Só entra no canal quem é do grupo (políticas em `realtime.messages`). O canal serve também para avisar que há
-- mensagens novas: o aviso leva só o id, e a conversa volta a pedir as mensagens pela função de sempre.

-- A cara do grupo e o fundo da conversa.
alter table public.fan_group
  add column photo_path text
    check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$'),
  add column chat_background text not null default 'relvado'
    check (chat_background in ('relvado', 'bancada', 'noite', 'cachecol', 'liso', 'foto')),
  add column chat_background_path text
    check (chat_background_path is null or chat_background_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$'),
  add constraint fan_group_background_photo check (chat_background <> 'foto' or chat_background_path is not null);

-- O balde das fotos dos grupos: privado, 5 MB, e uma pasta por grupo. Só quem é do grupo vê e mexe.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-photos', 'group-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/heic'])
on conflict (id) do nothing;

/** A pasta (ou o tópico) é de um grupo em que esta pessoa está? Sem rebentar com nomes que não são um uuid. */
create function public.is_group_folder_member(p_folder text, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_group_member(p_folder::uuid, p_profile_id)
    else false
  end;
$$;

create policy "group members see group photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'group-photos'
    and public.is_group_folder_member((storage.foldername(name))[1], (select auth.uid()))
  );
create policy "group members upload group photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'group-photos'
    and public.is_group_folder_member((storage.foldername(name))[1], (select auth.uid()))
  );
create policy "group members replace group photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'group-photos'
    and public.is_group_folder_member((storage.foldername(name))[1], (select auth.uid()))
  )
  with check (
    bucket_id = 'group-photos'
    and public.is_group_folder_member((storage.foldername(name))[1], (select auth.uid()))
  );
create policy "group members delete group photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'group-photos'
    and public.is_group_folder_member((storage.foldername(name))[1], (select auth.uid()))
  );

-- As mensagens.
create table public.group_message (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.fan_group (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  -- 'texto': uma mensagem escrita; 'local': «estou aqui», num tasco (o corpo é «no Tasco do Zé»).
  kind text not null default 'texto' check (kind in ('texto', 'local')),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  place_id text references public.place (id) on delete set null,
  created_at timestamptz not null default now()
);

create index group_message_group_idx on public.group_message (group_id, created_at desc);

create table public.group_message_read (
  group_id uuid not null references public.fan_group (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

alter table public.group_message enable row level security;
alter table public.group_message_read enable row level security;
revoke all on public.group_message from anon, authenticated;
revoke all on public.group_message_read from anon, authenticated;

create function public.send_group_message(p_group_id uuid, p_body text)
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
  if not public.take_rate_limit(caller, 'group-message', 300, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.group_message (group_id, profile_id, body)
  values (p_group_id, caller, texto)
  returning id into nova;

  update public.fan_group set updated_at = now() where id = p_group_id;
  return nova;
end;
$$;

/** «Estou aqui»: diz ao grupo em que tasco estás. Só o nome do tasco — nunca coordenadas. */
create function public.share_place_with_group(p_group_id uuid, p_place_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  nome text;
  nova uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.is_group_member(p_group_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  -- A frase já com a preposição certa: «no Tasco do Zé», «na Adega», «em Casa Ramos».
  select
    case p.name_article
      when 'o' then 'no '
      when 'a' then 'na '
      when 'os' then 'nos '
      when 'as' then 'nas '
      else 'em '
    end || p.name
  into nome
  from public.place as p
  where p.id = p_place_id;
  if nome is null then
    raise exception 'place_not_found' using errcode = 'P0002';
  end if;
  if not public.take_rate_limit(caller, 'group-place', 30, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.group_message (group_id, profile_id, kind, body, place_id)
  values (p_group_id, caller, 'local', nome, p_place_id)
  returning id into nova;

  update public.fan_group set updated_at = now() where id = p_group_id;
  return nova;
end;
$$;

/** As mensagens, da mais recente para trás. `p_before` serve para ir buscar as mais antigas. */
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
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;

-- Apagar: quem escreveu, ou o dono do grupo.
create function public.remove_group_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.group_message as m
  where m.id = p_message_id
    and (
      m.profile_id = auth.uid()
      or exists (
        select 1 from public.fan_group_member as dono
        where dono.group_id = m.group_id and dono.profile_id = auth.uid() and dono.role = 'owner'
      )
    );
  if not found then
    raise exception 'not_yours' using errcode = '42501';
  end if;
end;
$$;

create function public.mark_group_messages_read(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_member(p_group_id, auth.uid()) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  insert into public.group_message_read (group_id, profile_id, last_read_at)
  values (p_group_id, auth.uid(), now())
  on conflict (group_id, profile_id) do update set last_read_at = now();
end;
$$;

/**
 * A lista da Malta: os meus grupos, com a cara, o fundo, a última mensagem e o que está por ler. Os grupos com
 * conversa mais recente vêm primeiro.
 */
create function public.my_group_inbox()
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
    where m.group_id = g.id
    order by m.created_at desc
    limit 1
  ) as ultima on true
  left join public.profile as quem on quem.id = ultima.profile_id
  where auth.uid() is not null
  order by coalesce(ultima.created_at, g.updated_at) desc;
$$;

-- A cara do grupo. Qualquer pessoa do grupo a pode mudar, como o fundo: o grupo é de todos.
create function public.set_group_photo(p_group_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_member(p_group_id, auth.uid()) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_path is not null and p_path !~ ('^' || p_group_id::text || '/[A-Za-z0-9._-]{1,100}$') then
    raise exception 'bad_path' using errcode = '22023';
  end if;
  update public.fan_group set photo_path = p_path where id = p_group_id;
end;
$$;

/** O fundo da conversa: um dos da app, ou 'foto' com o caminho de uma foto do grupo. */
create function public.set_group_chat_background(
  p_group_id uuid,
  p_background text,
  p_path text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_member(p_group_id, auth.uid()) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_background not in ('relvado', 'bancada', 'noite', 'cachecol', 'liso', 'foto') then
    raise exception 'bad_background' using errcode = '22023';
  end if;
  if p_background = 'foto'
    and (p_path is null or p_path !~ ('^' || p_group_id::text || '/[A-Za-z0-9._-]{1,100}$')) then
    raise exception 'bad_path' using errcode = '22023';
  end if;
  update public.fan_group
  set chat_background = p_background,
      chat_background_path = case when p_background = 'foto' then p_path else null end
  where id = p_group_id;
end;
$$;

-- Realtime: o canal privado de cada grupo (quem está online e o aviso de mensagens novas). Só para quem é do grupo.
create function public.can_use_group_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_topic like 'group:%' and public.is_group_folder_member(substr(p_topic, 7), auth.uid());
$$;

create policy "group members listen to their group"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.can_use_group_topic((select realtime.topic()))
  );
create policy "group members announce themselves in their group"
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and public.can_use_group_topic((select realtime.topic()))
  );

/** Mensagem nova ou apagada: avisa quem tem a conversa aberta. Nunca trava a mensagem. */
create function public.broadcast_group_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  grupo uuid := coalesce(new.group_id, old.group_id);
begin
  begin
    perform realtime.send(
      jsonb_build_object('id', coalesce(new.id, old.id)),
      'messages',
      'group:' || grupo::text,
      true
    );
  exception when others then
    null;
  end;
  return null;
end;
$$;

create trigger group_message_broadcast
  after insert or delete on public.group_message
  for each row execute function public.broadcast_group_message();

-- Notificações: os outros do grupo recebem um aviso de cada mensagem. Pode desligar-se nas definições.
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
      -- Mensagens na conversa de um grupo.
      'group_message'
    )
  );

create function public.notify_group_message()
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
    'body', new.body
  ));
  return null;
end;
$$;

create trigger group_message_notify
  after insert on public.group_message
  for each row execute function public.notify_group_message();

revoke execute on function public.is_group_folder_member(text, uuid) from public, anon;
revoke execute on function public.send_group_message(uuid, text) from public, anon;
revoke execute on function public.share_place_with_group(uuid, text) from public, anon;
revoke execute on function public.group_messages(uuid, timestamptz, integer) from public, anon;
revoke execute on function public.remove_group_message(uuid) from public, anon;
revoke execute on function public.mark_group_messages_read(uuid) from public, anon;
revoke execute on function public.my_group_inbox() from public, anon;
revoke execute on function public.set_group_photo(uuid, text) from public, anon;
revoke execute on function public.set_group_chat_background(uuid, text, text) from public, anon;
revoke execute on function public.can_use_group_topic(text) from public, anon;
revoke execute on function public.broadcast_group_message() from public, anon, authenticated;
revoke execute on function public.notify_group_message() from public, anon, authenticated;
grant execute on function public.is_group_folder_member(text, uuid) to authenticated;
grant execute on function public.send_group_message(uuid, text) to authenticated;
grant execute on function public.share_place_with_group(uuid, text) to authenticated;
grant execute on function public.group_messages(uuid, timestamptz, integer) to authenticated;
grant execute on function public.remove_group_message(uuid) to authenticated;
grant execute on function public.mark_group_messages_read(uuid) to authenticated;
grant execute on function public.my_group_inbox() to authenticated;
grant execute on function public.set_group_photo(uuid, text) to authenticated;
grant execute on function public.set_group_chat_background(uuid, text, text) to authenticated;
grant execute on function public.can_use_group_topic(text) to authenticated;
