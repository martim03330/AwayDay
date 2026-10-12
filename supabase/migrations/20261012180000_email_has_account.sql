-- «Esqueceste a password?» with an email that has no account (testers' feedback, 2026-10-12): the app says so at once,
-- in red under the field, instead of sending people to a code screen where no code ever arrives.
--
-- This tells anyone whether an email has an account here. Martim chose clarity over hiding that. To make testing
-- long lists of emails slow, each network address (the IP the request came from) can ask 20 times an hour; there is no
-- account yet, so the limit cannot be per person.

create table public.anon_rate_limit_hit (
  id bigint generated always as identity primary key,
  bucket text not null check (char_length(bucket) between 1 and 60),
  client_key text not null check (char_length(client_key) between 1 and 200),
  created_at timestamptz not null default now()
);

create index anon_rate_limit_hit_key_idx on public.anon_rate_limit_hit (bucket, client_key, created_at);

alter table public.anon_rate_limit_hit enable row level security;
-- No policies: only the function below uses it.
revoke all on public.anon_rate_limit_hit from anon, authenticated;

/** Whether this email has an account (any state but deleted). At most 20 questions an hour per network address. */
create function public.email_has_account(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  cabecalhos json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  quem text := left(coalesce(
    nullif(btrim(split_part(cabecalhos ->> 'x-forwarded-for', ',', 1)), ''),
    cabecalhos ->> 'cf-connecting-ip',
    'desconhecido'
  ), 200);
  procurado text := lower(btrim(coalesce(p_email, '')));
begin
  if char_length(procurado) < 3 or char_length(procurado) > 320 or position('@' in procurado) = 0 then
    raise exception 'bad_email' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('email-has-account:' || quem, 0));
  delete from public.anon_rate_limit_hit
  where bucket = 'email-has-account' and client_key = quem and created_at <= now() - interval '1 hour';
  if (
    select count(*) from public.anon_rate_limit_hit where bucket = 'email-has-account' and client_key = quem
  ) >= 20 then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  insert into public.anon_rate_limit_hit (bucket, client_key) values ('email-has-account', quem);

  return exists (select 1 from auth.users as u where lower(u.email) = procurado and u.deleted_at is null);
end;
$$;

revoke execute on function public.email_has_account(text) from public;
grant execute on function public.email_has_account(text) to anon, authenticated;
