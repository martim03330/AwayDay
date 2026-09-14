-- Personal activity that until now only lived in the phone's memory: tasco ratings, noise measurements,
-- notification preferences and mission proof photos. Every row is private to its owner.

-- The user's own score for a tasco (1 to 5). Aggregates for other fans come with the tasco data.
create table public.place_rating (
  profile_id uuid not null references public.profile (id) on delete cascade,
  place_id text not null references public.place (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, place_id)
);

create index place_rating_place_id_idx on public.place_rating (place_id);

create trigger place_rating_set_updated_at
  before update on public.place_rating
  for each row execute function public.set_updated_at();

-- Valid noise meter readings. The sound is never stored, only the level on the app's relative scale.
-- Written only through record_noise_measurement, which checks the fixture is being played.
create table public.noise_measurement (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profile (id) on delete cascade,
  fixture_id text not null references public.fixture (id) on delete cascade,
  level smallint not null check (level between 0 and 100),
  measured_at timestamptz not null default now()
);

create index noise_measurement_profile_fixture_idx
  on public.noise_measurement (profile_id, fixture_id, measured_at desc);
create index noise_measurement_fixture_id_idx on public.noise_measurement (fixture_id);

-- Which push notification kinds the user wants. A missing row means the app default.
create table public.notification_preference (
  profile_id uuid not null references public.profile (id) on delete cascade,
  kind text not null check (kind in ('kickoff_change', 'weather', 'group_movement', 'new_stamp')),
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, kind)
);

create trigger notification_preference_set_updated_at
  before update on public.notification_preference
  for each row execute function public.set_updated_at();

-- One proof photo per mission. The file lives in the private `mission-photos` bucket, under the owner's id.
-- `verified` and `taken_at` are decided by the server, never sent by the phone.
create table public.mission_photo (
  profile_id uuid not null references public.profile (id) on delete cascade,
  mission_id text not null check (mission_id ~ '^[a-z0-9-]{1,60}$'),
  storage_path text not null unique,
  fixture_id text references public.fixture (id) on delete set null,
  venue_id text references public.venue (id) on delete set null,
  verified boolean not null default false,
  taken_at timestamptz not null default now(),
  primary key (profile_id, mission_id),
  check (storage_path like profile_id::text || '/%')
);

create index mission_photo_fixture_id_idx on public.mission_photo (fixture_id);
create index mission_photo_venue_id_idx on public.mission_photo (venue_id);

-- A photo is verified when it is taken on a match day, with a check-in that same day (in Lisbon) at a tasco
-- near the stadium of a fixture played that day. The stadium and fixture then come from that check-in.
create function public.mission_photo_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today constant date := (now() at time zone 'Europe/Lisbon')::date;
  match_fixture text;
  match_venue text;
begin
  new.taken_at := now();

  select f.id, pl.venue_id
    into match_fixture, match_venue
  from public.place_visit as v
  join public.place as pl on pl.id = v.place_id
  join public.fixture as f on f.venue_id = pl.venue_id
  where v.profile_id = new.profile_id
    and v.source = 'check-in'
    and (v.visited_at at time zone 'Europe/Lisbon')::date = today
    and (f.kickoff_at at time zone 'Europe/Lisbon')::date = today
  order by v.visited_at desc
  limit 1;

  new.verified := match_fixture is not null;
  if new.verified then
    new.fixture_id := match_fixture;
    new.venue_id := match_venue;
  end if;

  return new;
end;
$$;

revoke execute on function public.mission_photo_before_write() from public, anon, authenticated;

create trigger mission_photo_before_write
  before insert or update on public.mission_photo
  for each row execute function public.mission_photo_before_write();

-- Row level security.
alter table public.place_rating enable row level security;
alter table public.noise_measurement enable row level security;
alter table public.notification_preference enable row level security;
alter table public.mission_photo enable row level security;

create policy "users read their own place ratings"
  on public.place_rating for select to authenticated
  using ((select auth.uid()) = profile_id);
create policy "users rate places as themselves"
  on public.place_rating for insert to authenticated
  with check ((select auth.uid()) = profile_id);
create policy "users change their own place ratings"
  on public.place_rating for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);
create policy "users remove their own place ratings"
  on public.place_rating for delete to authenticated
  using ((select auth.uid()) = profile_id);

-- No insert policy: readings only come in through record_noise_measurement.
create policy "users read their own noise measurements"
  on public.noise_measurement for select to authenticated
  using ((select auth.uid()) = profile_id);

create policy "users read their own notification preferences"
  on public.notification_preference for select to authenticated
  using ((select auth.uid()) = profile_id);
create policy "users set their own notification preferences"
  on public.notification_preference for insert to authenticated
  with check ((select auth.uid()) = profile_id);
create policy "users change their own notification preferences"
  on public.notification_preference for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

create policy "users read their own mission photos"
  on public.mission_photo for select to authenticated
  using ((select auth.uid()) = profile_id);
create policy "users add their own mission photos"
  on public.mission_photo for insert to authenticated
  with check ((select auth.uid()) = profile_id);
create policy "users replace their own mission photos"
  on public.mission_photo for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);
create policy "users remove their own mission photos"
  on public.mission_photo for delete to authenticated
  using ((select auth.uid()) = profile_id);

-- Noise readings: only while the fixture is being played, and at least 8 minutes apart per person and fixture,
-- so nobody measures again and again until the number they want comes out.
create function public.record_noise_measurement(p_fixture_id text, p_level integer)
returns public.noise_measurement
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  match_length constant interval := interval '115 minutes';
  min_gap constant interval := interval '8 minutes';
  kickoff timestamptz;
  measurement public.noise_measurement;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_level is null or p_level < 0 or p_level > 100 then
    raise exception 'noise_level_out_of_range' using errcode = '22023';
  end if;

  select f.kickoff_at into kickoff from public.fixture as f where f.id = p_fixture_id;
  if kickoff is null then
    raise exception 'fixture_not_found' using errcode = 'P0002';
  end if;
  if now() < kickoff or now() >= kickoff + match_length then
    raise exception 'fixture_not_live' using errcode = '42501';
  end if;

  -- One reading at a time per person and fixture, so parallel calls cannot slip past the gap.
  perform pg_advisory_xact_lock(hashtext('noise:' || caller::text || ':' || p_fixture_id));
  if exists (
    select 1
    from public.noise_measurement as m
    where m.profile_id = caller and m.fixture_id = p_fixture_id and m.measured_at > now() - min_gap
  ) then
    raise exception 'noise_measurement_too_soon' using errcode = 'P0001';
  end if;

  insert into public.noise_measurement (profile_id, fixture_id, level)
  values (caller, p_fixture_id, p_level)
  returning * into measurement;
  return measurement;
end;
$$;

revoke execute on function public.record_noise_measurement(text, integer) from public, anon;
grant execute on function public.record_noise_measurement(text, integer) to authenticated;

-- Privileges.
revoke all on public.place_rating, public.noise_measurement, public.notification_preference, public.mission_photo
  from anon;

revoke all on public.place_rating, public.notification_preference from authenticated;
grant select, insert, update, delete on public.place_rating to authenticated;
grant select, insert, update on public.notification_preference to authenticated;

revoke all on public.noise_measurement from authenticated;
grant select on public.noise_measurement to authenticated;

revoke all on public.mission_photo from authenticated;
grant select, delete on public.mission_photo to authenticated;
grant insert (profile_id, mission_id, storage_path, fixture_id, venue_id) on public.mission_photo to authenticated;
grant update (profile_id, mission_id, storage_path, fixture_id, venue_id) on public.mission_photo to authenticated;

-- Storage: private bucket for proof photos, one folder per user (`<profile id>/<file>`).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mission-photos', 'mission-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/heic'])
on conflict (id) do nothing;

create policy "users read their own mission photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'mission-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users upload mission photo files to their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mission-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users replace their own mission photo files"
  on storage.objects for update to authenticated
  using (bucket_id = 'mission-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'mission-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users delete their own mission photo files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'mission-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
