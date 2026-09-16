-- As contas da viagem.
--
-- Cada grupo tem, para cada jogo, uma **sessão**: é onde entram as despesas do dia e onde no fim se vê quem paga a
-- quem. Abre quando alguém a abre (normalmente no dia da viagem) e fica lá para consulta.
--
-- Como se divide: cada despesa é dividida **por igual entre as pessoas que entram nela** — nem todos bebem, nem
-- todos dormem na casa. Quem pagou fica a haver, quem entrou fica a dever.
--
-- O dinheiro é sempre cêntimos inteiros. Quando a divisão não é exata, os cêntimos que sobram são distribuídos um a
-- um pelos participantes, sempre pela mesma ordem: ninguém paga um cêntimo a mais por acaso, e a soma das partes é
-- exatamente igual ao que foi pago.

create table public.trip_session (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.fan_group (id) on delete cascade,
  fixture_id text not null references public.fixture (id) on delete cascade,
  opened_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, fixture_id)
);

create index trip_session_group_idx on public.trip_session (group_id);

create trigger trip_session_set_updated_at
  before update on public.trip_session
  for each row execute function public.set_updated_at();

create table public.trip_expense (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.trip_session (id) on delete cascade,
  -- Quem pôs o dinheiro. Pode não ser quem escreveu a despesa.
  payer_id uuid not null references public.profile (id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 2 and 80),
  category text not null check (
    category in ('cerveja', 'petiscos', 'refeicao', 'bilhetes', 'casa', 'boleia', 'portagens', 'outro')
  ),
  cents integer not null check (cents between 1 and 1000000),
  created_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trip_expense_session_idx on public.trip_expense (session_id);

create trigger trip_expense_set_updated_at
  before update on public.trip_expense
  for each row execute function public.set_updated_at();

-- Quem entra em cada despesa. Sem linhas aqui, a despesa não é de ninguém — por isso são sempre escritas juntas.
create table public.trip_expense_share (
  expense_id uuid not null references public.trip_expense (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  primary key (expense_id, profile_id)
);

alter table public.trip_session enable row level security;
alter table public.trip_expense enable row level security;
alter table public.trip_expense_share enable row level security;
revoke all on public.trip_session from anon, authenticated;
revoke all on public.trip_expense from anon, authenticated;
revoke all on public.trip_expense_share from anon, authenticated;

-- Abrir (ou reabrir) a sessão de um jogo. Qualquer pessoa do grupo.
create function public.open_trip_session(p_group_id uuid, p_fixture_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  sessao uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.is_group_member(p_group_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if not exists (select 1 from public.fixture where id = p_fixture_id) then
    raise exception 'fixture_not_found' using errcode = 'P0002';
  end if;

  insert into public.trip_session (group_id, fixture_id, opened_by)
  values (p_group_id, p_fixture_id, caller)
  on conflict (group_id, fixture_id) do update set updated_at = now()
  returning id into sessao;

  return sessao;
end;
$$;

-- Acrescentar uma despesa: quem pagou, quanto, e quem entra nela.
create function public.add_trip_expense(
  p_session_id uuid,
  p_description text,
  p_category text,
  p_cents integer,
  p_payer_id uuid default null,
  p_participants uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  grupo uuid;
  quem uuid;
  gente uuid[];
  nova uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select s.group_id into grupo from public.trip_session as s where s.id = p_session_id;
  if grupo is null then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;
  if not public.is_group_member(grupo, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;

  quem := coalesce(p_payer_id, caller);
  if not public.is_group_member(grupo, quem) then
    raise exception 'payer_not_member' using errcode = '22023';
  end if;

  -- Sem lista, entra o grupo todo: é o caso normal de uma rodada.
  gente := coalesce(
    p_participants,
    array(select m.profile_id from public.fan_group_member as m where m.group_id = grupo)
  );
  if array_length(gente, 1) is null then
    raise exception 'no_participants' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(gente) as pessoa(id)
    where not public.is_group_member(grupo, pessoa.id)
  ) then
    raise exception 'participant_not_member' using errcode = '22023';
  end if;

  if p_cents is null or p_cents < 1 or p_cents > 1000000
    or char_length(btrim(coalesce(p_description, ''))) < 2
    or char_length(btrim(p_description)) > 80
    or p_category not in ('cerveja', 'petiscos', 'refeicao', 'bilhetes', 'casa', 'boleia', 'portagens', 'outro') then
    raise exception 'bad_expense' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'trip-expense', 60, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.trip_expense (session_id, payer_id, description, category, cents, created_by)
  values (p_session_id, quem, btrim(p_description), p_category, p_cents, caller)
  returning id into nova;

  insert into public.trip_expense_share (expense_id, profile_id)
  select distinct nova, pessoa.id from unnest(gente) as pessoa(id);

  return nova;
end;
$$;

-- Apagar uma despesa: quem a escreveu ou quem pagou.
create function public.remove_trip_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.trip_expense
  where id = p_expense_id and (created_by = auth.uid() or payer_id = auth.uid());
  if not found then
    raise exception 'not_yours' using errcode = '42501';
  end if;
end;
$$;

-- As despesas de uma sessão, com quem pagou e quem entra em cada uma.
create function public.trip_expenses(p_session_id uuid)
returns table (
  id uuid,
  description text,
  category text,
  cents integer,
  payer_id uuid,
  payer_name text,
  participants integer,
  participant_names text[],
  i_am_in boolean,
  mine boolean,
  created_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    e.description,
    e.category,
    e.cents,
    e.payer_id,
    quem.display_name,
    (select count(*)::integer from public.trip_expense_share as sh where sh.expense_id = e.id),
    array(
      select p.display_name
      from public.trip_expense_share as sh
      join public.profile as p on p.id = sh.profile_id
      where sh.expense_id = e.id
      order by p.display_name
    ),
    exists (
      select 1 from public.trip_expense_share as sh
      where sh.expense_id = e.id and sh.profile_id = auth.uid()
    ),
    e.created_by = auth.uid() or e.payer_id = auth.uid(),
    e.created_at::date
  from public.trip_expense as e
  join public.trip_session as s on s.id = e.session_id
  join public.profile as quem on quem.id = e.payer_id
  where e.session_id = p_session_id and public.is_group_member(s.group_id, auth.uid())
  order by e.created_at desc;
$$;

/**
 * Quanto cada um pôs e quanto lhe cabe. A divisão é por igual entre quem entra na despesa; os cêntimos que sobram
 * da divisão vão, um a um, para os primeiros participantes por ordem do identificador — sempre a mesma ordem, para
 * a conta dar exatamente o que foi pago e não mudar de um dia para o outro.
 */
create function public.trip_balances(p_session_id uuid)
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
  with membros as (
    select m.profile_id
    from public.trip_session as s
    join public.fan_group_member as m on m.group_id = s.group_id
    where s.id = p_session_id and public.is_group_member(s.group_id, auth.uid())
  ),
  partes as (
    select
      sh.profile_id,
      e.cents / contagem.n
        + case when row_number() over (partition by e.id order by sh.profile_id) <= e.cents % contagem.n
            then 1 else 0 end as parte
    from public.trip_expense as e
    join public.trip_expense_share as sh on sh.expense_id = e.id
    cross join lateral (
      select count(*)::integer as n from public.trip_expense_share as x where x.expense_id = e.id
    ) as contagem
    where e.session_id = p_session_id
  ),
  pagou as (
    select e.payer_id as profile_id, sum(e.cents)::integer as total
    from public.trip_expense as e
    where e.session_id = p_session_id
    group by e.payer_id
  ),
  deve as (
    select p.profile_id, sum(p.parte)::integer as total
    from partes as p
    group by p.profile_id
  )
  select
    m.profile_id,
    pr.display_name,
    coalesce(pagou.total, 0),
    coalesce(deve.total, 0),
    coalesce(pagou.total, 0) - coalesce(deve.total, 0),
    m.profile_id = auth.uid()
  from membros as m
  join public.profile as pr on pr.id = m.profile_id
  left join pagou on pagou.profile_id = m.profile_id
  left join deve on deve.profile_id = m.profile_id
  order by (coalesce(pagou.total, 0) - coalesce(deve.total, 0)) desc, pr.display_name;
$$;

-- A sessão de um grupo para um jogo, se existir.
create function public.trip_session_of(p_group_id uuid, p_fixture_id text)
returns table (id uuid, expenses integer, total_cents integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    (select count(*)::integer from public.trip_expense as e where e.session_id = s.id),
    coalesce((select sum(e.cents)::integer from public.trip_expense as e where e.session_id = s.id), 0)
  from public.trip_session as s
  where s.group_id = p_group_id
    and s.fixture_id = p_fixture_id
    and public.is_group_member(s.group_id, auth.uid());
$$;

revoke execute on function public.open_trip_session(uuid, text) from public, anon;
revoke execute on function public.add_trip_expense(uuid, text, text, integer, uuid, uuid[]) from public, anon;
revoke execute on function public.remove_trip_expense(uuid) from public, anon;
revoke execute on function public.trip_expenses(uuid) from public, anon;
revoke execute on function public.trip_balances(uuid) from public, anon;
revoke execute on function public.trip_session_of(uuid, text) from public, anon;
grant execute on function public.open_trip_session(uuid, text) to authenticated;
grant execute on function public.add_trip_expense(uuid, text, text, integer, uuid, uuid[]) to authenticated;
grant execute on function public.remove_trip_expense(uuid) to authenticated;
grant execute on function public.trip_expenses(uuid) to authenticated;
grant execute on function public.trip_balances(uuid) to authenticated;
grant execute on function public.trip_session_of(uuid, text) to authenticated;
