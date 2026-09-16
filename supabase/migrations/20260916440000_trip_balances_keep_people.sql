-- Quem saiu do grupo não desaparece das contas.
--
-- Os saldos eram feitos a partir de quem está no grupo *agora*. Se alguém pagasse o jantar e saísse do grupo a
-- seguir, o dinheiro que pôs saía das contas com ele: os saldos deixavam de somar zero e a app ficava sem saber
-- quem paga a quem. Passa a entrar nas contas toda a gente que aparece nas despesas — quem pagou e quem entrou —
-- mesmo que já não esteja no grupo. As dívidas de uma viagem não se apagam por alguém sair de um grupo.
--
-- Quem vê continua a ser só quem é do grupo.

create or replace function public.trip_balances(p_session_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  paid_cents integer,
  owed_cents integer,
  balance_cents integer,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with permissao as (
    select s.id, s.group_id
    from public.trip_session as s
    where s.id = p_session_id and public.is_group_member(s.group_id, auth.uid())
  ),
  envolvidos as (
    select m.profile_id
    from public.fan_group_member as m
    join permissao as p on p.group_id = m.group_id
    union
    select e.payer_id
    from public.trip_expense as e
    join permissao as p on p.id = e.session_id
    union
    select sh.profile_id
    from public.trip_expense_share as sh
    join public.trip_expense as e on e.id = sh.expense_id
    join permissao as p on p.id = e.session_id
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
  )
  select
    quem.profile_id,
    pr.display_name,
    coalesce(pagou.total, 0),
    coalesce(deve.total, 0),
    coalesce(pagou.total, 0) - coalesce(deve.total, 0),
    quem.profile_id = auth.uid()
  from envolvidos as quem
  join public.profile as pr on pr.id = quem.profile_id
  left join pagou on pagou.profile_id = quem.profile_id
  left join deve on deve.profile_id = quem.profile_id
  order by (coalesce(pagou.total, 0) - coalesce(deve.total, 0)) desc, pr.display_name;
$$;
