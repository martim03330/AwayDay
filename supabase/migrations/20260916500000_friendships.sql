-- Amigos.
--
-- Convidar alguém para um grupo logo a seguir a uma boleia é demasiado direto: um grupo é um compromisso, e quem
-- deu boleia uma vez pode não querer entrar na malta de ninguém. Primeiro fica-se amigo — **e os dois têm de
-- querer**: um pedido só vale quando o outro aceita. A partir daí dá para convidar para uma boleia ou para um grupo,
-- ver as viagens que já fizeram juntos, e essa pessoa aparece à frente nas listas.
--
-- **Só se pede amizade a quem já se cruzou contigo**: alguém do mesmo grupo, do mesmo carro ou das mesmas contas.
-- Sem isto, a app tinha uma lista de pessoas para qualquer um chatear — e ninguém precisa disso num dia de jogo.
--
-- Uma amizade é uma linha só (quem pediu, a quem), nunca duas: o índice do par impede o contrário.

create table public.friendship (
  requester_id uuid not null references public.profile (id) on delete cascade,
  addressee_id uuid not null references public.profile (id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'aceite')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester_id, addressee_id),
  constraint friendship_two_people check (requester_id <> addressee_id)
);

-- O mesmo par não pode existir nos dois sentidos.
create unique index friendship_pair_idx on public.friendship (
  least(requester_id::text, addressee_id::text),
  greatest(requester_id::text, addressee_id::text)
);

create index friendship_addressee_idx on public.friendship (addressee_id);

alter table public.friendship enable row level security;
revoke all on public.friendship from anon, authenticated;

create function public.are_friends(p_one uuid, p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_one is not null and p_other is not null and exists (
    select 1 from public.friendship as f
    where f.status = 'aceite'
      and ((f.requester_id = p_one and f.addressee_id = p_other)
        or (f.requester_id = p_other and f.addressee_id = p_one))
  );
$$;

/** Vai no carro: conduz ou foi aceite. */
create function public.in_ride(p_ride_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile_id is not null and exists (
    select 1 from public.ride as r
    where r.id = p_ride_id and r.driver_id = p_profile_id
    union all
    select 1 from public.ride_passenger as rp
    where rp.ride_id = p_ride_id and rp.profile_id = p_profile_id and rp.status = 'accepted'
  );
$$;

/** Jogos em que duas pessoas foram no mesmo carro ou dividiram as mesmas contas. */
create function public.trips_together(p_one uuid, p_other uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct fixture_id)::integer from (
    select r.fixture_id
    from public.ride as r
    where r.status = 'open'
      and public.in_ride(r.id, p_one)
      and public.in_ride(r.id, p_other)
    union
    select s.fixture_id
    from public.trip_session as s
    where public.is_trip_member(s.id, p_one) and public.is_trip_member(s.id, p_other)
  ) as juntos;
$$;

/** Já se cruzaram: mesmo grupo, mesmo carro ou mesmas contas. É a quem se pode pedir amizade. */
create function public.have_crossed_paths(p_one uuid, p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_one is not null and p_other is not null and p_one <> p_other and (
    exists (
      select 1
      from public.fan_group_member as a
      join public.fan_group_member as b on b.group_id = a.group_id
      where a.profile_id = p_one and b.profile_id = p_other
    )
    or exists (
      select 1 from public.ride as r
      where public.in_ride(r.id, p_one) and public.in_ride(r.id, p_other)
    )
    or exists (
      select 1 from public.trip_session as s
      where public.is_trip_member(s.id, p_one) and public.is_trip_member(s.id, p_other)
    )
  );
$$;

-- Pedir amizade. Se essa pessoa já te tinha pedido, ficam amigos na hora.
create function public.send_friend_request(p_profile_id uuid)
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

  -- Já havia pedido dessa pessoa para mim: aceita-se, em vez de criar outro ao contrário.
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

-- Aceitar. Só quem recebeu o pedido.
create function public.accept_friend_request(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.friendship
  set status = 'aceite', responded_at = now()
  where requester_id = p_profile_id and addressee_id = auth.uid() and status = 'pendente';
  if not found then
    raise exception 'not_yours' using errcode = '42501';
  end if;
end;
$$;

-- Serve para recusar um pedido, desistir de um que mandaste, e deixar de ser amigo.
create function public.remove_friend(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendship
  where (requester_id = auth.uid() and addressee_id = p_profile_id)
     or (requester_id = p_profile_id and addressee_id = auth.uid());
  if not found then
    raise exception 'not_yours' using errcode = '42501';
  end if;
end;
$$;

create function public.my_friends()
returns table (
  profile_id uuid,
  display_name text,
  friends_since timestamptz,
  trips_together integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    outro.id,
    outro.display_name,
    f.responded_at,
    public.trips_together(auth.uid(), outro.id)
  from public.friendship as f
  join public.profile as outro
    on outro.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where f.status = 'aceite' and auth.uid() in (f.requester_id, f.addressee_id)
  order by outro.display_name;
$$;

/** Pedidos por responder: os que te fizeram ('recebido') e os que fizeste ('enviado'). */
create function public.my_friend_requests()
returns table (
  profile_id uuid,
  display_name text,
  direction text,
  asked_at timestamptz,
  trips_together integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    outro.id,
    outro.display_name,
    case when f.addressee_id = auth.uid() then 'recebido' else 'enviado' end,
    f.created_at,
    public.trips_together(auth.uid(), outro.id)
  from public.friendship as f
  join public.profile as outro
    on outro.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where f.status = 'pendente' and auth.uid() in (f.requester_id, f.addressee_id)
  order by f.created_at desc;
$$;

/** Em que pé estás com estas pessoas: 'amigos', 'pedido_enviado', 'pedido_recebido', 'pode_pedir' ou 'nada'. */
create function public.friendship_states(p_profile_ids uuid[])
returns table (profile_id uuid, state text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pessoa.id,
    case
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

revoke execute on function public.in_ride(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.have_crossed_paths(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.are_friends(uuid, uuid) from public, anon;
revoke execute on function public.trips_together(uuid, uuid) from public, anon;
revoke execute on function public.send_friend_request(uuid) from public, anon;
revoke execute on function public.accept_friend_request(uuid) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.my_friends() from public, anon;
revoke execute on function public.my_friend_requests() from public, anon;
revoke execute on function public.friendship_states(uuid[]) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.trips_together(uuid, uuid) to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.my_friends() to authenticated;
grant execute on function public.my_friend_requests() to authenticated;
grant execute on function public.friendship_states(uuid[]) to authenticated;
