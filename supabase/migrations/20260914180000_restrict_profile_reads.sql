-- Profiles and clubs are readable only by their owner. Before, any signed-in user could list every profile (name,
-- message preferences) and every supporter club. That also gave the exact number of supporters per club and got
-- around the 5-person minimum of club_supporter_counts(). The app only ever reads the signed-in user's own rows.

drop policy "profiles are readable by signed-in users" on public.profile;
create policy "users read their own profile"
  on public.profile for select to authenticated
  using ((select auth.uid()) = id);

drop policy "supporter clubs are readable by signed-in users, hometown clubs only by their owner"
  on public.profile_club;
create policy "users read their own clubs"
  on public.profile_club for select to authenticated
  using ((select auth.uid()) = profile_id);
