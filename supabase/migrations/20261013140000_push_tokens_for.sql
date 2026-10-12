-- One query instead of three for each notification `social-notify` sends (review of 2026-10-13): who blocked the
-- sender is left out, who turned this kind off is left out (unless `p_kind` is null: a mention or a payer notice),
-- and the phones of the rest come back. Only the service role calls it.

create function public.push_tokens_for(p_recipients uuid[], p_from uuid, p_kind text)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select dt.token
  from public.device_token as dt
  where dt.profile_id = any(p_recipients)
    and (p_from is null or not exists (
      select 1 from public.user_block as b where b.blocker_id = dt.profile_id and b.blocked_id = p_from
    ))
    and (p_kind is null or not exists (
      select 1 from public.notification_preference as np
      where np.profile_id = dt.profile_id and np.kind = p_kind and not np.enabled
    ));
$$;

revoke execute on function public.push_tokens_for(uuid[], uuid, text) from public, anon, authenticated;
