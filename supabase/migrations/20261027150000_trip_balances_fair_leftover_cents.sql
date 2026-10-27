-- The leftover cents of a split expense stop always landing on the same person.
--
-- Until now trip_balances gave the cents that do not divide evenly to the first people by profile_id, the same order
-- for every expense: in a test trip the ride's extra cent and the beers' extra cent both went to the same friend.
-- Now each expense orders its people by md5(expense id || profile id): fixed for that expense (the balances never
-- change on their own, and deleting another expense does not move anyone's cent), but different from one expense to
-- the next, so over a trip the extra cents spread out. `collate "C"` compares the hex digests byte by byte, so the
-- order does not depend on the database's locale; profile_id breaks a (practically impossible) tie. Totals stay
-- exact: each expense still hands out exactly `cents % n` extra cents.
--
-- The app's mirror is dividirCentimos / ordemDosCentimosQueSobram in src/lib/acerto.ts (with src/lib/md5.ts).
-- Only the ordering inside `partes` changes; the rest is the latest definition (20260916490000_trip_settlements.sql).

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
              order by pg_catalog.md5(e.id::text || sh.profile_id::text) collate "C", sh.profile_id
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
