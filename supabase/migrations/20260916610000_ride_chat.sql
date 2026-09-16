-- A conversa do carro.
--
-- Combinar uma boleia por «notas» na ficha não dá: quem entra quer perguntar se o carro passa em Mangualde, a que
-- horas sai mesmo, onde é o ponto de encontro. Passa a haver uma conversa **por boleia**, com o condutor e quem já
-- foi aceite — toda a gente lê o mesmo e o condutor não repete quatro vezes.
--
-- **Só entra quem já tem lugar.** Quem pediu e ainda não teve resposta não escreve: senão um condutor com o carro
-- cheio ficava com mensagens de dez desconhecidos, e o pedido de lugar já leva um recado escrito.
--
-- A conversa fecha-se à escrita um dia depois do jogo — o que havia a combinar já foi combinado —, mas continua a
-- poder ser lida por quem lá esteve. Cada um apaga o que escreveu; o condutor pode apagar o que for do carro dele.

create table public.ride_message (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.ride (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index ride_message_ride_idx on public.ride_message (ride_id, created_at);

create table public.ride_message_read (
  ride_id uuid not null references public.ride (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (ride_id, profile_id)
);

alter table public.ride_message enable row level security;
alter table public.ride_message_read enable row level security;
revoke all on public.ride_message from anon, authenticated;
revoke all on public.ride_message_read from anon, authenticated;

/** Até quando se escreve numa boleia: o dia seguinte ao jogo. */
create function public.ride_chat_closes_at(p_kickoff timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select p_kickoff + interval '24 hours';
$$;

create function public.send_ride_message(p_ride_id uuid, p_body text)
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

  insert into public.ride_message (ride_id, profile_id, body)
  values (p_ride_id, caller, texto)
  returning id into nova;

  return nova;
end;
$$;

create function public.ride_messages(p_ride_id uuid, p_limit integer default 100)
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
  where m.ride_id = p_ride_id and public.in_ride(p_ride_id, auth.uid())
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

-- Apagar: quem escreveu, ou o condutor (o carro é dele).
create function public.remove_ride_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.ride_message as m
  using public.ride as r
  where r.id = m.ride_id
    and m.id = p_message_id
    and (m.profile_id = auth.uid() or r.driver_id = auth.uid());
  if not found then
    raise exception 'not_yours' using errcode = '42501';
  end if;
end;
$$;

create function public.mark_ride_messages_read(p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.in_ride(p_ride_id, auth.uid()) then
    raise exception 'not_in_ride' using errcode = '42501';
  end if;
  insert into public.ride_message_read (ride_id, profile_id, last_read_at)
  values (p_ride_id, auth.uid(), now())
  on conflict (ride_id, profile_id) do update set last_read_at = now();
end;
$$;

/** As conversas dos carros em que vou, com o que ainda não li. É o que põe o ponto vermelho no sítio certo. */
create function public.my_ride_chats()
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

revoke execute on function public.ride_chat_closes_at(timestamptz) from public, anon;
revoke execute on function public.send_ride_message(uuid, text) from public, anon;
revoke execute on function public.ride_messages(uuid, integer) from public, anon;
revoke execute on function public.remove_ride_message(uuid) from public, anon;
revoke execute on function public.mark_ride_messages_read(uuid) from public, anon;
revoke execute on function public.my_ride_chats() from public, anon;
grant execute on function public.send_ride_message(uuid, text) to authenticated;
grant execute on function public.ride_messages(uuid, integer) to authenticated;
grant execute on function public.remove_ride_message(uuid) to authenticated;
grant execute on function public.mark_ride_messages_read(uuid) to authenticated;
grant execute on function public.my_ride_chats() to authenticated;
