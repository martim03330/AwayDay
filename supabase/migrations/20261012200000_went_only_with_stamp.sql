-- «Fui a este jogo» only with the stadium stamp (testers' feedback, 2026-10-12).
--
-- The stamp (`stamp_stadium`) checks on the server that the phone is within 1 km of the stadium around kick-off; it
-- writes `stadium_visit` and marks the attendance as 'attended'. But the app could also write 'attended' itself (it
-- did when rating a game), and rating was open to anyone after kick-off. So saying «Vou» and rating a game was enough
-- to count as having gone, and the passport showed the stadium as stamped.
--
-- From now on:
-- 1. The app can only write 'going' (before kick-off). Only `stamp_stadium` (security definer, so past these
--    policies) can set 'attended'.
-- 2. A game can only be rated by whoever stamped it.
-- 3. The 'attended' rows that have no stamp go back to 'going'. Ratings already made stay (they never counted for
--    points: the ranking only reads `stadium_visit`), but no new ones without a stamp.

drop policy "users add their own attendance" on public.fixture_attendance;
drop policy "users change their own attendance" on public.fixture_attendance;

create policy "users add their own attendance"
  on public.fixture_attendance for insert to authenticated
  with check (
    (select auth.uid()) = profile_id
    and status = 'going'
    and exists (select 1 from public.fixture as f where f.id = fixture_id and f.kickoff_at > now())
  );
create policy "users change their own attendance"
  on public.fixture_attendance for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check (
    (select auth.uid()) = profile_id
    and status = 'going'
    and exists (select 1 from public.fixture as f where f.id = fixture_id and f.kickoff_at > now())
  );

/** Whether the caller stamped this game (the table itself is closed to the app). */
create function public.stamped_fixture(p_fixture_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stadium_visit as v where v.profile_id = auth.uid() and v.fixture_id = p_fixture_id
  );
$$;

revoke execute on function public.stamped_fixture(text) from public, anon;
grant execute on function public.stamped_fixture(text) to authenticated;

drop policy "users review fixtures that have started" on public.venue_review;
drop policy "users change their own reviews" on public.venue_review;

create policy "users review fixtures they stamped"
  on public.venue_review for insert to authenticated
  with check (
    (select auth.uid()) = profile_id
    and public.stamped_fixture(fixture_id)
  );
create policy "users change their own reviews"
  on public.venue_review for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check (
    (select auth.uid()) = profile_id
    and public.stamped_fixture(fixture_id)
  );

-- Supports the policies above (one lookup per review).
create index if not exists stadium_visit_profile_fixture_idx on public.stadium_visit (profile_id, fixture_id);

-- «Went» without a stamp: back to «going».
update public.fixture_attendance as a
set status = 'going'
where a.status = 'attended'
  and not exists (
    select 1 from public.stadium_visit as v where v.profile_id = a.profile_id and v.fixture_id = a.fixture_id
  );
