-- 1. Places inside shopping centres are hidden: a food court is not where fans meet before a game. They are rejected
--    with a reason, so a later import does not bring them back and we know why they are gone.
-- 2. Places researched on the web (newspapers, fan forums, ground guides) keep the reason fans go there and the pages
--    that say so. Nothing is shown without a source.
-- 3. "Does this tasco have a toilet for customers?" OpenStreetMap almost never says, so fans answer, one answer per
--    person per place, and the app shows the counts.

alter table public.place
  add column rejection_reason text check (rejection_reason in ('shopping_centre')),
  add column matchday_note text check (char_length(matchday_note) between 1 and 240),
  add column matchday_sources jsonb not null default '[]'::jsonb
    check (jsonb_typeof(matchday_sources) = 'array'),
  -- A home supporters' spot, from the research: away fans may want to avoid it. Null when unknown.
  add column home_fans_heavy boolean,
  add column toilet_yes integer not null default 0 check (toilet_yes >= 0),
  add column toilet_no integer not null default 0 check (toilet_no >= 0),
  add constraint place_rejection_reason_only_when_rejected
    check (rejection_reason is null or confirmation = 'rejected'),
  add constraint place_matchday_note_has_sources
    check (matchday_note is null or jsonb_array_length(matchday_sources) > 0);

create table public.place_toilet_answer (
  profile_id uuid not null references public.profile (id) on delete cascade,
  place_id text not null references public.place (id) on delete cascade,
  has_toilet boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, place_id)
);

create index place_toilet_answer_place_id_idx on public.place_toilet_answer (place_id);

create trigger place_toilet_answer_set_updated_at
  before update on public.place_toilet_answer
  for each row execute function public.set_updated_at();

-- Keeps the place's counts in step with the answers.
create function public.place_toilet_recount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target text := coalesce(new.place_id, old.place_id);
begin
  update public.place as p
  set
    toilet_yes = (select count(*) from public.place_toilet_answer as a where a.place_id = target and a.has_toilet),
    toilet_no = (select count(*) from public.place_toilet_answer as a where a.place_id = target and not a.has_toilet)
  where p.id = target;
  return null;
end;
$$;

revoke execute on function public.place_toilet_recount() from public, anon, authenticated;

create trigger place_toilet_recount
  after insert or update or delete on public.place_toilet_answer
  for each row execute function public.place_toilet_recount();

alter table public.place_toilet_answer enable row level security;

create policy "users read their own toilet answers"
  on public.place_toilet_answer for select to authenticated
  using ((select auth.uid()) = profile_id);
create policy "users answer about visible places as themselves"
  on public.place_toilet_answer for insert to authenticated
  with check (
    (select auth.uid()) = profile_id
    and exists (select 1 from public.place as p where p.id = place_id and p.confirmation <> 'rejected')
  );
create policy "users change their own toilet answers"
  on public.place_toilet_answer for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);
create policy "users remove their own toilet answers"
  on public.place_toilet_answer for delete to authenticated
  using ((select auth.uid()) = profile_id);

revoke all on public.place_toilet_answer from anon, authenticated;
grant select, insert, update, delete on public.place_toilet_answer to authenticated;
