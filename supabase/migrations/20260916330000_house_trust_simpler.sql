-- A semana de conta ficava a mais: travava quem acabou de instalar a app e não trava ninguém de má-fé (basta
-- esperar sete dias). O que fica é o que significa mesmo alguma coisa: quem está suspenso por faltas nas boleias não
-- propõe casas nem entra nelas. O resto continua à vista de todos — desde quando cada um tem conta, quantas boleias
-- fez e quantas faltas tem — para cada um decidir com quem dorme.

create or replace function public.can_share_house(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.ride_ban_until(p_profile_id) is null;
$$;
