-- Activity: what each user did (fixtures, reviews, places) and where to send push notifications.
-- Everything here is private to its owner. Facts for suggestions and the season recap are computed
-- from these tables on the server.

-- Words to write correct Portuguese sentences with catalogue names ("na Luz", "aos Barreiros",
-- "em Alvalade"). An empty article means the name takes none.
alter table public.venue
  add column name_article text not null default 'o' check (name_article in ('o', 'a', 'os', 'as', '')),
  add column short_name text check (char_length(short_name) between 2 and 40),
  add column short_name_article text check (short_name_article in ('o', 'a', 'os', 'as', '')),
  add column district text,
  add constraint venue_short_name_has_article check ((short_name is null) = (short_name_article is null));

alter table public.club
  add column name_article text not null default 'o' check (name_article in ('o', 'a', 'os', 'as', ''));

-- Places around venues (tascos, bars). Public reference data, read-only.
create table public.place (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  name_article text not null check (name_article in ('o', 'a', 'os', 'as', '')),
  kind text not null check (kind in ('tasca', 'cervejaria', 'bar', 'roulotte', 'churrasqueira')),
  venue_id text not null references public.venue (id),
  walking_minutes smallint not null check (walking_minutes between 0 and 120),
  distance_m integer not null check (distance_m >= 0),
  location extensions.geography(point, 4326) not null,
  created_at timestamptz not null default now()
);

create index place_venue_id_idx on public.place (venue_id);
create index place_location_idx on public.place using gist (location);

-- "Going" to an upcoming fixture, or "attended" once it has started.
create table public.fixture_attendance (
  profile_id uuid not null references public.profile (id) on delete cascade,
  fixture_id text not null references public.fixture (id) on delete cascade,
  status text not null check (status in ('going', 'attended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, fixture_id)
);

create index fixture_attendance_fixture_id_idx on public.fixture_attendance (fixture_id);

create trigger fixture_attendance_set_updated_at
  before update on public.fixture_attendance
  for each row execute function public.set_updated_at();

-- Scores the user gave after a fixture (one review per fixture).
create table public.venue_review (
  profile_id uuid not null references public.profile (id) on delete cascade,
  fixture_id text not null references public.fixture (id) on delete cascade,
  stadium_score smallint not null check (stadium_score between 1 and 5),
  atmosphere_score smallint not null check (atmosphere_score between 1 and 5),
  access_score smallint not null check (access_score between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, fixture_id)
);

create index venue_review_fixture_id_idx on public.venue_review (fixture_id);

create trigger venue_review_set_updated_at
  before update on public.venue_review
  for each row execute function public.set_updated_at();

-- The user's own history of places. Not the future `checkin` presence table (which expires in 48h
-- and feeds aggregates): this is never read for anyone but its owner and never aggregated.
create table public.place_visit (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profile (id) on delete cascade,
  place_id text not null references public.place (id) on delete cascade,
  visited_at timestamptz not null default now(),
  source text not null check (source in ('check-in', 'manual')),
  created_at timestamptz not null default now()
);

create index place_visit_profile_visited_idx on public.place_visit (profile_id, visited_at desc);
create index place_visit_place_id_idx on public.place_visit (place_id);

-- The user chooses which AI-written messages they get.
alter table public.profile
  add column nudges_enabled boolean not null default true,
  add column recap_enabled boolean not null default true;

-- Expo push tokens. A token belongs to one account at a time (see register_device_token).
create table public.device_token (
  token text primary key check (token ~ '^Expo(nent)?PushToken\[.+\]$'),
  profile_id uuid not null references public.profile (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index device_token_profile_id_idx on public.device_token (profile_id);

-- Row level security.
alter table public.place enable row level security;
alter table public.fixture_attendance enable row level security;
alter table public.venue_review enable row level security;
alter table public.place_visit enable row level security;
alter table public.device_token enable row level security;

create policy "place is readable by everyone"
  on public.place for select to anon, authenticated using (true);

create policy "users read their own attendance"
  on public.fixture_attendance for select to authenticated
  using ((select auth.uid()) = profile_id);
-- "going" only before kick-off, "attended" only from kick-off on: the server decides, not the phone clock.
create policy "users add their own attendance"
  on public.fixture_attendance for insert to authenticated
  with check (
    (select auth.uid()) = profile_id
    and exists (
      select 1 from public.fixture as f
      where f.id = fixture_id
        and ((status = 'going' and f.kickoff_at > now()) or (status = 'attended' and f.kickoff_at <= now()))
    )
  );
create policy "users change their own attendance"
  on public.fixture_attendance for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check (
    (select auth.uid()) = profile_id
    and exists (
      select 1 from public.fixture as f
      where f.id = fixture_id
        and ((status = 'going' and f.kickoff_at > now()) or (status = 'attended' and f.kickoff_at <= now()))
    )
  );
create policy "users remove their own attendance"
  on public.fixture_attendance for delete to authenticated
  using ((select auth.uid()) = profile_id);

create policy "users read their own reviews"
  on public.venue_review for select to authenticated
  using ((select auth.uid()) = profile_id);
create policy "users review fixtures that have started"
  on public.venue_review for insert to authenticated
  with check (
    (select auth.uid()) = profile_id
    and exists (select 1 from public.fixture as f where f.id = fixture_id and f.kickoff_at <= now())
  );
create policy "users change their own reviews"
  on public.venue_review for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check (
    (select auth.uid()) = profile_id
    and exists (select 1 from public.fixture as f where f.id = fixture_id and f.kickoff_at <= now())
  );
create policy "users remove their own reviews"
  on public.venue_review for delete to authenticated
  using ((select auth.uid()) = profile_id);

create policy "users read their own place history"
  on public.place_visit for select to authenticated
  using ((select auth.uid()) = profile_id);
create policy "users add visits to their own history, never in the future"
  on public.place_visit for insert to authenticated
  with check ((select auth.uid()) = profile_id and visited_at <= now() + interval '5 minutes');
create policy "users remove visits from their own history"
  on public.place_visit for delete to authenticated
  using ((select auth.uid()) = profile_id);

create policy "users read their own device tokens"
  on public.device_token for select to authenticated
  using ((select auth.uid()) = profile_id);
create policy "users remove their own device tokens"
  on public.device_token for delete to authenticated
  using ((select auth.uid()) = profile_id);

-- A phone can change accounts: the token moves to whoever registers it last.
create function public.register_device_token(p_token text, p_platform text)
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
end;
$$;

revoke execute on function public.register_device_token(text, text) from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;

-- Privileges.
revoke insert, update, delete, truncate, references, trigger on public.place from anon, authenticated;
grant select on public.place to anon, authenticated;

revoke all on public.fixture_attendance, public.venue_review, public.place_visit, public.device_token from anon;
revoke truncate, references, trigger on public.fixture_attendance, public.venue_review from authenticated;
grant select, insert, update, delete on public.fixture_attendance, public.venue_review to authenticated;
revoke all on public.place_visit from authenticated;
grant select, insert, delete on public.place_visit to authenticated;
revoke all on public.device_token from authenticated;
grant select, delete on public.device_token to authenticated;

grant update (display_name, nudges_enabled, recap_enabled) on public.profile to authenticated;
