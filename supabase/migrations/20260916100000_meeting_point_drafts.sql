-- Semi-automatic official meeting points.
-- - check-meeting-points (pg_cron, 3 times a day) reads the news pages of Benfica, FC Porto and Sporting and, for a
--   European away game in the next 7 days without a meeting point, stores the fan-information article as a draft:
--   link, title and the sentences that matter. Admins get a push notification.
-- - An admin fills in the fields in the app; the meeting-point-drafts function geocodes the place and publishes it.
--   Nothing reaches fans without that confirmation.
-- - profile.is_admin can only be set by the owner (no update grant for it).

alter table public.profile add column is_admin boolean not null default false;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profile as p where p.id = auth.uid()), false);
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table public.meeting_point_draft (
  id uuid primary key default gen_random_uuid(),
  fixture_id text not null references public.fixture (id) on delete cascade,
  -- The club whose site published it.
  club_id text not null references public.club (id) on delete cascade,
  source_url text not null check (source_url ~ '^https://'),
  source_title text not null check (char_length(source_title) between 1 and 300),
  excerpt text not null check (char_length(excerpt) between 1 and 4000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  found_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profile (id) on delete set null,
  constraint meeting_point_draft_once_per_article unique (fixture_id, source_url)
);

create index meeting_point_draft_status_found_idx on public.meeting_point_draft (status, found_at desc);
create index meeting_point_draft_club_id_idx on public.meeting_point_draft (club_id);
create index meeting_point_draft_decided_by_idx on public.meeting_point_draft (decided_by);

alter table public.meeting_point_draft enable row level security;

create policy "admins read meeting point drafts"
  on public.meeting_point_draft for select to authenticated
  using ((select public.is_admin()));

revoke all on public.meeting_point_draft from anon, authenticated;
grant select on public.meeting_point_draft to authenticated;

select cron.schedule(
  'check-meeting-points',
  '0 8,14,19 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/check-meeting-points',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
