-- Real tascos and their dishes.
-- - Places: imported from OpenStreetMap into `place_candidate` (no client access), curated, and only published ones
--   are copied into `place`. Everything that reads `place` (app, coach, nudges, recaps) therefore only sees real,
--   curated places.
-- - Dishes and photos: suggested by fans, shown only once approved (by the owner, in the Supabase dashboard).
-- - Fans' ratings: averaged on the server and only published once at least 5 people rated.
-- Money is always integer cents.

-- The 25 places so far were fictional demo data. The demo keeps them in the app's mocks; from now on the database
-- only holds real places. Their visits, ratings and photos were test data and go with them (on delete cascade).
delete from public.place;

alter table public.place drop constraint place_kind_check;
alter table public.place
  add constraint place_kind_check
    check (kind in ('tasca', 'cervejaria', 'bar', 'roulotte', 'churrasqueira', 'restaurante', 'cafe')),
  add column source text not null default 'manual' check (source in ('osm', 'manual')),
  add column osm_id text unique check (osm_id ~ '^(node|way|relation)/[0-9]+$'),
  add column opening_hours text check (char_length(opening_hours) <= 200),
  add column price_level smallint check (price_level between 1 and 3),
  add column specialty text check (char_length(btrim(specialty)) between 2 and 80),
  -- Required credit for imported data, e.g. "© contribuidores do OpenStreetMap".
  add column attribution text check (char_length(attribution) <= 200),
  add column updated_at timestamptz not null default now();

create trigger place_set_updated_at
  before update on public.place
  for each row execute function public.set_updated_at();

-- Places found near each stadium, waiting for curation. Never readable by the app.
create table public.place_candidate (
  osm_id text primary key check (osm_id ~ '^(node|way|relation)/[0-9]+$'),
  venue_id text not null references public.venue (id) on delete cascade,
  name text not null,
  osm_tags jsonb not null default '{}'::jsonb,
  suggested_kind text check (
    suggested_kind in ('tasca', 'cervejaria', 'bar', 'roulotte', 'churrasqueira', 'restaurante', 'cafe')
  ),
  location extensions.geography(point, 4326) not null,
  distance_m integer not null check (distance_m >= 0),
  -- Estimated from the straight-line distance, not a route.
  walking_minutes smallint not null check (walking_minutes between 0 and 120),
  decision text not null default 'pending' check (decision in ('pending', 'published', 'rejected')),
  notes text,
  imported_at timestamptz not null default now()
);

create index place_candidate_venue_decision_idx on public.place_candidate (venue_id, decision);

-- Copies a curated candidate into `place`. Only the owner runs it (dashboard or CLI), never the app.
create function public.publish_place_candidate(
  p_osm_id text,
  p_place_id text,
  p_name_article text,
  p_kind text,
  p_specialty text default null,
  p_price_level smallint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate public.place_candidate;
begin
  select * into candidate from public.place_candidate where osm_id = p_osm_id for update;
  if candidate.osm_id is null then
    raise exception 'place_candidate_not_found' using errcode = 'P0002';
  end if;

  insert into public.place (
    id, name, name_article, kind, venue_id, walking_minutes, distance_m, location,
    source, osm_id, opening_hours, price_level, specialty, attribution
  )
  values (
    p_place_id, candidate.name, p_name_article, p_kind, candidate.venue_id, candidate.walking_minutes,
    candidate.distance_m, candidate.location, 'osm', candidate.osm_id,
    left(candidate.osm_tags ->> 'opening_hours', 200), p_price_level, p_specialty,
    '© contribuidores do OpenStreetMap'
  );

  update public.place_candidate set decision = 'published' where osm_id = p_osm_id;
end;
$$;

revoke execute on function public.publish_place_candidate(text, text, text, text, text, smallint)
  from public, anon, authenticated;

-- Dishes on a place's menu. Fans suggest them; they only show up once approved.
create table public.dish (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.place (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  price_cents integer check (price_cents between 0 and 999999),
  prep_minutes smallint check (prep_minutes between 0 and 120),
  temperature text check (temperature in ('hot', 'cold')),
  is_specialty boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references public.profile (id) on delete set null,
  recommendations_count integer not null default 0 check (recommendations_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dish_place_status_idx on public.dish (place_id, status);
create index dish_submitted_by_idx on public.dish (submitted_by);
-- The same dish is not suggested twice for the same place (rejected suggestions do not block a new one).
create unique index dish_place_name_idx on public.dish (place_id, lower(btrim(name))) where status <> 'rejected';

create trigger dish_set_updated_at
  before update on public.dish
  for each row execute function public.set_updated_at();

-- A suggestion always starts pending, from whoever is signed in, and people cannot flood the moderation queue.
create function public.dish_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  -- The owner (dashboard, service role) inserts approved dishes directly.
  if caller is null then
    return new;
  end if;
  if not public.take_rate_limit(caller, 'dish_suggestion', 20, interval '1 day') then
    raise exception 'dish_suggestion_rate_limited' using errcode = 'P0001';
  end if;
  new.submitted_by := caller;
  new.status := 'pending';
  new.is_specialty := false;
  new.recommendations_count := 0;
  return new;
end;
$$;

revoke execute on function public.dish_before_insert() from public, anon, authenticated;

create trigger dish_before_insert
  before insert on public.dish
  for each row execute function public.dish_before_insert();

-- One recommendation per person per dish. Who recommended what is private; only the count is public.
create table public.dish_recommendation (
  profile_id uuid not null references public.profile (id) on delete cascade,
  dish_id uuid not null references public.dish (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, dish_id)
);

create index dish_recommendation_dish_id_idx on public.dish_recommendation (dish_id);

-- The count lives on the dish and is kept by the server, never sent by the phone.
create function public.dish_recommendation_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.dish set recommendations_count = recommendations_count + 1 where id = new.dish_id;
    return new;
  end if;
  update public.dish set recommendations_count = greatest(recommendations_count - 1, 0) where id = old.dish_id;
  return old;
end;
$$;

revoke execute on function public.dish_recommendation_count() from public, anon, authenticated;

create trigger dish_recommendation_count
  after insert or delete on public.dish_recommendation
  for each row execute function public.dish_recommendation_count();

-- Fans' beer and food scores for a place, next to the overall score from the first slice.
alter table public.place_rating
  add column beer_score smallint check (beer_score between 1 and 5),
  add column food_score smallint check (food_score between 1 and 5);

-- Averages for the places around a stadium, only for places rated by at least 5 people.
create function public.place_scores(p_venue_id text)
returns table (place_id text, ratings integer, score numeric, beer_score numeric, food_score numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.place_id,
    count(*)::integer,
    round(avg(r.score), 1),
    round(avg(r.beer_score), 1),
    round(avg(r.food_score), 1)
  from public.place_rating as r
  join public.place as p on p.id = r.place_id
  where p.venue_id = p_venue_id
  group by r.place_id
  having count(*) >= 5;
$$;

revoke execute on function public.place_scores(text) from public;
grant execute on function public.place_scores(text) to anon, authenticated;

-- Photos of a place, suggested by fans, in the private `place-photos` bucket under the uploader's id.
create table public.place_photo (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.place (id) on delete cascade,
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now()
);

create index place_photo_place_status_idx on public.place_photo (place_id, status);
create index place_photo_submitted_by_idx on public.place_photo (submitted_by);

create function public.place_photo_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    return new;
  end if;
  if new.storage_path not like caller::text || '/%' then
    raise exception 'place_photo_path_not_owned' using errcode = '42501';
  end if;
  if not public.take_rate_limit(caller, 'place_photo', 10, interval '1 day') then
    raise exception 'place_photo_rate_limited' using errcode = 'P0001';
  end if;
  new.submitted_by := caller;
  new.status := 'pending';
  return new;
end;
$$;

revoke execute on function public.place_photo_before_insert() from public, anon, authenticated;

create trigger place_photo_before_insert
  before insert on public.place_photo
  for each row execute function public.place_photo_before_insert();

-- Row level security.
alter table public.place_candidate enable row level security;
alter table public.dish enable row level security;
alter table public.dish_recommendation enable row level security;
alter table public.place_photo enable row level security;

-- place_candidate: no policies at all, so no client can read or write it.

create policy "approved dishes are readable by everyone"
  on public.dish for select to anon, authenticated
  using (status = 'approved');
create policy "people see their own dish suggestions"
  on public.dish for select to authenticated
  using ((select auth.uid()) = submitted_by);
create policy "signed-in people suggest dishes"
  on public.dish for insert to authenticated
  with check (exists (select 1 from public.place as p where p.id = place_id));

create policy "users read their own recommendations"
  on public.dish_recommendation for select to authenticated
  using ((select auth.uid()) = profile_id);
create policy "users recommend approved dishes as themselves"
  on public.dish_recommendation for insert to authenticated
  with check (
    (select auth.uid()) = profile_id
    and exists (select 1 from public.dish as d where d.id = dish_id and d.status = 'approved')
  );
create policy "users remove their own recommendations"
  on public.dish_recommendation for delete to authenticated
  using ((select auth.uid()) = profile_id);

create policy "approved place photos are readable by everyone"
  on public.place_photo for select to anon, authenticated
  using (status = 'approved');
create policy "people see their own place photos"
  on public.place_photo for select to authenticated
  using ((select auth.uid()) = submitted_by);
create policy "signed-in people suggest place photos"
  on public.place_photo for insert to authenticated
  with check (exists (select 1 from public.place as p where p.id = place_id));
create policy "people remove their own pending place photos"
  on public.place_photo for delete to authenticated
  using ((select auth.uid()) = submitted_by and status = 'pending');

-- Privileges.
revoke all on public.place_candidate from anon, authenticated;

revoke all on public.dish from anon, authenticated;
grant select on public.dish to anon, authenticated;
grant insert (place_id, name, price_cents, prep_minutes, temperature) on public.dish to authenticated;

revoke all on public.dish_recommendation from anon, authenticated;
grant select, insert, delete on public.dish_recommendation to authenticated;

revoke all on public.place_photo from anon, authenticated;
grant select on public.place_photo to anon, authenticated;
grant insert (place_id, storage_path) on public.place_photo to authenticated;
grant delete on public.place_photo to authenticated;

grant update (beer_score, food_score) on public.place_rating to authenticated;
grant insert (beer_score, food_score) on public.place_rating to authenticated;

-- Storage: private bucket for place photos, one folder per uploader.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-photos', 'place-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/heic'])
on conflict (id) do nothing;

create policy "people upload place photos to their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'place-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "people read their own place photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'place-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "everyone reads approved place photo files"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'place-photos'
    and exists (select 1 from public.place_photo as ph where ph.storage_path = name and ph.status = 'approved')
  );
create policy "people delete their own place photo files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'place-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
