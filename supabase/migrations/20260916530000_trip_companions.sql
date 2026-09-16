-- Com quem foste a este jogo — com nome, com o que já fizeram juntos, e em que pé estão.
--
-- O resumo da viagem já dizia os nomes de quem foi contigo, mas nomes não chegam para se poder carregar em
-- «adicionar amigo»: é preciso saber quem são e se já são amigos. É o que esta função responde.

create function public.trip_companions(p_fixture_id text)
returns table (
  profile_id uuid,
  display_name text,
  state text,
  trips_together integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with comigo as (
    select r.driver_id as profile_id
    from public.ride as r
    where r.fixture_id = p_fixture_id and r.status = 'open' and public.in_ride(r.id, auth.uid())
    union
    select rp.profile_id
    from public.ride as r
    join public.ride_passenger as rp on rp.ride_id = r.id and rp.status = 'accepted'
    where r.fixture_id = p_fixture_id and r.status = 'open' and public.in_ride(r.id, auth.uid())
    union
    select pessoa.profile_id
    from public.trip_session as s
    cross join lateral public.trip_session_people(s.id) as pessoa
    where s.fixture_id = p_fixture_id and public.is_trip_member(s.id, auth.uid())
  )
  select
    p.id,
    p.display_name,
    estado.state,
    public.trips_together(auth.uid(), p.id)
  from comigo
  join public.profile as p on p.id = comigo.profile_id
  cross join lateral public.friendship_states(array[comigo.profile_id]) as estado
  where auth.uid() is not null and comigo.profile_id <> auth.uid()
  order by p.display_name;
$$;

revoke execute on function public.trip_companions(text) from public, anon;
grant execute on function public.trip_companions(text) to authenticated;
