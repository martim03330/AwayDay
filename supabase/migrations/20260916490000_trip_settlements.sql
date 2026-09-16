-- O dinheiro que já mudou de mãos.
--
-- Até agora as contas só sabiam o que se gastou. Mas a meio da viagem há sempre quem mande um MB Way — «toma lá os
-- 10 € do jantar» — e essas contas ficavam a dizer que essa pessoa ainda devia tudo. Passa a haver **pagamentos**:
-- quem pagou a quem, e quanto. Entram nos saldos como dinheiro que já se moveu, e o «quem paga a quem» encolhe.
--
-- Quem regista:
--   - **Quem recebeu** («já recebi») — fica confirmado na hora, que quem recebe sabe bem se recebeu.
--   - **Quem pagou** («já paguei») — fica **por confirmar** até o outro dizer que recebeu. Conta à mesma nos saldos:
--     a alternativa era a app dizer a alguém que ainda deve o que já pagou. Mas é visível que falta a confirmação.
--
-- Qualquer uma das duas pessoas pode apagar um pagamento — quem se enganou a lançar, e quem nunca o recebeu.
--
-- A app continua a não mover dinheiro nenhum: isto é um registo do que as pessoas fizeram entre elas.

create table public.trip_settlement (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.trip_session (id) on delete cascade,
  from_profile_id uuid not null references public.profile (id) on delete cascade,
  to_profile_id uuid not null references public.profile (id) on delete cascade,
  cents integer not null check (cents between 1 and 1000000),
  created_by uuid references public.profile (id) on delete set null,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_settlement_two_people check (from_profile_id <> to_profile_id)
);

create index trip_settlement_session_idx on public.trip_settlement (session_id);

create trigger trip_settlement_set_updated_at
  before update on public.trip_settlement
  for each row execute function public.set_updated_at();

alter table public.trip_settlement enable row level security;
revoke all on public.trip_settlement from anon, authenticated;

-- Registar um pagamento. Só entre pessoas destas contas, e só por quem esteve nele.
create function public.add_trip_settlement(
  p_session_id uuid,
  p_to_profile_id uuid,
  p_cents integer,
  p_from_profile_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  de uuid;
  novo uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.is_trip_member(p_session_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;

  de := coalesce(p_from_profile_id, caller);
  if de <> caller and p_to_profile_id <> caller then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  if de = p_to_profile_id then
    raise exception 'bad_settlement' using errcode = '22023';
  end if;
  -- Quem saiu do grupo continua nas contas, por isso vale quem lá está e quem aparece nas despesas.
  if not exists (select 1 from public.trip_balances(p_session_id) as b where b.profile_id = de)
     or not exists (
       select 1 from public.trip_balances(p_session_id) as b where b.profile_id = p_to_profile_id
     ) then
    raise exception 'not_in_trip' using errcode = '22023';
  end if;
  if p_cents is null or p_cents < 1 or p_cents > 1000000 then
    raise exception 'bad_settlement' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'trip-settlement', 40, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.trip_settlement (
    session_id, from_profile_id, to_profile_id, cents, created_by, confirmed_at, confirmed_by
  )
  values (
    p_session_id, de, p_to_profile_id, p_cents, caller,
    case when caller = p_to_profile_id then now() end,
    case when caller = p_to_profile_id then caller end
  )
  returning id into novo;

  return novo;
end;
$$;

-- Confirmar que se recebeu. Só quem recebeu.
create function public.confirm_trip_settlement(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.trip_settlement
  set confirmed_at = now(), confirmed_by = auth.uid()
  where id = p_settlement_id and to_profile_id = auth.uid() and confirmed_at is null;
  if not found then
    raise exception 'not_yours' using errcode = '42501';
  end if;
end;
$$;

-- Apagar um pagamento: quem o lançou ou quem estava do outro lado.
create function public.remove_trip_settlement(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.trip_settlement
  where id = p_settlement_id
    and (from_profile_id = auth.uid() or to_profile_id = auth.uid() or created_by = auth.uid());
  if not found then
    raise exception 'not_yours' using errcode = '42501';
  end if;
end;
$$;

create function public.trip_settlements(p_session_id uuid)
returns table (
  id uuid,
  from_profile_id uuid,
  from_name text,
  to_profile_id uuid,
  to_name text,
  cents integer,
  confirmed boolean,
  i_receive boolean,
  mine boolean,
  created_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.from_profile_id,
    de.display_name,
    t.to_profile_id,
    para.display_name,
    t.cents,
    t.confirmed_at is not null,
    t.to_profile_id = auth.uid(),
    t.from_profile_id = auth.uid() or t.to_profile_id = auth.uid() or t.created_by = auth.uid(),
    t.created_at::date
  from public.trip_settlement as t
  join public.profile as de on de.id = t.from_profile_id
  join public.profile as para on para.id = t.to_profile_id
  where t.session_id = p_session_id and public.is_trip_member(p_session_id, auth.uid())
  order by t.created_at desc;
$$;

-- Os saldos passam a contar o dinheiro que já mudou de mãos (o tipo de retorno muda: sai e entra).
drop function public.trip_balances(uuid);

create function public.trip_balances(p_session_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  paid_cents integer,
  owed_cents integer,
  /** Já entregue a outros menos já recebido deles. */
  settled_cents integer,
  balance_cents integer,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with permissao as (
    select s.id
    from public.trip_session as s
    where s.id = p_session_id and public.is_trip_member(s.id, auth.uid())
  ),
  envolvidos as (
    select pessoa.profile_id
    from permissao
    cross join lateral public.trip_session_people(permissao.id) as pessoa
    union
    select e.payer_id
    from public.trip_expense as e
    join permissao as p on p.id = e.session_id
    union
    select sh.profile_id
    from public.trip_expense_share as sh
    join public.trip_expense as e on e.id = sh.expense_id
    join permissao as p on p.id = e.session_id
    union
    select t.from_profile_id
    from public.trip_settlement as t
    join permissao as p on p.id = t.session_id
    union
    select t.to_profile_id
    from public.trip_settlement as t
    join permissao as p on p.id = t.session_id
  ),
  partes as (
    select
      sh.profile_id,
      e.cents / contagem.n
        + case when row_number() over (partition by e.id order by sh.profile_id) <= e.cents % contagem.n
            then 1 else 0 end as parte
    from public.trip_expense as e
    join permissao as p on p.id = e.session_id
    join public.trip_expense_share as sh on sh.expense_id = e.id
    cross join lateral (
      select count(*)::integer as n from public.trip_expense_share as x where x.expense_id = e.id
    ) as contagem
  ),
  pagou as (
    select e.payer_id as profile_id, sum(e.cents)::integer as total
    from public.trip_expense as e
    join permissao as p on p.id = e.session_id
    group by e.payer_id
  ),
  deve as (
    select p.profile_id, sum(p.parte)::integer as total
    from partes as p
    group by p.profile_id
  ),
  movimentos as (
    select t.from_profile_id as profile_id, t.cents as valor
    from public.trip_settlement as t
    join permissao as p on p.id = t.session_id
    union all
    select t.to_profile_id, -t.cents
    from public.trip_settlement as t
    join permissao as p on p.id = t.session_id
  ),
  entregou as (
    select m.profile_id, sum(m.valor)::integer as total
    from movimentos as m
    group by m.profile_id
  )
  select
    quem.profile_id,
    pr.display_name,
    coalesce(pagou.total, 0),
    coalesce(deve.total, 0),
    coalesce(entregou.total, 0),
    coalesce(pagou.total, 0) - coalesce(deve.total, 0) + coalesce(entregou.total, 0),
    quem.profile_id = auth.uid()
  from envolvidos as quem
  join public.profile as pr on pr.id = quem.profile_id
  left join pagou on pagou.profile_id = quem.profile_id
  left join deve on deve.profile_id = quem.profile_id
  left join entregou on entregou.profile_id = quem.profile_id
  order by
    (coalesce(pagou.total, 0) - coalesce(deve.total, 0) + coalesce(entregou.total, 0)) desc,
    pr.display_name;
$$;

revoke execute on function public.trip_balances(uuid) from public, anon;
revoke execute on function public.add_trip_settlement(uuid, uuid, integer, uuid) from public, anon;
revoke execute on function public.confirm_trip_settlement(uuid) from public, anon;
revoke execute on function public.remove_trip_settlement(uuid) from public, anon;
revoke execute on function public.trip_settlements(uuid) from public, anon;
grant execute on function public.trip_balances(uuid) to authenticated;
grant execute on function public.add_trip_settlement(uuid, uuid, integer, uuid) to authenticated;
grant execute on function public.confirm_trip_settlement(uuid) to authenticated;
grant execute on function public.remove_trip_settlement(uuid) to authenticated;
grant execute on function public.trip_settlements(uuid) to authenticated;
