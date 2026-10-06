-- «A maior extravagância» de uma viagem é das que têm graça: cervejas, petiscos, refeições e o resto. Bilhetes,
-- casa, boleia e portagens são o custo de ir, não uma extravagância.

create or replace function public.trip_memory(p_session_id uuid)
returns table (
  session_id uuid,
  name text,
  fixture_id text,
  kickoff_at timestamptz,
  people_names text[],
  total_cents integer,
  expenses integer,
  biggest_description text,
  biggest_cents integer,
  photos integer,
  i_went boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.name,
    s.fixture_id,
    f.kickoff_at,
    array(
      select p.display_name
      from public.trip_session_people(s.id) as foi
      join public.profile as p on p.id = foi.profile_id
      order by p.display_name
    ),
    coalesce((select sum(e.cents)::integer from public.trip_expense as e where e.session_id = s.id), 0),
    (select count(*)::integer from public.trip_expense as e where e.session_id = s.id),
    maior.description,
    maior.cents,
    (select count(*)::integer from public.trip_photo as ph where ph.session_id = s.id),
    public.is_trip_member(s.id, auth.uid())
  from public.trip_session as s
  join public.fixture as f on f.id = s.fixture_id
  left join lateral (
    select e.description, e.cents from public.trip_expense as e
    where e.session_id = s.id
      and e.source = 'manual'
      and e.category in ('cerveja', 'petiscos', 'refeicao', 'outro')
    order by e.cents desc
    limit 1
  ) as maior on true
  where s.id = p_session_id and public.can_see_trip_memories(p_session_id, auth.uid());
$$;
