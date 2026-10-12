-- Security review, 2026-10-13.
--
-- 1. `set_feedback_status` still checked `profile.is_admin` directly, so an admin signed in with the password only
--    (aal1) could change a feedback's status. It now goes through `is_admin()`, which also requires the second factor.
-- 2. `email_has_account` keyed its per-address limit on the first `x-forwarded-for` entry, which the caller writes:
--    a different value on each call meant a fresh limit every time (checked: 25 calls in a row went through). It now
--    keys on `cf-connecting-ip` (set by Cloudflare in front of the API, not by the caller), then on the last
--    `x-forwarded-for` entry, and there is also a cap for everyone together.
-- 3. An append-only log of moderation and admin actions (`admin_action_log`): who did what to which row, and when.
--    Filled by triggers on the tables those actions change, so it covers the RPCs and the Edge Functions alike. It
--    never stores message text or personal data, only ids and the before/after of the watched column.

create or replace function public.set_feedback_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_status not in ('novo', 'visto', 'resolvido') then
    raise exception 'bad_status' using errcode = '22023';
  end if;
  update public.feedback set status = p_status where id = p_id;
end;
$$;

create or replace function public.email_has_account(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  cabecalhos json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  encaminhado text := coalesce(cabecalhos ->> 'x-forwarded-for', '');
  quem text := left(coalesce(
    nullif(btrim(cabecalhos ->> 'cf-connecting-ip'), ''),
    nullif(btrim(regexp_replace(encaminhado, '^.*,', '')), ''),
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
  -- Everyone together: no more than 300 questions an hour, whatever addresses they come from.
  if (
    select count(*) from public.anon_rate_limit_hit
    where bucket = 'email-has-account' and created_at > now() - interval '1 hour'
  ) >= 300 then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  insert into public.anon_rate_limit_hit (bucket, client_key) values ('email-has-account', quem);

  return exists (select 1 from auth.users as u where lower(u.email) = procurado and u.deleted_at is null);
end;
$$;

create index if not exists anon_rate_limit_hit_bucket_time_idx on public.anon_rate_limit_hit (bucket, created_at);

-- 3. The admin action log.
create table public.admin_action_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  action text not null,
  target_table text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb
);

alter table public.admin_action_log enable row level security;

create policy "admins read the admin log"
  on public.admin_action_log for select to authenticated
  using ((select public.is_admin()));

-- Nobody writes to it from the app: only the triggers below (security definer).
revoke insert, update, delete, truncate on public.admin_action_log from anon, authenticated;

create index admin_action_log_at_idx on public.admin_action_log (at desc);

/**
 * Trigger: logs a change of one column. Arguments: the action name, the watched column, and the column naming who
 * acted ('' to use the signed-in user). Only the watched column's before and after go in the details.
 */
create function public.log_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  antes jsonb := to_jsonb(old);
  depois jsonb := to_jsonb(new);
  coluna text := tg_argv[1];
  quem text := nullif(depois ->> nullif(tg_argv[2], ''), '');
begin
  if (antes -> coluna) is distinct from (depois -> coluna) then
    insert into public.admin_action_log (actor_id, action, target_table, target_id, details)
    values (
      coalesce(quem::uuid, auth.uid()),
      tg_argv[0],
      tg_table_name,
      coalesce(depois ->> 'id', depois ->> 'fixture_id'),
      jsonb_build_object('from', antes -> coluna, 'to', depois -> coluna)
    );
  end if;
  return null;
end;
$$;

revoke execute on function public.log_admin_change() from public, anon, authenticated;

create trigger content_report_logged
  after update of status on public.content_report
  for each row execute function public.log_admin_change('report_status', 'status', 'resolved_by');

create trigger place_photo_logged
  after update of status on public.place_photo
  for each row execute function public.log_admin_change('place_photo_status', 'status', 'moderated_by');

create trigger place_rejection_logged
  after update of rejection_reason on public.place
  for each row execute function public.log_admin_change('place_rejection', 'rejection_reason', '');

create trigger feedback_logged
  after update of status on public.feedback
  for each row execute function public.log_admin_change('feedback_status', 'status', '');

create trigger meeting_point_draft_logged
  after update of status on public.meeting_point_draft
  for each row execute function public.log_admin_change('meeting_point_draft_status', 'status', 'decided_by');

create trigger group_message_hidden_logged
  after update of hidden_at on public.group_message
  for each row when (old.hidden_at is null and new.hidden_at is not null)
  execute function public.log_admin_change('group_message_hidden', 'hidden_at', 'hidden_by');

create trigger ride_message_hidden_logged
  after update of hidden_at on public.ride_message
  for each row when (old.hidden_at is null and new.hidden_at is not null)
  execute function public.log_admin_change('ride_message_hidden', 'hidden_at', 'hidden_by');

-- Someone else's photo taken down (people changing their own photo are not logged).
create trigger profile_avatar_cleared_logged
  after update of avatar_path on public.profile
  for each row when (old.avatar_path is not null and new.avatar_path is null and auth.uid() is distinct from new.id)
  execute function public.log_admin_change('profile_photo_cleared', 'avatar_path', '');

-- Who becomes or stops being an admin (set by hand in the database: no actor is then recorded).
create trigger profile_is_admin_logged
  after update of is_admin on public.profile
  for each row execute function public.log_admin_change('profile_is_admin', 'is_admin', '');
