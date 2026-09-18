-- As casas de um plano, à vista no próprio plano.
--
-- Até aqui, para ver as casas propostas era preciso sair do plano e ir a «Onde dormir». Passam a aparecer **em
-- lista dentro do plano**: as casas deste jogo propostas no grupo (ou nos grupos a quem o plano foi mandado), ou por
-- quem respondeu ao plano. Quem não gostar de uma propõe outra, e a malta diz qual prefere — **uma preferência por
-- pessoa e por plano** («prefiro esta»), para se ver depressa para onde pende o grupo. Quem convidou escolhe a casa
-- do plano (a primeira proposta já fica escolhida sozinha, como até aqui).

create table public.fixture_plan_house_vote (
  plan_id uuid not null references public.fixture_plan (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  stay_plan_id uuid not null references public.stay_plan (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plan_id, profile_id)
);

create index fixture_plan_house_vote_stay_idx on public.fixture_plan_house_vote (stay_plan_id);

alter table public.fixture_plan_house_vote enable row level security;
revoke all on public.fixture_plan_house_vote from anon, authenticated;

/** Esta casa entra na lista do plano: é do jogo do plano e foi proposta no grupo, num grupo do plano, ou por alguém do plano. */
create function public.is_fixture_plan_house(p_plan_id uuid, p_stay_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.fixture_plan as fp
    join public.stay_plan as s on s.id = p_stay_plan_id and s.fixture_id = fp.fixture_id
    where fp.id = p_plan_id
      and (
        s.id = fp.stay_plan_id
        or s.group_id = fp.group_id
        or s.group_id in (select fg.group_id from public.fixture_plan_group as fg where fg.plan_id = fp.id)
        or s.profile_id = fp.created_by
        or s.profile_id in (select a.profile_id from public.fixture_plan_answer as a where a.plan_id = fp.id)
      )
  );
$$;

/** As casas do plano, com as preferências da malta. A casa escolhida primeiro, depois as mais preferidas. */
create function public.fixture_plan_houses(p_plan_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  owner_name text,
  total_cents integer,
  nights smallint,
  spare_places smallint,
  taken integer,
  share_now_cents integer,
  share_full_cents integer,
  listing_url text,
  status text,
  note text,
  is_mine boolean,
  my_status text,
  votes integer,
  my_vote boolean,
  chosen boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.profile_id,
    p.display_name,
    s.total_cents,
    s.nights,
    s.spare_places,
    ocupados.n,
    public.stay_share_cents(s.total_cents, 1 + ocupados.n),
    public.stay_share_cents(s.total_cents, 1 + s.spare_places),
    s.listing_url,
    s.status,
    s.note,
    s.profile_id = auth.uid(),
    meu.status,
    (select count(*)::integer from public.fixture_plan_house_vote as v where v.plan_id = p_plan_id and v.stay_plan_id = s.id),
    exists (
      select 1 from public.fixture_plan_house_vote as v
      where v.plan_id = p_plan_id and v.stay_plan_id = s.id and v.profile_id = auth.uid()
    ),
    s.id = fp.stay_plan_id
  from public.fixture_plan as fp
  join public.stay_plan as s on s.fixture_id = fp.fixture_id
  join public.profile as p on p.id = s.profile_id
  cross join lateral (
    select count(*)::integer as n from public.stay_place as sp
    where sp.plan_id = s.id and sp.status = 'aceite'
  ) as ocupados
  left join public.stay_place as meu on meu.plan_id = s.id and meu.profile_id = auth.uid()
  where fp.id = p_plan_id
    and auth.uid() is not null
    and public.can_see_fixture_plan(p_plan_id, auth.uid())
    and public.is_fixture_plan_house(p_plan_id, s.id)
    and (
      s.visibility = 'publica'
      or s.profile_id = auth.uid()
      or public.can_see_private_stay(s.id, s.group_id, auth.uid())
    )
  order by
    s.id = fp.stay_plan_id desc,
    (select count(*) from public.fixture_plan_house_vote as v where v.plan_id = p_plan_id and v.stay_plan_id = s.id) desc,
    s.created_at;
$$;

/** «Prefiro esta». Uma preferência por pessoa e por plano: escolher outra casa muda-a; `null` tira-a. */
create function public.vote_fixture_plan_house(p_plan_id uuid, p_stay_plan_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if p_stay_plan_id is null then
    delete from public.fixture_plan_house_vote where plan_id = p_plan_id and profile_id = caller;
    return;
  end if;
  if not public.is_fixture_plan_house(p_plan_id, p_stay_plan_id) then
    raise exception 'stay_not_found' using errcode = 'P0002';
  end if;
  insert into public.fixture_plan_house_vote (plan_id, profile_id, stay_plan_id)
  values (p_plan_id, caller, p_stay_plan_id)
  on conflict (plan_id, profile_id) do update set stay_plan_id = excluded.stay_plan_id, created_at = now();
end;
$$;

-- As preferências mudam a lista de quem tem o plano aberto.
create trigger fixture_plan_house_vote_broadcast
  after insert or update or delete on public.fixture_plan_house_vote
  for each row execute function public.broadcast_fixture_plan();

revoke execute on function public.is_fixture_plan_house(uuid, uuid) from public, anon;
revoke execute on function public.fixture_plan_houses(uuid) from public, anon;
revoke execute on function public.vote_fixture_plan_house(uuid, uuid) from public, anon;
grant execute on function public.is_fixture_plan_house(uuid, uuid) to authenticated;
grant execute on function public.fixture_plan_houses(uuid) to authenticated;
grant execute on function public.vote_fixture_plan_house(uuid, uuid) to authenticated;
