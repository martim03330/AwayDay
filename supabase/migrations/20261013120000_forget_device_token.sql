-- Signing out stops this phone's pushes even without a session or a connection at that moment (review of
-- 2026-10-13). Before, the app deleted its row only if it still had the token in memory and the delete worked; a
-- sign-out offline left the phone receiving the old account's chat notifications.
--
-- Whoever holds the token (only the phone itself) can forget it, with or without a session: the app calls this on
-- sign-out and, if it fails, again on the next launch. Knowing a token only lets you stop pushes to that phone.

create function public.forget_device_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.device_token where token = left(p_token, 300);
$$;

revoke execute on function public.forget_device_token(text) from public;
grant execute on function public.forget_device_token(text) to anon, authenticated;
