-- Fans' averages for every place in one call, for the places catalogue. Same rule as place_scores: a place only
-- appears once at least 5 people rated it. Individual ratings stay private.
create function public.place_scores_all()
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
  group by r.place_id
  having count(*) >= 5;
$$;

revoke execute on function public.place_scores_all() from public;
grant execute on function public.place_scores_all() to anon, authenticated;
