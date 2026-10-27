-- The fair leftover cents (20261027150000) moved cents in expenses already shared and settled: a payment confirmed
-- with the old split (35,34 €) left a ghost debt of 0,01 € once the split changed (seen in the test session the same
-- day). Expenses created before the change keep the old order (by person id, which is what the uuid order gives in
-- text with the C collation); only expenses from 2026-10-27 14:00 UTC on rotate the leftover cents. No expense had
-- been created after that moment when this was written, so no balance moves.

create or replace function public.trip_balances(p_session_id uuid)
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
        + case when row_number() over (
              partition by e.id
              order by
                case
                  when e.created_at < timestamptz '2026-10-27 14:00:00+00' then sh.profile_id::text
                  else pg_catalog.md5(e.id::text || sh.profile_id::text)
                end collate "C",
                sh.profile_id
            ) <= e.cents % contagem.n
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
grant execute on function public.trip_balances(uuid) to authenticated;
