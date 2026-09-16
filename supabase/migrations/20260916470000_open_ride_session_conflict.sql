-- Correção: abrir as contas de uma boleia duas vezes dava erro.
--
-- O índice que garante uma conta por boleia é parcial (`where ride_id is not null`, porque as contas de grupo têm
-- `ride_id` vazio). Um `on conflict (ride_id)` sem esse mesmo `where` não encontra o índice e a segunda abertura
-- rebentava. Com a condição, volta a devolver a sessão que já lá está.

create or replace function public.open_ride_trip_session(p_ride_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  boleia public.ride;
  sessao uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select * into boleia from public.ride where id = p_ride_id;
  if boleia.id is null then
    raise exception 'ride_not_found' using errcode = 'P0002';
  end if;
  if boleia.driver_id <> caller and not exists (
    select 1 from public.ride_passenger as rp
    where rp.ride_id = p_ride_id and rp.profile_id = caller and rp.status = 'accepted'
  ) then
    raise exception 'not_in_ride' using errcode = '42501';
  end if;

  insert into public.trip_session (ride_id, fixture_id, opened_by)
  values (p_ride_id, boleia.fixture_id, caller)
  on conflict (ride_id) where ride_id is not null do update set updated_at = now()
  returning id into sessao;

  return sessao;
end;
$$;
