-- Places from OpenStreetMap show up right away as suggestions ("Por confirmar"), and fans decide whether each one is
-- a good place for match day. Places the owner publishes by hand are confirmed from the start.
-- - Quick and cheap places (cafés, snack bars, tascas, bars) are flagged and ranked first.
-- - Votes: at least 5 answers and twice as many on one side confirm or hide a suggestion.
-- - The coach only ever suggests confirmed places.

alter table public.place
  add column confirmation text not null default 'confirmed'
    check (confirmation in ('suggested', 'confirmed', 'rejected')),
  add column quick_and_cheap boolean not null default false,
  -- Ranking hint for suggestions, from OSM tags and the name. Higher first.
  add column suitability smallint not null default 0,
  add column votes_yes integer not null default 0 check (votes_yes >= 0),
  add column votes_no integer not null default 0 check (votes_no >= 0);

create index place_venue_confirmation_idx on public.place (venue_id, confirmation);

-- Rejected places disappear for everyone.
drop policy "place is readable by everyone" on public.place;
create policy "places not rejected are readable by everyone"
  on public.place for select to anon, authenticated
  using (confirmation <> 'rejected');

-- "Is this a good place for match day?" One answer per person per place, which they can change.
create table public.place_vote (
  profile_id uuid not null references public.profile (id) on delete cascade,
  place_id text not null references public.place (id) on delete cascade,
  is_good boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, place_id)
);

create index place_vote_place_id_idx on public.place_vote (place_id);

create trigger place_vote_set_updated_at
  before update on public.place_vote
  for each row execute function public.set_updated_at();

-- Recounts a place's votes and, while it is still a suggestion, confirms or hides it.
create function public.place_vote_recount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target text := coalesce(new.place_id, old.place_id);
  yes_count integer;
  no_count integer;
begin
  select count(*) filter (where v.is_good), count(*) filter (where not v.is_good)
    into yes_count, no_count
  from public.place_vote as v
  where v.place_id = target;

  update public.place as p
  set
    votes_yes = yes_count,
    votes_no = no_count,
    confirmation = case
      when p.confirmation <> 'suggested' then p.confirmation
      when yes_count >= 5 and yes_count >= 2 * no_count then 'confirmed'
      when no_count >= 5 and no_count >= 2 * yes_count then 'rejected'
      else 'suggested'
    end
  where p.id = target;

  return null;
end;
$$;

revoke execute on function public.place_vote_recount() from public, anon, authenticated;

create trigger place_vote_recount
  after insert or update or delete on public.place_vote
  for each row execute function public.place_vote_recount();

alter table public.place_vote enable row level security;

create policy "users read their own place votes"
  on public.place_vote for select to authenticated
  using ((select auth.uid()) = profile_id);
create policy "users vote on suggestions as themselves"
  on public.place_vote for insert to authenticated
  with check (
    (select auth.uid()) = profile_id
    and exists (select 1 from public.place as p where p.id = place_id and p.confirmation = 'suggested')
  );
create policy "users change their own votes on suggestions"
  on public.place_vote for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check (
    (select auth.uid()) = profile_id
    and exists (select 1 from public.place as p where p.id = place_id and p.confirmation = 'suggested')
  );
create policy "users remove their own place votes"
  on public.place_vote for delete to authenticated
  using ((select auth.uid()) = profile_id);

revoke all on public.place_vote from anon, authenticated;
grant select, insert, update, delete on public.place_vote to authenticated;

-- Copies every pending OSM candidate into `place` as a suggestion. Only the owner runs it (dashboard or CLI).
-- Safe to run again: candidates already in `place` are skipped. Returns how many suggestions were added.
create function public.suggest_place_candidates()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  added integer;
begin
  with pending as (
    select
      c.*,
      lower(coalesce(c.osm_tags ->> 'amenity', '')) as amenity,
      lower(coalesce(c.osm_tags ->> 'cuisine', '')) as cuisine
    from public.place_candidate as c
    where c.decision = 'pending'
      and not exists (select 1 from public.place as p where p.osm_id = c.osm_id)
  ),
  scored as (
    select
      pending.*,
      pending.name ~* '(tasca|taberna|tasquinha|snack|bifana|petisc|sandes|cervejaria|churrasqueira|roulotte|rulote)'
        as tasco_name,
      pending.cuisine ~ '(sushi|japanese|chinese|italian|mexican|asian|steak_house|seafood|ice_cream|indian|thai)'
        as unlikely_cuisine,
      left(
        coalesce(
          nullif(
            trim(both '-' from regexp_replace(
              lower(translate(
                pending.name,
                'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
                'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
              )),
              '[^a-z0-9]+', '-', 'g'
            )),
            ''
          ),
          'tasco'
        ),
        40
      ) as slug
    from pending
  ),
  inserted as (
    insert into public.place (
      id, name, name_article, kind, venue_id, walking_minutes, distance_m, location,
      source, osm_id, opening_hours, attribution, confirmation, quick_and_cheap, suitability
    )
    select
      trim(both '-' from s.slug) || '-' || left(md5(s.osm_id), 4),
      s.name,
      case
        when s.name ~* '^(tasca|taberna|tasquinha|cervejaria|churrasqueira|pastelaria|casa|adega|marisqueira|pizzaria|hamburgueria|leitaria|padaria|confeitaria|cafetaria|roulotte|rulote)\M' then 'a'
        when s.name ~* '^(café|cafe|restaurante|bar|snack|pub|quiosque|bistro|cantinho|recanto)\M' then 'o'
        else ''
      end,
      coalesce(s.suggested_kind, 'restaurante'),
      s.venue_id,
      s.walking_minutes,
      s.distance_m,
      s.location,
      'osm',
      s.osm_id,
      left(s.osm_tags ->> 'opening_hours', 200),
      '© contribuidores do OpenStreetMap',
      'suggested',
      not s.unlikely_cuisine and (
        s.amenity in ('cafe', 'fast_food', 'bar', 'pub')
        or s.tasco_name
        or s.cuisine ~ '(snack|sandwich|kebab|burger|petisc|coffee_shop)'
      ),
      (case when s.tasco_name then 4 else 0 end)
        + (case s.amenity when 'fast_food' then 3 when 'cafe' then 3 when 'bar' then 2 when 'pub' then 2 else 1 end)
        + (case when s.cuisine ~ '(regional|portuguese|barbecue|petisc|snack|sandwich)' then 1 else 0 end)
        - (case when s.unlikely_cuisine then 3 else 0 end)
    from scored as s
    on conflict (id) do nothing
    returning osm_id
  )
  update public.place_candidate as c
  set decision = 'published'
  from inserted
  where c.osm_id = inserted.osm_id;

  get diagnostics added = row_count;
  return added;
end;
$$;

revoke execute on function public.suggest_place_candidates() from public, anon, authenticated;

-- The owner's shortcuts, whatever the votes say.
create function public.confirm_place(p_place_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.place set confirmation = 'confirmed' where id = p_place_id;
$$;

create function public.reject_place(p_place_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.place set confirmation = 'rejected' where id = p_place_id;
$$;

revoke execute on function public.confirm_place(text) from public, anon, authenticated;
revoke execute on function public.reject_place(text) from public, anon, authenticated;

-- The coach only suggests places fans (or the owner) confirmed.
create or replace function public.coach_nearby_place(p_venue_id text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('name', pl.name, 'article', pl.name_article, 'walking_minutes', pl.walking_minutes)
  from public.place as pl
  where pl.venue_id = p_venue_id and pl.walking_minutes <= 10 and pl.confirmation = 'confirmed'
  order by pl.walking_minutes, pl.id
  limit 1;
$$;
