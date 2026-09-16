-- Acrescentar às contas alguém que já lá está deixa de ser um erro.
--
-- Dois telemóveis a carregar no mesmo «acrescentar» ao mesmo tempo, ou um toque a dobrar, davam «cannot_add» — a
-- mensagem que a app usa para dizer «essa pessoa não pode entrar». Não é verdade nenhuma: já lá está.

create or replace function public.add_trip_person(p_session_id uuid, p_profile_id uuid)
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
  if public.is_trip_member(p_session_id, p_profile_id) then
    return;
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
