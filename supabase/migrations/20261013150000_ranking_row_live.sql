-- The points table shows anyone's new points at once, not up to 5 minutes later (owner's request, 2026-10-13).
-- Whenever something that earns points changes (a stamp, a check-in, a rating, a review, a photo, a dish, a mission
-- photo), that person's line in `ranking_cache` is worked out again on the spot. The 5-minute refresh stays as a
-- safety net (weekly challenges, season changes, new accounts).

create function public.refresh_ranking_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pessoa uuid := coalesce(to_jsonb(new) ->> tg_argv[0], to_jsonb(old) ->> tg_argv[0])::uuid;
  season text := public.current_season_id();
begin
  if pessoa is null or not exists (select 1 from public.profile where id = pessoa) then
    return null;
  end if;
  insert into public.ranking_cache (profile_id, season_id, total_xp, season_xp, division, refreshed_at)
  select pessoa, season, coalesce(t.total_xp, 0), coalesce(t.season_xp, 0), public.ranking_division(pessoa, season), now()
  from (select 1) as uma
  left join public.ranking_totals(pessoa, season) as t on true
  on conflict (profile_id) do update
    set season_id = excluded.season_id,
        total_xp = excluded.total_xp,
        season_xp = excluded.season_xp,
        division = excluded.division,
        refreshed_at = excluded.refreshed_at;
  return null;
end;
$$;

revoke execute on function public.refresh_ranking_row() from public, anon, authenticated;

create trigger stadium_visit_refreshes_ranking
  after insert or update or delete on public.stadium_visit
  for each row execute function public.refresh_ranking_row('profile_id');

create trigger place_visit_refreshes_ranking
  after insert or update or delete on public.place_visit
  for each row execute function public.refresh_ranking_row('profile_id');

create trigger place_rating_refreshes_ranking
  after insert or update or delete on public.place_rating
  for each row execute function public.refresh_ranking_row('profile_id');

create trigger venue_review_refreshes_ranking
  after insert or update or delete on public.venue_review
  for each row execute function public.refresh_ranking_row('profile_id');

create trigger place_photo_refreshes_ranking
  after insert or update or delete on public.place_photo
  for each row execute function public.refresh_ranking_row('submitted_by');

create trigger dish_recommendation_refreshes_ranking
  after insert or update or delete on public.dish_recommendation
  for each row execute function public.refresh_ranking_row('profile_id');

create trigger mission_photo_refreshes_ranking
  after insert or update or delete on public.mission_photo
  for each row execute function public.refresh_ranking_row('profile_id');
