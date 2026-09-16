-- A sessão passa a ter gente própria.
--
-- Estava mal pensado por mim: as contas eram «do grupo» ou «da boleia», e quem tivesse as duas coisas para o mesmo
-- jogo via duas contas separadas, sem saber para qual olhar. Mas quem paga o jantar não é um grupo nem um carro: é
-- **a malta que foi àquela viagem** — alguns do grupo, alguns do carro, e às vezes um amigo que apareceu lá.
--
-- Por isso a sessão passa a ter a **sua própria lista de pessoas** (`trip_session_member`). O grupo e a boleia
-- deixam de ser donos das contas e passam a ser só a origem: servem para a lista já vir preenchida quando se abre, e
-- a boleia continua a trazer a despesa dela. A partir daí, acrescenta-se ou tira-se gente à mão.
--
-- Quem já tem contas lançadas não se tira da lista — isso apagava dinheiro de pessoas reais. Primeiro apagam-se as
-- despesas dessa pessoa; só depois é que ela sai.

create table public.trip_session_member (
  session_id uuid not null references public.trip_session (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  added_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (session_id, profile_id)
);

create index trip_session_member_profile_idx on public.trip_session_member (profile_id);

alter table public.trip_session enable row level security;
alter table public.trip_session_member enable row level security;
revoke all on public.trip_session_member from anon, authenticated;

-- Um nome para as contas, que já não são «as do grupo» nem «as da boleia».
alter table public.trip_session
  add column name text check (char_length(btrim(name)) between 2 and 60);

-- As contas passam a poder existir sem grupo e sem boleia: a origem é opcional.
alter table public.trip_session drop constraint trip_session_owner;
alter table public.trip_session
  add constraint trip_session_owner check (num_nonnulls(group_id, ride_id) <= 1);

-- Quem já estava nas contas fica lá: a lista nasce com as pessoas que a regra antiga calculava.
insert into public.trip_session_member (session_id, profile_id, added_by)
select s.id, m.profile_id, s.opened_by
from public.trip_session as s
join public.fan_group_member as m on m.group_id = s.group_id
on conflict do nothing;

insert into public.trip_session_member (session_id, profile_id, added_by)
select s.id, r.driver_id, s.opened_by
from public.trip_session as s
join public.ride as r on r.id = s.ride_id
on conflict do nothing;

insert into public.trip_session_member (session_id, profile_id, added_by)
select s.id, rp.profile_id, s.opened_by
from public.trip_session as s
join public.ride_passenger as rp on rp.ride_id = s.ride_id and rp.status = 'accepted'
on conflict do nothing;

-- Quem lançou ou pagou alguma coisa também entra, mesmo que já tenha saído do grupo ou do carro.
insert into public.trip_session_member (session_id, profile_id, added_by)
select distinct e.session_id, e.payer_id, e.created_by
from public.trip_expense as e
on conflict do nothing;

insert into public.trip_session_member (session_id, profile_id, added_by)
select distinct e.session_id, sh.profile_id, e.created_by
from public.trip_expense as e
join public.trip_expense_share as sh on sh.expense_id = e.id
on conflict do nothing;

/** Quem entra nestas contas. Agora é uma lista a sério, não uma conta a partir do grupo ou do carro. */
create or replace function public.trip_session_people(p_session_id uuid)
returns table (profile_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select m.profile_id
  from public.trip_session_member as m
  where m.session_id = p_session_id;
$$;

/** Quem pode entrar nestas contas e ainda não está: amigos, malta dos meus grupos e quem vai no carro. */
create function public.trip_people_to_add(p_session_id uuid)
returns table (profile_id uuid, display_name text, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  with candidatos as (
    select f.profile_id, 'amigo' as reason
    from public.my_friends() as f
    union
    select m.profile_id, 'grupo'
    from public.fan_group_member as meu
    join public.fan_group_member as m on m.group_id = meu.group_id
    where meu.profile_id = auth.uid()
    union
    select rp.profile_id, 'boleia'
    from public.trip_session as s
    join public.ride_passenger as rp on rp.ride_id = s.ride_id and rp.status = 'accepted'
    where s.id = p_session_id
    union
    select r.driver_id, 'boleia'
    from public.trip_session as s
    join public.ride as r on r.id = s.ride_id
    where s.id = p_session_id
  )
  select distinct on (c.profile_id) c.profile_id, p.display_name, c.reason
  from candidatos as c
  join public.profile as p on p.id = c.profile_id
  where public.is_trip_member(p_session_id, auth.uid())
    and c.profile_id <> auth.uid()
    and not public.is_trip_member(p_session_id, c.profile_id)
  order by c.profile_id, c.reason;
$$;

-- Acrescentar alguém às contas.
create function public.add_trip_person(p_session_id uuid, p_profile_id uuid)
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
  if not public.is_trip_member(p_session_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  -- Só quem se conhece: um amigo, alguém de um grupo meu, ou alguém do carro desta viagem.
  if not exists (
    select 1 from public.trip_people_to_add(p_session_id) as pessoa
    where pessoa.profile_id = p_profile_id
  ) then
    raise exception 'cannot_add' using errcode = '42501';
  end if;

  insert into public.trip_session_member (session_id, profile_id, added_by)
  values (p_session_id, p_profile_id, caller)
  on conflict (session_id, profile_id) do nothing;
end;
$$;

-- Tirar alguém das contas. Só quem ainda não tem dinheiro nelas.
create function public.remove_trip_person(p_session_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_trip_member(p_session_id, auth.uid()) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.trip_expense as e
    where e.session_id = p_session_id and e.source = 'manual' and e.payer_id = p_profile_id
    union all
    select 1
    from public.trip_expense as e
    join public.trip_expense_share as sh on sh.expense_id = e.id
    where e.session_id = p_session_id and e.source = 'manual' and sh.profile_id = p_profile_id
    union all
    select 1 from public.trip_settlement as t
    where t.session_id = p_session_id
      and (t.from_profile_id = p_profile_id or t.to_profile_id = p_profile_id)
  ) then
    raise exception 'has_money' using errcode = '22023';
  end if;
  if (select count(*) from public.trip_session_member where session_id = p_session_id) <= 1 then
    raise exception 'last_person' using errcode = '22023';
  end if;

  delete from public.trip_session_member
  where session_id = p_session_id and profile_id = p_profile_id;
  if not found then
    raise exception 'not_in_trip' using errcode = '22023';
  end if;

  -- A despesa da boleia é refeita: quem saiu das contas também sai dela.
  perform public.sync_ride_trip_expense(p_session_id);
end;
$$;

revoke execute on function public.trip_people_to_add(uuid) from public, anon;
revoke execute on function public.add_trip_person(uuid, uuid) from public, anon;
revoke execute on function public.remove_trip_person(uuid, uuid) from public, anon;
grant execute on function public.trip_people_to_add(uuid) to authenticated;
grant execute on function public.add_trip_person(uuid, uuid) to authenticated;
grant execute on function public.remove_trip_person(uuid, uuid) to authenticated;
