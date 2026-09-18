-- Os planos: combinar um jogo dentro do grupo.
--
-- Alguém abre um jogo e convida o grupo. O convite cai na conversa como um cartão — o jogo, a hora, o estádio — e a
-- malta responde **Vou** ou **Estou a pensar**. A partir daí é um **plano em aberto**: quem convidou combina a boleia
-- e, se for preciso, a dormida. Quando está tudo tratado, o plano **fecha** — sozinho, quando o carro enche, ou à mão,
-- mesmo com lugares por encher. É o plano fechado que, na véspera do jogo, abre a sessão da viagem (parte seguinte).
--
-- **Um plano por grupo e por jogo.** Convidar outra vez o mesmo grupo para o mesmo jogo volta a pôr o mesmo plano na
-- conversa, em vez de abrir outro.
--
-- **Misturar grupos.** Quem convidou pode mandar o plano a outro grupo seu: o cartão aparece lá, e essa malta também
-- responde e vê a boleia e a casa do plano, mesmo que sejam «só do grupo». Para isso, as funções que decidem quem vê
-- uma boleia ou uma casa privadas passam a perguntar também «está num grupo com quem o plano foi partilhado?».
--
-- **A boleia e a casa ligam-se sozinhas.** Quando alguém que está no plano põe uma boleia (ou uma casa) no grupo para
-- aquele jogo, ela passa a ser a do plano. Também dá para escolher à mão.

create table public.fixture_plan (
  id uuid primary key default gen_random_uuid(),
  -- O grupo onde o plano nasceu.
  group_id uuid not null references public.fan_group (id) on delete cascade,
  fixture_id text not null references public.fixture (id) on delete cascade,
  created_by uuid not null references public.profile (id) on delete cascade,
  status text not null default 'aberto' check (status in ('aberto', 'fechado', 'cancelado')),
  ride_id uuid references public.ride (id) on delete set null,
  stay_plan_id uuid references public.stay_plan (id) on delete set null,
  -- 'carro_cheio': fechou sozinho; 'manual': quem convidou fechou.
  closed_reason text check (closed_reason in ('carro_cheio', 'manual')),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index fixture_plan_one_per_group
  on public.fixture_plan (group_id, fixture_id)
  where status <> 'cancelado';
create index fixture_plan_ride_idx on public.fixture_plan (ride_id) where ride_id is not null;
create index fixture_plan_stay_idx on public.fixture_plan (stay_plan_id) where stay_plan_id is not null;

-- Os outros grupos a quem o plano foi mandado.
create table public.fixture_plan_group (
  plan_id uuid not null references public.fixture_plan (id) on delete cascade,
  group_id uuid not null references public.fan_group (id) on delete cascade,
  shared_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (plan_id, group_id)
);

create table public.fixture_plan_answer (
  plan_id uuid not null references public.fixture_plan (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  answer text not null check (answer in ('vou', 'talvez')),
  updated_at timestamptz not null default now(),
  primary key (plan_id, profile_id)
);

alter table public.fixture_plan enable row level security;
alter table public.fixture_plan_group enable row level security;
alter table public.fixture_plan_answer enable row level security;
revoke all on public.fixture_plan from anon, authenticated;
revoke all on public.fixture_plan_group from anon, authenticated;
revoke all on public.fixture_plan_answer from anon, authenticated;

-- O cartão do convite na conversa.
alter table public.group_message
  add column plan_id uuid references public.fixture_plan (id) on delete cascade;
alter table public.group_message drop constraint group_message_kind_check;
alter table public.group_message
  add constraint group_message_kind_check check (kind in ('texto', 'local', 'plano')),
  add constraint group_message_plan_needs_id check (kind <> 'plano' or plan_id is not null);

/** Esta pessoa vê o plano: é do grupo onde nasceu, ou de um grupo a quem foi mandado. */
create function public.can_see_fixture_plan(p_plan_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.fixture_plan as fp
    where fp.id = p_plan_id and public.is_group_member(fp.group_id, p_profile_id)
  ) or exists (
    select 1 from public.fixture_plan_group as fg
    where fg.plan_id = p_plan_id and public.is_group_member(fg.group_id, p_profile_id)
  );
$$;

/** Uma boleia «só do grupo» vê-a quem é do grupo — ou de um grupo a quem foi mandado o plano dessa boleia. */
create function public.can_see_private_ride(p_ride_id uuid, p_group_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p_group_id is not null and public.is_group_member(p_group_id, p_profile_id))
    or exists (
      select 1 from public.fixture_plan as fp
      where fp.ride_id = p_ride_id
        and fp.status <> 'cancelado'
        and public.can_see_fixture_plan(fp.id, p_profile_id)
    );
$$;

/** O mesmo, para as casas. */
create function public.can_see_private_stay(p_stay_id uuid, p_group_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p_group_id is not null and public.is_group_member(p_group_id, p_profile_id))
    or exists (
      select 1 from public.fixture_plan as fp
      where fp.stay_plan_id = p_stay_id
        and fp.status <> 'cancelado'
        and public.can_see_fixture_plan(fp.id, p_profile_id)
    );
$$;

/** "Benfica x Porto", para o corpo da mensagem e para as notificações. */
create function public.fixture_short_title(p_fixture_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(casa.short_name, casa.name, '?') || ' x ' || coalesce(fora.short_name, fora.name, '?')
  from public.fixture as f
  left join public.club as casa on casa.id = f.home_club_id
  left join public.club as fora on fora.id = f.away_club_id
  where f.id = p_fixture_id;
$$;

/** Põe o cartão do plano na conversa de um grupo. */
create function public.post_plan_message(p_plan_id uuid, p_group_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  jogo text;
begin
  select public.fixture_short_title(fp.fixture_id) into jogo
  from public.fixture_plan as fp where fp.id = p_plan_id;
  insert into public.group_message (group_id, profile_id, kind, body, plan_id)
  values (p_group_id, p_profile_id, 'plano', coalesce(jogo, 'um jogo'), p_plan_id);
  update public.fan_group set updated_at = now() where id = p_group_id;
end;
$$;

/**
 * Convidar o grupo para um jogo. Se o grupo já tem um plano para esse jogo, o cartão volta à conversa em vez de
 * nascer outro plano. Quem convida fica logo como «vou».
 */
create function public.invite_group_to_fixture(p_group_id uuid, p_fixture_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  apito timestamptz;
  plano uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.is_group_member(p_group_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select f.kickoff_at into apito from public.fixture as f where f.id = p_fixture_id;
  if apito is null then
    raise exception 'fixture_not_found' using errcode = 'P0002';
  end if;
  if apito < now() then
    raise exception 'fixture_over' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'fixture-plan', 30, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  select fp.id into plano
  from public.fixture_plan as fp
  where fp.group_id = p_group_id and fp.fixture_id = p_fixture_id and fp.status <> 'cancelado';

  if plano is null then
    insert into public.fixture_plan (group_id, fixture_id, created_by)
    values (p_group_id, p_fixture_id, caller)
    returning id into plano;
  end if;

  insert into public.fixture_plan_answer (plan_id, profile_id, answer)
  values (plano, caller, 'vou')
  on conflict (plan_id, profile_id) do nothing;

  perform public.post_plan_message(plano, p_group_id, caller);
  return plano;
end;
$$;

/** Mandar o plano a outro grupo. Só quem convidou, e só para grupos onde está. */
create function public.share_fixture_plan(p_plan_id uuid, p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
begin
  select * into plano from public.fixture_plan where id = p_plan_id;
  if plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.created_by is distinct from caller then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if plano.status <> 'aberto' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;
  if not public.is_group_member(p_group_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_group_id = plano.group_id then
    raise exception 'same_group' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'fixture-plan', 30, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.fixture_plan_group (plan_id, group_id, shared_by)
  values (p_plan_id, p_group_id, caller)
  on conflict (plan_id, group_id) do nothing;

  perform public.post_plan_message(p_plan_id, p_group_id, caller);
end;
$$;

/** «Vou», «Estou a pensar», ou `null` para tirar a resposta. Só enquanto o plano está em aberto. */
create function public.answer_fixture_plan(p_plan_id uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  estado text;
begin
  if caller is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  select fp.status into estado from public.fixture_plan as fp where fp.id = p_plan_id;
  if estado <> 'aberto' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;
  if p_answer is null then
    delete from public.fixture_plan_answer where plan_id = p_plan_id and profile_id = caller;
    return;
  end if;
  if p_answer not in ('vou', 'talvez') then
    raise exception 'bad_answer' using errcode = '22023';
  end if;
  insert into public.fixture_plan_answer (plan_id, profile_id, answer)
  values (p_plan_id, caller, p_answer)
  on conflict (plan_id, profile_id) do update set answer = excluded.answer, updated_at = now();
end;
$$;

/** Fecha o plano sozinho quando o carro da boleia fica cheio. */
create function public.close_plans_with_full_ride(p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.fixture_plan as fp
  set status = 'fechado', closed_reason = 'carro_cheio', closed_at = now(), updated_at = now()
  from public.ride as r
  where fp.ride_id = p_ride_id
    and r.id = p_ride_id
    and fp.status = 'aberto'
    and r.status = 'open'
    and (
      select count(*) from public.ride_passenger as rp
      where rp.ride_id = r.id and rp.status = 'accepted'
    ) >= r.seats_offered;
end;
$$;

create function public.close_plans_after_passenger_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.close_plans_with_full_ride(new.ride_id);
  return null;
end;
$$;

create trigger fixture_plan_ride_full
  after insert or update of status on public.ride_passenger
  for each row execute function public.close_plans_after_passenger_change();

/**
 * Qual é a boleia do plano. Pode escolhê-la quem convidou, ou o próprio condutor (se estiver no plano). `null` tira
 * a boleia. A boleia tem de ser para o mesmo jogo.
 */
create function public.set_fixture_plan_ride(p_plan_id uuid, p_ride_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
  boleia public.ride;
begin
  select * into plano from public.fixture_plan where id = p_plan_id for update;
  if plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.status = 'cancelado' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;

  if p_ride_id is null then
    if plano.created_by is distinct from caller and not exists (
      select 1 from public.ride as r where r.id = plano.ride_id and r.driver_id = caller
    ) then
      raise exception 'not_owner' using errcode = '42501';
    end if;
    update public.fixture_plan set ride_id = null, updated_at = now() where id = p_plan_id;
    return;
  end if;

  select * into boleia from public.ride where id = p_ride_id;
  if boleia.id is null or boleia.status <> 'open' or boleia.fixture_id <> plano.fixture_id then
    raise exception 'ride_not_found' using errcode = 'P0002';
  end if;
  if plano.created_by is distinct from caller and boleia.driver_id is distinct from caller then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  update public.fixture_plan set ride_id = p_ride_id, updated_at = now() where id = p_plan_id;
  perform public.close_plans_with_full_ride(p_ride_id);
end;
$$;

/** A casa do plano, com as mesmas regras da boleia. */
create function public.set_fixture_plan_stay(p_plan_id uuid, p_stay_plan_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
  casa public.stay_plan;
begin
  select * into plano from public.fixture_plan where id = p_plan_id for update;
  if plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.status = 'cancelado' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;

  if p_stay_plan_id is null then
    if plano.created_by is distinct from caller and not exists (
      select 1 from public.stay_plan as s where s.id = plano.stay_plan_id and s.profile_id = caller
    ) then
      raise exception 'not_owner' using errcode = '42501';
    end if;
    update public.fixture_plan set stay_plan_id = null, updated_at = now() where id = p_plan_id;
    return;
  end if;

  select * into casa from public.stay_plan where id = p_stay_plan_id;
  if casa.id is null or casa.fixture_id <> plano.fixture_id then
    raise exception 'stay_not_found' using errcode = 'P0002';
  end if;
  if plano.created_by is distinct from caller and casa.profile_id is distinct from caller then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  update public.fixture_plan set stay_plan_id = p_stay_plan_id, updated_at = now() where id = p_plan_id;
end;
$$;

/** Fechar o plano à mão (mesmo com lugares por encher), voltar a abri-lo, ou desistir dele. Só quem convidou. */
create function public.set_fixture_plan_status(p_plan_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plano public.fixture_plan;
begin
  select * into plano from public.fixture_plan where id = p_plan_id for update;
  if plano.id is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if plano.created_by is distinct from caller then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if p_status not in ('aberto', 'fechado', 'cancelado') then
    raise exception 'bad_status' using errcode = '22023';
  end if;
  if plano.status = 'cancelado' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;
  update public.fixture_plan
  set status = p_status,
      closed_reason = case when p_status = 'fechado' then 'manual' end,
      closed_at = case when p_status = 'fechado' then now() end,
      updated_at = now()
  where id = p_plan_id;
end;
$$;

-- A boleia e a casa ligam-se sozinhas: quem está no plano põe uma boleia (ou uma casa) no grupo para aquele jogo, e
-- ela passa a ser a do plano, se o plano ainda não tiver uma.
create function public.link_ride_to_open_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.group_id is null or new.status <> 'open' then
    return null;
  end if;
  update public.fixture_plan as fp
  set ride_id = new.id, updated_at = now()
  where fp.group_id = new.group_id
    and fp.fixture_id = new.fixture_id
    and fp.status = 'aberto'
    and fp.ride_id is null
    and (
      fp.created_by = new.driver_id
      or exists (
        select 1 from public.fixture_plan_answer as a
        where a.plan_id = fp.id and a.profile_id = new.driver_id
      )
    );
  return null;
end;
$$;

create trigger ride_links_open_plan
  after insert or update of group_id on public.ride
  for each row execute function public.link_ride_to_open_plan();

create function public.link_stay_to_open_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.group_id is null then
    return null;
  end if;
  update public.fixture_plan as fp
  set stay_plan_id = new.id, updated_at = now()
  where fp.group_id = new.group_id
    and fp.fixture_id = new.fixture_id
    and fp.status = 'aberto'
    and fp.stay_plan_id is null
    and (
      fp.created_by = new.profile_id
      or exists (
        select 1 from public.fixture_plan_answer as a
        where a.plan_id = fp.id and a.profile_id = new.profile_id
      )
    );
  return null;
end;
$$;

create trigger stay_links_open_plan
  after insert or update of group_id on public.stay_plan
  for each row execute function public.link_stay_to_open_plan();

/** Os planos pedidos, com tudo o que o cartão e o ecrã do plano mostram. Só os que a pessoa pode ver. */
create function public.fixture_plan_summaries(p_plan_ids uuid[])
returns table (
  id uuid,
  group_id uuid,
  group_name text,
  fixture_id text,
  kickoff_at timestamptz,
  created_by uuid,
  creator_name text,
  is_mine boolean,
  status text,
  closed_reason text,
  going integer,
  maybe integer,
  my_answer text,
  shared_groups integer,
  ride_id uuid,
  ride_driver_id uuid,
  ride_driver_name text,
  ride_departure_at timestamptz,
  ride_seats_offered integer,
  ride_seats_taken integer,
  ride_share_now_cents integer,
  ride_visibility text,
  ride_round_trip boolean,
  ride_accepts_return boolean,
  ride_my_status text,
  stay_id uuid,
  stay_owner_id uuid,
  stay_owner_name text,
  stay_spare integer,
  stay_taken integer,
  stay_status text,
  stay_visibility text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    fp.id,
    fp.group_id,
    g.name,
    fp.fixture_id,
    f.kickoff_at,
    fp.created_by,
    quem.display_name,
    fp.created_by = auth.uid(),
    fp.status,
    fp.closed_reason,
    (select count(*)::integer from public.fixture_plan_answer as a where a.plan_id = fp.id and a.answer = 'vou'),
    (select count(*)::integer from public.fixture_plan_answer as a where a.plan_id = fp.id and a.answer = 'talvez'),
    minha.answer,
    (select count(*)::integer from public.fixture_plan_group as fg where fg.plan_id = fp.id),
    r.id,
    r.driver_id,
    condutor.display_name,
    r.departure_at,
    r.seats_offered::integer,
    lugares.n,
    case when r.id is not null then public.ride_share_cents(r.total_cents, 1 + lugares.n) end,
    r.visibility,
    r.round_trip,
    r.accepts_return_requests,
    case
      when r.driver_id = auth.uid() then 'driver'
      else (select rp.status from public.ride_passenger as rp where rp.ride_id = r.id and rp.profile_id = auth.uid())
    end,
    s.id,
    s.profile_id,
    dono.display_name,
    s.spare_places::integer,
    (select count(*)::integer from public.stay_place as sp where sp.plan_id = s.id and sp.status = 'aceite'),
    s.status,
    s.visibility
  from public.fixture_plan as fp
  join public.fixture as f on f.id = fp.fixture_id
  join public.fan_group as g on g.id = fp.group_id
  join public.profile as quem on quem.id = fp.created_by
  left join public.fixture_plan_answer as minha on minha.plan_id = fp.id and minha.profile_id = auth.uid()
  left join public.ride as r on r.id = fp.ride_id and r.status = 'open'
  left join public.profile as condutor on condutor.id = r.driver_id
  left join lateral (
    select count(*)::integer as n from public.ride_passenger as rp
    where rp.ride_id = r.id and rp.status = 'accepted'
  ) as lugares on true
  left join public.stay_plan as s on s.id = fp.stay_plan_id
  left join public.profile as dono on dono.id = s.profile_id
  where fp.id = any (p_plan_ids)
    and auth.uid() is not null
    and public.can_see_fixture_plan(fp.id, auth.uid());
$$;

/**
 * Os planos em aberto de um grupo (os que nasceram lá e os que lhe foram mandados): os abertos, e os fechados cujo
 * jogo ainda não passou. Do jogo mais próximo para a frente.
 */
create function public.group_fixture_plans(p_group_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select fp.id
  from public.fixture_plan as fp
  join public.fixture as f on f.id = fp.fixture_id
  where public.is_group_member(p_group_id, auth.uid())
    and fp.status <> 'cancelado'
    and f.kickoff_at > now() - interval '6 hours'
    and (
      fp.group_id = p_group_id
      or exists (
        select 1 from public.fixture_plan_group as fg
        where fg.plan_id = fp.id and fg.group_id = p_group_id
      )
    )
  order by f.kickoff_at;
$$;

/** Quem respondeu ao plano, e o quê. */
create function public.fixture_plan_people(p_plan_id uuid)
returns table (profile_id uuid, display_name text, answer text, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.profile_id, p.display_name, a.answer, a.profile_id = auth.uid()
  from public.fixture_plan_answer as a
  join public.profile as p on p.id = a.profile_id
  where a.plan_id = p_plan_id and public.can_see_fixture_plan(p_plan_id, auth.uid())
  order by case a.answer when 'vou' then 0 else 1 end, a.updated_at;
$$;

-- As mensagens passam a trazer o plano do cartão.
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
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc, m.id desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;

-- As respostas e o fecho mudam o cartão na conversa de quem a tem aberta: avisa os canais dos grupos do plano.
create function public.broadcast_fixture_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plano uuid := coalesce(to_jsonb(new) ->> 'plan_id', to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'plan_id', to_jsonb(old) ->> 'id')::uuid;
  grupo uuid;
begin
  for grupo in
    select fp.group_id from public.fixture_plan as fp where fp.id = plano
    union
    select fg.group_id from public.fixture_plan_group as fg where fg.plan_id = plano
  loop
    begin
      perform realtime.send(jsonb_build_object('plan_id', plano), 'plans', 'group:' || grupo::text, true);
    exception when others then
      null;
    end;
  end loop;
  return null;
end;
$$;

create trigger fixture_plan_broadcast
  after update on public.fixture_plan
  for each row execute function public.broadcast_fixture_plan();
create trigger fixture_plan_answer_broadcast
  after insert or update or delete on public.fixture_plan_answer
  for each row execute function public.broadcast_fixture_plan();

-- As boleias e as casas «só do grupo» passam a ver-se também nos grupos a quem o plano foi mandado. As funções
-- são as que estão em produção, com uma única mudança: a condição «é do grupo» passa a ser `can_see_private_*`.

CREATE OR REPLACE FUNCTION public.ride_board(p_fixture_id text)
 RETURNS TABLE(id uuid, is_mine boolean, driver_id uuid, driver_name text, driver_completed integer, driver_faults integer, origin_name text, origin_city text, origin_latitude double precision, origin_longitude double precision, departure_at timestamp with time zone, requests_close_at timestamp with time zone, seats_offered smallint, seats_taken integer, route_option text, round_trip boolean, accepts_return_requests boolean, distance_m integer, duration_s integer, toll_m integer, fuel_cents integer, toll_cents integer, total_cents integer, share_now_cents integer, share_full_cents integer, note text, status text, my_status text, parking_name text, parking_latitude double precision, parking_longitude double precision, parking_distance_m integer, group_id uuid, group_name text, visibility text, driver_is_friend boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    r.id,
    r.driver_id = auth.uid(),
    r.driver_id,
    p.display_name,
    rep.completed,
    rep.faults,
    r.origin_name,
    r.origin_city,
    extensions.st_y(r.origin::extensions.geometry),
    extensions.st_x(r.origin::extensions.geometry),
    r.departure_at,
    public.ride_requests_close_at(r.departure_at),
    r.seats_offered,
    taken.n,
    r.route_option,
    r.round_trip,
    r.accepts_return_requests,
    r.distance_m,
    r.duration_s,
    r.toll_m,
    r.fuel_cents,
    r.toll_cents,
    r.total_cents,
    public.ride_share_cents(r.total_cents, 1 + taken.n),
    public.ride_share_cents(r.total_cents, 1 + r.seats_offered),
    r.note,
    r.status,
    mine.status,
    ps.name,
    ps.latitude,
    ps.longitude,
    ps.distance_m,
    case when sou_do_grupo.sim then r.group_id end,
    case when sou_do_grupo.sim then g.name end,
    r.visibility,
    public.are_friends(r.driver_id, auth.uid())
  from public.ride as r
  join public.profile as p on p.id = r.driver_id
  cross join lateral public.ride_reputation(array[r.driver_id]) as rep
  cross join lateral (
    select count(*)::integer as n
    from public.ride_passenger as rp
    where rp.ride_id = r.id and rp.status = 'accepted'
  ) as taken
  cross join lateral (
    select public.can_see_private_ride(r.id, r.group_id, auth.uid()) as sim
  ) as sou_do_grupo
  left join public.ride_passenger as mine on mine.ride_id = r.id and mine.profile_id = auth.uid()
  left join public.parking_spot as ps on ps.id = r.parking_spot_id
  left join public.fan_group as g on g.id = r.group_id
  where auth.uid() is not null
    and r.fixture_id = p_fixture_id
    and (r.status = 'open' or r.driver_id = auth.uid() or mine.profile_id is not null)
    and (
      r.visibility = 'publica'
      or r.driver_id = auth.uid()
      or mine.profile_id is not null
      or sou_do_grupo.sim
    )
  -- As boleias de amigos primeiro: é com quem se vai de boa vontade.
  order by public.are_friends(r.driver_id, auth.uid()) desc, r.departure_at, r.created_at;
$function$;

CREATE OR REPLACE FUNCTION public.ride_return_board(p_fixture_id text)
 RETURNS TABLE(ride_id uuid, driver_name text, driver_completed integer, driver_faults integer, seats_left integer, price_cents integer, parking_name text, parking_latitude double precision, parking_longitude double precision, origin_name text, origin_city text, my_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    r.id,
    p.display_name,
    rep.completed,
    rep.faults,
    (r.seats_offered - taken.n - back.n)::integer,
    public.ride_return_share_cents(r.total_cents, 1 + taken.n + back.n + 1),
    ps.name,
    ps.latitude,
    ps.longitude,
    r.origin_name,
    r.origin_city,
    mine.status
  from public.ride as r
  join public.profile as p on p.id = r.driver_id
  join public.fixture as f on f.id = r.fixture_id
  cross join lateral public.ride_reputation(array[r.driver_id]) as rep
  cross join lateral (
    select count(*)::integer as n from public.ride_passenger as rp
    where rp.ride_id = r.id and rp.status = 'accepted'
  ) as taken
  cross join lateral (
    select count(*)::integer as n from public.ride_return_request as rr
    where rr.ride_id = r.id and rr.status = 'accepted'
  ) as back
  left join public.parking_spot as ps on ps.id = r.parking_spot_id
  left join public.ride_return_request as mine on mine.ride_id = r.id and mine.profile_id = auth.uid()
  where auth.uid() is not null
    and r.fixture_id = p_fixture_id
    and r.status = 'open'
    and r.round_trip
    and r.accepts_return_requests
    and r.driver_id <> auth.uid()
    and (
      r.visibility = 'publica'
      or public.can_see_private_ride(r.id, r.group_id, auth.uid())
    )
    and now() between public.ride_return_opens_at(f.kickoff_at) and public.ride_return_closes_at(f.kickoff_at)
    and (r.seats_offered - taken.n - back.n) > 0
  order by coalesce(r.origin_city, 'zzz'), (r.seats_offered - taken.n - back.n) desc, p.display_name;
$function$;

CREATE OR REPLACE FUNCTION public.request_ride_seat(p_ride_id uuid, p_accept_rules boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller uuid := auth.uid();
  target public.ride;
  taken integer;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_accept_rules is not true then
    raise exception 'rules_not_accepted' using errcode = '22023';
  end if;
  if public.ride_ban_until(caller) is not null then
    raise exception 'suspended' using errcode = '22023';
  end if;
  select * into target from public.ride where id = p_ride_id for update;
  if target.id is null then
    raise exception 'ride_not_found' using errcode = 'P0002';
  end if;
  if target.visibility = 'grupo'
    and not public.can_see_private_ride(target.id, target.group_id, caller) then
    raise exception 'ride_not_found' using errcode = 'P0002';
  end if;
  if target.driver_id = caller then
    raise exception 'own_ride' using errcode = '22023';
  end if;
  if target.status <> 'open' or now() >= public.ride_requests_close_at(target.departure_at) then
    raise exception 'ride_closed' using errcode = '22023';
  end if;
  select count(*) into taken from public.ride_passenger where ride_id = p_ride_id and status = 'accepted';
  if taken >= target.seats_offered then
    raise exception 'ride_full' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'ride-request', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  insert into public.ride_passenger (ride_id, profile_id, status, rules_accepted_at)
  values (p_ride_id, caller, 'requested', now())
  on conflict (ride_id, profile_id) do update
    set status = 'requested', rules_accepted_at = now(), left_at = null
    where public.ride_passenger.status in ('declined', 'left', 'expired');
end;
$function$;

CREATE OR REPLACE FUNCTION public.fixture_stay_plans(p_fixture_id text)
 RETURNS TABLE(id uuid, display_name text, member_since date, rides_completed integer, rides_faults integer, total_cents integer, nights smallint, commitment text, spare_places smallint, taken integer, share_now_cents integer, share_full_cents integer, listing_url text, listing_seen_on date, status text, note text, updated_on date, is_mine boolean, my_status text, pending integer, group_id uuid, group_name text, visibility text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    s.id,
    p.display_name,
    p.created_at::date,
    rep.completed,
    rep.faults,
    s.total_cents,
    s.nights,
    s.commitment,
    s.spare_places,
    ocupados.n,
    public.stay_share_cents(s.total_cents, 1 + ocupados.n),
    public.stay_share_cents(s.total_cents, 1 + s.spare_places),
    s.listing_url,
    s.listing_seen_on,
    s.status,
    s.note,
    s.updated_at::date,
    s.profile_id = auth.uid(),
    meu.status,
    case when s.profile_id = auth.uid() then pedidos.n else 0 end,
    case when sou_do_grupo.sim then s.group_id end,
    case when sou_do_grupo.sim then g.name end,
    s.visibility
  from public.stay_plan as s
  join public.profile as p on p.id = s.profile_id
  cross join lateral public.ride_reputation(array[s.profile_id]) as rep
  cross join lateral (
    select count(*)::integer as n from public.stay_place as sp
    where sp.plan_id = s.id and sp.status = 'aceite'
  ) as ocupados
  cross join lateral (
    select count(*)::integer as n from public.stay_place as sp
    where sp.plan_id = s.id and sp.status = 'pedido'
  ) as pedidos
  cross join lateral (
    select public.can_see_private_stay(s.id, s.group_id, auth.uid()) as sim
  ) as sou_do_grupo
  left join public.stay_place as meu on meu.plan_id = s.id and meu.profile_id = auth.uid()
  left join public.fan_group as g on g.id = s.group_id
  where s.fixture_id = p_fixture_id
    and auth.uid() is not null
    and (
      s.visibility = 'publica'
      or s.profile_id = auth.uid()
      or meu.profile_id is not null
      or sou_do_grupo.sim
    )
  order by
    case when s.status = 'reservada' then 1 else 0 end,
    s.updated_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.request_stay_place(p_plan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller uuid := auth.uid();
  casa public.stay_plan;
  ocupados integer;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.can_share_house(caller) then
    raise exception 'needs_history' using errcode = '22023';
  end if;
  select * into casa from public.stay_plan where id = p_plan_id for update;
  if casa.id is null then
    raise exception 'house_not_found' using errcode = 'P0002';
  end if;
  if casa.visibility = 'grupo'
    and not public.can_see_private_stay(casa.id, casa.group_id, caller) then
    raise exception 'house_not_found' using errcode = 'P0002';
  end if;
  if casa.profile_id = caller then
    raise exception 'own_house' using errcode = '22023';
  end if;
  if casa.status = 'reservada' then
    raise exception 'house_full' using errcode = '22023';
  end if;
  select count(*) into ocupados from public.stay_place
  where plan_id = p_plan_id and status = 'aceite';
  if ocupados >= casa.spare_places then
    raise exception 'house_full' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'stay-place', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.stay_place (plan_id, profile_id, status)
  values (p_plan_id, caller, 'pedido')
  on conflict (plan_id, profile_id) do update
    set status = 'pedido'
    where public.stay_place.status in ('recusado', 'saiu');
end;
$function$;

revoke execute on function public.can_see_fixture_plan(uuid, uuid) from public, anon;
revoke execute on function public.can_see_private_ride(uuid, uuid, uuid) from public, anon;
revoke execute on function public.can_see_private_stay(uuid, uuid, uuid) from public, anon;
revoke execute on function public.fixture_short_title(text) from public, anon;
revoke execute on function public.post_plan_message(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.invite_group_to_fixture(uuid, text) from public, anon;
revoke execute on function public.share_fixture_plan(uuid, uuid) from public, anon;
revoke execute on function public.answer_fixture_plan(uuid, text) from public, anon;
revoke execute on function public.close_plans_with_full_ride(uuid) from public, anon, authenticated;
revoke execute on function public.close_plans_after_passenger_change() from public, anon, authenticated;
revoke execute on function public.set_fixture_plan_ride(uuid, uuid) from public, anon;
revoke execute on function public.set_fixture_plan_stay(uuid, uuid) from public, anon;
revoke execute on function public.set_fixture_plan_status(uuid, text) from public, anon;
revoke execute on function public.link_ride_to_open_plan() from public, anon, authenticated;
revoke execute on function public.link_stay_to_open_plan() from public, anon, authenticated;
revoke execute on function public.fixture_plan_summaries(uuid[]) from public, anon;
revoke execute on function public.group_fixture_plans(uuid) from public, anon;
revoke execute on function public.fixture_plan_people(uuid) from public, anon;
revoke execute on function public.group_messages(uuid, timestamptz, integer) from public, anon;
revoke execute on function public.broadcast_fixture_plan() from public, anon, authenticated;
grant execute on function public.can_see_fixture_plan(uuid, uuid) to authenticated;
grant execute on function public.can_see_private_ride(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_see_private_stay(uuid, uuid, uuid) to authenticated;
grant execute on function public.fixture_short_title(text) to authenticated;
grant execute on function public.invite_group_to_fixture(uuid, text) to authenticated;
grant execute on function public.share_fixture_plan(uuid, uuid) to authenticated;
grant execute on function public.answer_fixture_plan(uuid, text) to authenticated;
grant execute on function public.set_fixture_plan_ride(uuid, uuid) to authenticated;
grant execute on function public.set_fixture_plan_stay(uuid, uuid) to authenticated;
grant execute on function public.set_fixture_plan_status(uuid, text) to authenticated;
grant execute on function public.fixture_plan_summaries(uuid[]) to authenticated;
grant execute on function public.group_fixture_plans(uuid) to authenticated;
grant execute on function public.fixture_plan_people(uuid) to authenticated;
grant execute on function public.group_messages(uuid, timestamptz, integer) to authenticated;
