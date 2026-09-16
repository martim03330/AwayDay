-- Grupos: a app não serve só para encontrar desconhecidos, serve também para a malta que já se conhece ir junta.
--
-- Um grupo é um conjunto de pessoas que se mantém de jogo para jogo. Entra-se por convite (um link, como o da
-- boleia) e não há pedidos nem aprovações: quem tem o link entra, quem quer sair sai, e quem o criou pode tirar
-- alguém de lá e trocar o link se ele andar a passar de mão em mão.
--
-- Os grupos também nascem sozinhos: **quando alguém entra na tua boleia**, fica logo criado o grupo dessa boleia com
-- o condutor e quem entrou, e cada pessoa aceita a seguir é acrescentada. É a maneira de a malta que se conheceu
-- numa boleia continuar junta sem ter de criar nada à mão.

create table public.fan_group (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  created_by uuid references public.profile (id) on delete set null,
  -- O convite é um código curto que vai num link. Pode ser trocado quando o grupo quiser.
  invite_code text not null unique check (invite_code ~ '^[a-z0-9]{10}$'),
  -- 'boleia': nasceu sozinho de uma boleia. 'manual': alguém o criou.
  source text not null default 'manual' check (source in ('manual', 'boleia')),
  ride_id uuid references public.ride (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma boleia só dá origem a um grupo.
create unique index fan_group_ride_idx on public.fan_group (ride_id) where ride_id is not null;

create table public.fan_group_member (
  group_id uuid not null references public.fan_group (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create index fan_group_member_profile_idx on public.fan_group_member (profile_id);

create trigger fan_group_set_updated_at
  before update on public.fan_group
  for each row execute function public.set_updated_at();

alter table public.fan_group enable row level security;
alter table public.fan_group_member enable row level security;
revoke all on public.fan_group from anon, authenticated;
revoke all on public.fan_group_member from anon, authenticated;

create function public.new_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select substr(md5(gen_random_uuid()::text), 1, 10);
$$;

create function public.is_group_member(p_group_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.fan_group_member as m
    where m.group_id = p_group_id and m.profile_id = p_profile_id
  );
$$;

-- Criar um grupo. Quem o cria fica como dono e primeiro membro.
create function public.create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  nome text := btrim(coalesce(p_name, ''));
  novo uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if char_length(nome) < 2 or char_length(nome) > 60 then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'group-create', 5, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.fan_group (name, created_by, invite_code)
  values (nome, caller, public.new_invite_code())
  returning id into novo;

  insert into public.fan_group_member (group_id, profile_id, role)
  values (novo, caller, 'owner');

  return novo;
end;
$$;

-- Entrar com o código do convite. Sem pedidos nem aprovações: quem tem o link, entra.
create function public.join_group_with_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  alvo public.fan_group;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.take_rate_limit(caller, 'group-join', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  select * into alvo from public.fan_group where invite_code = lower(btrim(p_code));
  if alvo.id is null then
    raise exception 'group_not_found' using errcode = 'P0002';
  end if;

  insert into public.fan_group_member (group_id, profile_id)
  values (alvo.id, caller)
  on conflict (group_id, profile_id) do nothing;

  return alvo.id;
end;
$$;

-- Sair. Se sair quem é dono, o grupo fica com o membro mais antigo; se sair o último, o grupo acaba.
create function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  era_dono boolean;
  seguinte uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select role = 'owner' into era_dono
  from public.fan_group_member where group_id = p_group_id and profile_id = caller;
  if era_dono is null then
    raise exception 'not_member' using errcode = '42501';
  end if;

  delete from public.fan_group_member where group_id = p_group_id and profile_id = caller;

  if era_dono then
    select profile_id into seguinte
    from public.fan_group_member where group_id = p_group_id
    order by joined_at limit 1;
    if seguinte is null then
      delete from public.fan_group where id = p_group_id;
    else
      update public.fan_group_member set role = 'owner'
      where group_id = p_group_id and profile_id = seguinte;
    end if;
  end if;
end;
$$;

-- Coisas de dono: mudar o nome, trocar o link do convite e tirar alguém do grupo.
create function public.rename_group(p_group_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  nome text := btrim(coalesce(p_name, ''));
begin
  if char_length(nome) < 2 or char_length(nome) > 60 then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  update public.fan_group set name = nome
  where id = p_group_id
    and exists (
      select 1 from public.fan_group_member as m
      where m.group_id = p_group_id and m.profile_id = auth.uid() and m.role = 'owner'
    );
  if not found then
    raise exception 'not_owner' using errcode = '42501';
  end if;
end;
$$;

create function public.rotate_group_invite(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo text := public.new_invite_code();
begin
  update public.fan_group set invite_code = novo
  where id = p_group_id
    and exists (
      select 1 from public.fan_group_member as m
      where m.group_id = p_group_id and m.profile_id = auth.uid() and m.role = 'owner'
    );
  if not found then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  return novo;
end;
$$;

create function public.remove_group_member(p_group_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_profile_id = auth.uid() then
    raise exception 'own_membership' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.fan_group_member as m
    where m.group_id = p_group_id and m.profile_id = auth.uid() and m.role = 'owner'
  ) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  delete from public.fan_group_member where group_id = p_group_id and profile_id = p_profile_id;
end;
$$;

-- Os meus grupos, com quanta gente têm.
create function public.my_groups()
returns table (
  id uuid,
  name text,
  role text,
  members integer,
  source text,
  invite_code text,
  created_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, m.role, gente.n, g.source, g.invite_code, g.created_at::date
  from public.fan_group as g
  join public.fan_group_member as m on m.group_id = g.id and m.profile_id = auth.uid()
  cross join lateral (
    select count(*)::integer as n from public.fan_group_member as x where x.group_id = g.id
  ) as gente
  where auth.uid() is not null
  order by g.updated_at desc;
$$;

-- Quem está no grupo, com o mesmo que se mostra nas casas: desde quando tem conta, boleias e faltas.
create function public.group_members(p_group_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  role text,
  member_since date,
  rides_completed integer,
  rides_faults integer,
  is_mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.profile_id, p.display_name, m.role, p.created_at::date, rep.completed, rep.faults,
    m.profile_id = auth.uid()
  from public.fan_group_member as m
  join public.profile as p on p.id = m.profile_id
  cross join lateral public.ride_reputation(array[m.profile_id]) as rep
  where m.group_id = p_group_id and public.is_group_member(p_group_id, auth.uid())
  order by m.role, m.joined_at;
$$;

-- Ver um convite antes de entrar: quem convida, quantos são. Não precisa de ser membro — é esse o objetivo.
create function public.group_by_code(p_code text)
returns table (id uuid, name text, members integer, already_in boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, gente.n, public.is_group_member(g.id, auth.uid())
  from public.fan_group as g
  cross join lateral (
    select count(*)::integer as n from public.fan_group_member as x where x.group_id = g.id
  ) as gente
  where g.invite_code = lower(btrim(p_code)) and auth.uid() is not null;
$$;

-- O grupo que nasce de uma boleia: fica criado quando a primeira pessoa é aceite, e cada pessoa aceita a seguir
-- entra nele. Nunca estraga um pedido de lugar: se alguma coisa correr mal aqui, a boleia segue na mesma.
create function public.group_for_ride()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  viagem public.ride;
  nome text;
  grupo uuid;
begin
  if new.status <> 'accepted' then
    return null;
  end if;

  select * into viagem from public.ride where id = new.ride_id;
  if viagem.id is null then
    return null;
  end if;

  select g.id into grupo from public.fan_group as g where g.ride_id = viagem.id;

  if grupo is null then
    select coalesce(ch.short_name, 'Jogo') || ' x ' || coalesce(ca.short_name, '')
    into nome
    from public.fixture as f
    left join public.club as ch on ch.id = f.home_club_id
    left join public.club as ca on ca.id = f.away_club_id
    where f.id = viagem.fixture_id;

    insert into public.fan_group (name, created_by, invite_code, source, ride_id)
    values (left(btrim(coalesce('Boleia · ' || nome, 'Boleia')), 60), viagem.driver_id,
            public.new_invite_code(), 'boleia', viagem.id)
    returning id into grupo;

    insert into public.fan_group_member (group_id, profile_id, role)
    values (grupo, viagem.driver_id, 'owner')
    on conflict (group_id, profile_id) do nothing;
  end if;

  insert into public.fan_group_member (group_id, profile_id)
  values (grupo, new.profile_id)
  on conflict (group_id, profile_id) do nothing;

  return null;
exception when others then
  return null;
end;
$$;

create trigger ride_passenger_group
  after insert or update of status on public.ride_passenger
  for each row execute function public.group_for_ride();

revoke execute on function public.new_invite_code() from public, anon, authenticated;
revoke execute on function public.group_for_ride() from public, anon, authenticated;
revoke execute on function public.is_group_member(uuid, uuid) from public, anon;
revoke execute on function public.create_group(text) from public, anon;
revoke execute on function public.join_group_with_code(text) from public, anon;
revoke execute on function public.leave_group(uuid) from public, anon;
revoke execute on function public.rename_group(uuid, text) from public, anon;
revoke execute on function public.rotate_group_invite(uuid) from public, anon;
revoke execute on function public.remove_group_member(uuid, uuid) from public, anon;
revoke execute on function public.my_groups() from public, anon;
revoke execute on function public.group_members(uuid) from public, anon;
revoke execute on function public.group_by_code(text) from public, anon;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group_with_code(text) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.rename_group(uuid, text) to authenticated;
grant execute on function public.rotate_group_invite(uuid) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.my_groups() to authenticated;
grant execute on function public.group_members(uuid) to authenticated;
grant execute on function public.group_by_code(text) to authenticated;
