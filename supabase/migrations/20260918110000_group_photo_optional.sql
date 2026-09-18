-- Tirar a foto do grupo é chamar `set_group_photo` sem caminho. O caminho passa a ter valor por omissão (null),
-- para quem chama não ter de mandar um null explícito.

create or replace function public.set_group_photo(p_group_id uuid, p_path text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_member(p_group_id, auth.uid()) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_path is not null and p_path !~ ('^' || p_group_id::text || '/[A-Za-z0-9._-]{1,100}$') then
    raise exception 'bad_path' using errcode = '22023';
  end if;
  update public.fan_group set photo_path = p_path where id = p_group_id;
end;
$$;
