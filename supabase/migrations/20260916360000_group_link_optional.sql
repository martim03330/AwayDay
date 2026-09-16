-- Tirar uma boleia (ou uma casa) de um grupo é passar `null`. Com o argumento a ter `default null`, a app pode
-- simplesmente não o enviar — e os tipos gerados passam a dizer a verdade sobre isso.

create or replace function public.set_ride_group(p_ride_id uuid, p_group_id uuid default null)
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
  if p_group_id is not null and not public.is_group_member(p_group_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  update public.ride set group_id = p_group_id where id = p_ride_id and driver_id = caller;
  if not found then
    raise exception 'not_driver' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.set_stay_group(p_plan_id uuid, p_group_id uuid default null)
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
  if p_group_id is not null and not public.is_group_member(p_group_id, caller) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  update public.stay_plan set group_id = p_group_id where id = p_plan_id and profile_id = caller;
  if not found then
    raise exception 'not_owner' using errcode = '42501';
  end if;
end;
$$;
