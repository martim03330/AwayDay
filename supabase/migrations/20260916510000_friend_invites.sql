-- O que se faz com um amigo: convidá-lo para o carro ou para o grupo, e vê-lo à frente na lista.
--
-- Um convite nunca mete ninguém em lado nenhum à força: fica à espera que a pessoa aceite. É a diferença entre
-- convidar e arrastar.

create table public.group_invite (
  group_id uuid not null references public.fan_group (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  invited_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create index group_invite_profile_idx on public.group_invite (profile_id);

create table public.ride_invite (
  ride_id uuid not null references public.ride (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  invited_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (ride_id, profile_id)
);

create index ride_invite_profile_idx on public.ride_invite (profile_id);

alter table public.group_invite enable row level security;
alter table public.ride_invite enable row level security;
revoke all on public.group_invite from anon, authenticated;
revoke all on public.ride_invite from anon, authenticated;

-- Convidar um amigo para um grupo meu.
create function public.invite_friend_to_group(p_group_id uuid, p_profile_id uuid)
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

  insert into public.group_invite (group_id, profile_id, invited_by)
  values (p_group_id, p_profile_id, caller)
  on conflict (group_id, profile_id) do nothing;
end;
$$;

create function public.my_group_invites()
returns table (
  group_id uuid,
  group_name text,
  members integer,
  invited_by_name text,
  invited_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.name,
    (select count(*)::integer from public.fan_group_member as m where m.group_id = g.id),
    quem.display_name,
    i.created_at
  from public.group_invite as i
  join public.fan_group as g on g.id = i.group_id
  left join public.profile as quem on quem.id = i.invited_by
  where i.profile_id = auth.uid()
  order by i.created_at desc;
$$;

create function public.accept_group_invite(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  delete from public.group_invite where group_id = p_group_id and profile_id = caller;
  if not found then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  insert into public.fan_group_member (group_id, profile_id)
  values (p_group_id, caller)
  on conflict (group_id, profile_id) do nothing;
end;
$$;

create function public.decline_group_invite(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.group_invite where group_id = p_group_id and profile_id = auth.uid();
  if not found then
    raise exception 'not_yours' using errcode = '42501';
  end if;
end;
$$;

-- Convidar um amigo para a minha boleia. Só o condutor, e só com lugar livre.
create function public.invite_friend_to_ride(p_ride_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  boleia public.ride;
  ocupados integer;
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

  select count(*) into ocupados
  from public.ride_passenger as rp
  where rp.ride_id = p_ride_id and rp.status = 'accepted';
  if ocupados >= boleia.seats_offered then
    raise exception 'ride_full' using errcode = '22023';
  end if;

  insert into public.ride_invite (ride_id, profile_id, invited_by)
  values (p_ride_id, p_profile_id, caller)
  on conflict (ride_id, profile_id) do nothing;
end;
$$;

create function public.my_ride_invites()
returns table (
  ride_id uuid,
  fixture_id text,
  kickoff_at timestamptz,
  departure_at timestamptz,
  origin_name text,
  driver_name text,
  seats_left integer,
  share_cents integer,
  invited_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.fixture_id,
    f.kickoff_at,
    r.departure_at,
    r.origin_name,
    condutor.display_name,
    (r.seats_offered - taken.n)::integer,
    public.ride_share_cents(r.total_cents, 1 + taken.n + 1),
    i.created_at
  from public.ride_invite as i
  join public.ride as r on r.id = i.ride_id
  join public.fixture as f on f.id = r.fixture_id
  join public.profile as condutor on condutor.id = r.driver_id
  cross join lateral (
    select count(*)::integer as n from public.ride_passenger as rp
    where rp.ride_id = r.id and rp.status = 'accepted'
  ) as taken
  where i.profile_id = auth.uid() and r.status = 'open' and f.kickoff_at > now()
  order by r.departure_at;
$$;

-- Aceitar o convite: entra-se no carro sem pedir. O lugar tem de continuar lá.
create function public.accept_ride_invite(p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  boleia public.ride;
  ocupados integer;
begin
  select * into boleia from public.ride where id = p_ride_id for update;
  if not exists (
    select 1 from public.ride_invite where ride_id = p_ride_id and profile_id = caller
  ) then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  if boleia.status <> 'open' then
    raise exception 'ride_closed' using errcode = '22023';
  end if;

  select count(*) into ocupados
  from public.ride_passenger as rp
  where rp.ride_id = p_ride_id and rp.status = 'accepted';
  if ocupados >= boleia.seats_offered then
    raise exception 'ride_full' using errcode = '22023';
  end if;

  insert into public.ride_passenger (ride_id, profile_id, status)
  values (p_ride_id, caller, 'accepted')
  on conflict (ride_id, profile_id) do update set status = 'accepted';

  delete from public.ride_invite where ride_id = p_ride_id and profile_id = caller;
end;
$$;

create function public.decline_ride_invite(p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.ride_invite where ride_id = p_ride_id and profile_id = auth.uid();
  if not found then
    raise exception 'not_yours' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.invite_friend_to_group(uuid, uuid) from public, anon;
revoke execute on function public.my_group_invites() from public, anon;
revoke execute on function public.accept_group_invite(uuid) from public, anon;
revoke execute on function public.decline_group_invite(uuid) from public, anon;
revoke execute on function public.invite_friend_to_ride(uuid, uuid) from public, anon;
revoke execute on function public.my_ride_invites() from public, anon;
revoke execute on function public.accept_ride_invite(uuid) from public, anon;
revoke execute on function public.decline_ride_invite(uuid) from public, anon;
grant execute on function public.invite_friend_to_group(uuid, uuid) to authenticated;
grant execute on function public.my_group_invites() to authenticated;
grant execute on function public.accept_group_invite(uuid) to authenticated;
grant execute on function public.decline_group_invite(uuid) to authenticated;
grant execute on function public.invite_friend_to_ride(uuid, uuid) to authenticated;
grant execute on function public.my_ride_invites() to authenticated;
grant execute on function public.accept_ride_invite(uuid) to authenticated;
grant execute on function public.decline_ride_invite(uuid) to authenticated;
