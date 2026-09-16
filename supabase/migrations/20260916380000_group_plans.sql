-- O que o grupo tem em mãos: as boleias e as casas do grupo, num sítio só.
--
-- Depois de marcar uma boleia (ou uma casa) como sendo do grupo, é lá dentro que a malta a enche: vê quantos lugares
-- faltam, entra, e só quando vê que não enche é que abre a toda a gente. Até aqui, essas coisas só se viam na ficha
-- de cada jogo — o grupo tinha a lista dos jogos mas não o que havia para encher.
--
-- Uma chamada só, para o ecrã do grupo: boleias e casas juntas, do jogo mais próximo para a frente.

create function public.group_plans(p_group_id uuid)
returns table (
  kind text,
  id uuid,
  fixture_id text,
  kickoff_at timestamptz,
  owner_name text,
  is_mine boolean,
  departure_at timestamptz,
  seats_total integer,
  taken integer,
  share_now_cents integer,
  visibility text,
  status text,
  my_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    'boleia',
    r.id,
    r.fixture_id,
    f.kickoff_at,
    p.display_name,
    r.driver_id = auth.uid(),
    r.departure_at,
    r.seats_offered::integer,
    ocupados.n,
    public.ride_share_cents(r.total_cents, 1 + ocupados.n),
    r.visibility,
    r.status,
    meu.status
  from public.ride as r
  join public.fixture as f on f.id = r.fixture_id
  join public.profile as p on p.id = r.driver_id
  cross join lateral (
    select count(*)::integer as n from public.ride_passenger as rp
    where rp.ride_id = r.id and rp.status = 'accepted'
  ) as ocupados
  left join public.ride_passenger as meu on meu.ride_id = r.id and meu.profile_id = auth.uid()
  where r.group_id = p_group_id
    and r.status = 'open'
    and f.kickoff_at > now() - interval '1 day'
    and public.is_group_member(p_group_id, auth.uid())

  union all

  select
    'casa',
    s.id,
    s.fixture_id,
    f.kickoff_at,
    p.display_name,
    s.profile_id = auth.uid(),
    null::timestamptz,
    s.spare_places::integer,
    ocupados.n,
    public.stay_share_cents(s.total_cents, 1 + ocupados.n),
    s.visibility,
    s.status,
    meu.status
  from public.stay_plan as s
  join public.fixture as f on f.id = s.fixture_id
  join public.profile as p on p.id = s.profile_id
  cross join lateral (
    select count(*)::integer as n from public.stay_place as sp
    where sp.plan_id = s.id and sp.status = 'aceite'
  ) as ocupados
  left join public.stay_place as meu on meu.plan_id = s.id and meu.profile_id = auth.uid()
  where s.group_id = p_group_id
    and f.kickoff_at > now() - interval '1 day'
    and public.is_group_member(p_group_id, auth.uid())

  order by 4, 1;
$$;

revoke execute on function public.group_plans(uuid) from public, anon;
grant execute on function public.group_plans(uuid) to authenticated;
