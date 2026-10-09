-- can_share_house(p_profile_id) was executable by any signed-in user for any profile, so anyone could find out whether
-- someone else is suspended from rides. The app only asks about the caller: it now uses i_can_share_house(), which
-- answers for auth.uid() only, and can_share_house stays internal (used inside the definer functions).

create or replace function public.i_can_share_house()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and public.can_share_house(auth.uid());
$$;

revoke execute on function public.i_can_share_house() from public, anon;
grant execute on function public.i_can_share_house() to authenticated;

revoke execute on function public.can_share_house(uuid) from public, anon, authenticated;
