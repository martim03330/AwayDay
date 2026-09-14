-- At most 10 push tokens per account. Before, an account could register any number of tokens, and every push fans
-- out to all of them. `create or replace` keeps the existing grants (authenticated only).

create or replace function public.register_device_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.device_token (token, profile_id, platform)
  values (p_token, caller, p_platform)
  on conflict (token) do update
    set profile_id = excluded.profile_id, platform = excluded.platform, last_seen_at = now();

  -- The least recently seen phones go first.
  delete from public.device_token
  where profile_id = caller
    and token not in (
      select dt.token
      from public.device_token as dt
      where dt.profile_id = caller
      order by dt.last_seen_at desc
      limit 10
    );
end;
$$;
