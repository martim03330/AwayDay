-- Dividir a casa como se divide a boleia.
--
-- Quem já tem casa passa a pôr o **custo total** dela, não um preço por cabeça inventado. O que cada um paga é
-- calculado aqui: o total a dividir por quem lá dorme (o dono incluído), arredondado para cima ao cêntimo — a mesma
-- regra da boleia, por isso o dono nunca paga menos do que a sua parte e os cêntimos a mais são dele.
--
-- E, como na boleia, entrar numa casa é a dono decidir: pede-se lugar, o dono aceita ou recusa, e a cada pessoa que
-- entra o preço de todos desce.

alter table public.stay_plan
  add column total_cents integer check (total_cents between 1000 and 1000000),
  alter column cents_per_person drop not null;

-- Quem já tinha dito que tem casa escreveu quanto ficava a cada um, por noite. O total da casa é o que isso queria
-- dizer: esse valor vezes toda a gente que lá dorme, vezes as noites. Nada se perde e nada se inventa.
update public.stay_plan
set total_cents = least(1000000, greatest(1000, cents_per_person * (spare_places + 1) * nights)),
    cents_per_person = null
where kind = 'tem_casa' and total_cents is null;

alter table public.stay_plan
  drop constraint stay_plan_shape,
  add constraint stay_plan_shape check (
    (
      kind = 'procura'
      and cents_per_person is not null
      and commitment is not null
      and spare_places is null
      and total_cents is null
    )
    or (
      kind = 'tem_casa'
      and total_cents is not null
      and spare_places is not null
      and commitment is null
      and cents_per_person is null
    )
  );

-- O que cada um paga: o total a dividir por toda a gente que lá dorme, arredondado para cima ao cêntimo.
create function public.stay_share_cents(p_total_cents integer, p_people integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (p_total_cents + greatest(p_people, 1) - 1) / greatest(p_people, 1);
$$;

create table public.stay_place (
  plan_id uuid not null references public.stay_plan (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  status text not null default 'pedido' check (status in ('pedido', 'aceite', 'recusado', 'saiu')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, profile_id)
);

create index stay_place_profile_idx on public.stay_place (profile_id);

create trigger stay_place_set_updated_at
  before update on public.stay_place
  for each row execute function public.set_updated_at();

alter table public.stay_place enable row level security;
revoke all on public.stay_place from anon, authenticated;

-- Quantos dormem na casa neste momento: o dono e quem já foi aceite.
create function public.stay_people_count(p_plan_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select 1 + (
    select count(*)::integer from public.stay_place as sp
    where sp.plan_id = p_plan_id and sp.status = 'aceite'
  );
$$;

create function public.request_stay_place(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  casa public.stay_plan;
  ocupados integer;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select * into casa from public.stay_plan where id = p_plan_id for update;
  if casa.id is null or casa.kind <> 'tem_casa' then
    raise exception 'house_not_found' using errcode = 'P0002';
  end if;
  if casa.profile_id = caller then
    raise exception 'own_house' using errcode = '22023';
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
$$;

create function public.answer_stay_place(p_plan_id uuid, p_profile_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  casa public.stay_plan;
  ocupados integer;
begin
  select * into casa from public.stay_plan where id = p_plan_id for update;
  if casa.id is null or casa.profile_id is distinct from auth.uid() then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if p_accept then
    select count(*) into ocupados from public.stay_place
    where plan_id = p_plan_id and status = 'aceite';
    if ocupados >= casa.spare_places then
      raise exception 'house_full' using errcode = '22023';
    end if;
  end if;

  update public.stay_place
  set status = case when p_accept then 'aceite' else 'recusado' end
  where plan_id = p_plan_id and profile_id = p_profile_id and status = 'pedido';
  if not found then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Sair da casa (ou retirar o pedido). O preço de quem fica sobe, e é por isso que se diz a tempo.
create function public.leave_stay_place(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  update public.stay_place
  set status = 'saiu'
  where plan_id = p_plan_id and profile_id = auth.uid() and status in ('pedido', 'aceite');
  if not found then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Quem está a tratar de cama para este jogo, com as contas da casa já feitas.
drop function if exists public.fixture_stay_plans(text);

create function public.fixture_stay_plans(p_fixture_id text)
returns table (
  id uuid,
  display_name text,
  kind text,
  cents_per_person integer,
  total_cents integer,
  nights smallint,
  commitment text,
  spare_places smallint,
  taken integer,
  share_now_cents integer,
  share_full_cents integer,
  note text,
  updated_on date,
  is_mine boolean,
  my_status text,
  pending integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    p.display_name,
    s.kind,
    s.cents_per_person,
    s.total_cents,
    s.nights,
    s.commitment,
    s.spare_places,
    ocupados.n,
    case when s.kind = 'tem_casa' then public.stay_share_cents(s.total_cents, 1 + ocupados.n) end,
    case when s.kind = 'tem_casa'
      then public.stay_share_cents(s.total_cents, 1 + s.spare_places) end,
    s.note,
    s.updated_at::date,
    s.profile_id = auth.uid(),
    meu.status,
    case when s.profile_id = auth.uid() then pedidos.n else 0 end
  from public.stay_plan as s
  join public.profile as p on p.id = s.profile_id
  cross join lateral (
    select count(*)::integer as n from public.stay_place as sp
    where sp.plan_id = s.id and sp.status = 'aceite'
  ) as ocupados
  cross join lateral (
    select count(*)::integer as n from public.stay_place as sp
    where sp.plan_id = s.id and sp.status = 'pedido'
  ) as pedidos
  left join public.stay_place as meu on meu.plan_id = s.id and meu.profile_id = auth.uid()
  where s.fixture_id = p_fixture_id and auth.uid() is not null
  order by
    case when s.kind = 'tem_casa' then 0 else 1 end,
    case when s.commitment = 'certo' then 0 else 1 end,
    s.updated_at desc;
$$;

-- Quem pediu lugar numa casa. O dono vê toda a gente; quem pediu vê-se a si próprio.
create function public.stay_place_people(p_plan_id uuid)
returns table (profile_id uuid, display_name text, status text, is_mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select sp.profile_id, p.display_name, sp.status, sp.profile_id = auth.uid()
  from public.stay_place as sp
  join public.profile as p on p.id = sp.profile_id
  join public.stay_plan as s on s.id = sp.plan_id
  where sp.plan_id = p_plan_id
    and auth.uid() is not null
    and (s.profile_id = auth.uid() or sp.profile_id = auth.uid())
    and sp.status in ('pedido', 'aceite')
  order by sp.created_at;
$$;

-- A casa entra com o custo total; quem procura continua a dizer o que está disposto a pagar por pessoa.
create or replace function public.set_stay_plan(
  p_fixture_id text,
  p_kind text,
  p_cents_per_person integer,
  p_nights smallint,
  p_commitment text default null,
  p_spare_places smallint default null,
  p_note text default null,
  p_total_cents integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  kickoff timestamptz;
  nota text := nullif(btrim(coalesce(p_note, '')), '');
  procura boolean := p_kind = 'procura';
  orcamento integer := case when procura then p_cents_per_person end;
  compromisso text := case when procura then p_commitment end;
  lugares smallint := case when not procura then p_spare_places end;
  total integer := case when not procura then p_total_cents end;
  novo uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.fixture_needs_stay(p_fixture_id) then
    raise exception 'stay_not_needed' using errcode = '22023';
  end if;
  if p_kind not in ('procura', 'tem_casa')
    or p_nights is null or p_nights < 1 or p_nights > 14
    or (procura and (orcamento is null or orcamento < 300 or orcamento > 50000))
    or (procura and (compromisso is null or compromisso not in ('certo', 'se_houver')))
    or (not procura and (total is null or total < 1000 or total > 1000000))
    or (not procura and (lugares is null or lugares < 1 or lugares > 10)) then
    raise exception 'bad_stay' using errcode = '22023';
  end if;
  if nota is not null and char_length(nota) > 200 then
    raise exception 'bad_stay' using errcode = '22023';
  end if;

  select f.kickoff_at into kickoff from public.fixture as f where f.id = p_fixture_id;
  if now() < kickoff - interval '180 days' or now() > kickoff + interval '1 day' then
    raise exception 'outside_window' using errcode = '22023';
  end if;

  if not public.take_rate_limit(caller, 'stay-plan', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.stay_plan (
    fixture_id, profile_id, kind, cents_per_person, total_cents, nights, commitment, spare_places, note
  )
  values (p_fixture_id, caller, p_kind, orcamento, total, p_nights, compromisso, lugares, nota)
  on conflict (fixture_id, profile_id) do update
    set kind = excluded.kind,
        cents_per_person = excluded.cents_per_person,
        total_cents = excluded.total_cents,
        nights = excluded.nights,
        commitment = excluded.commitment,
        spare_places = excluded.spare_places,
        note = excluded.note
  returning id into novo;

  -- Deixar de ter casa não deixa ninguém pendurado sem saber: os lugares dados caem.
  if procura then
    delete from public.stay_place where plan_id = novo;
  end if;

  return novo;
end;
$$;

revoke execute on function public.set_stay_plan(text, text, integer, smallint, text, smallint, text, integer)
  from public, anon;
revoke execute on function public.request_stay_place(uuid) from public, anon;
revoke execute on function public.answer_stay_place(uuid, uuid, boolean) from public, anon;
revoke execute on function public.leave_stay_place(uuid) from public, anon;
revoke execute on function public.fixture_stay_plans(text) from public, anon;
revoke execute on function public.stay_place_people(uuid) from public, anon;
revoke execute on function public.stay_people_count(uuid) from public, anon, authenticated;
grant execute on function public.set_stay_plan(text, text, integer, smallint, text, smallint, text, integer)
  to authenticated;
grant execute on function public.request_stay_place(uuid) to authenticated;
grant execute on function public.answer_stay_place(uuid, uuid, boolean) to authenticated;
grant execute on function public.leave_stay_place(uuid) to authenticated;
grant execute on function public.fixture_stay_plans(text) to authenticated;
grant execute on function public.stay_place_people(uuid) to authenticated;
