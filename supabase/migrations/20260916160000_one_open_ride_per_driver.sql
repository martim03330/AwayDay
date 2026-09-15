-- A driver offers at most one open ride per game: a second offer makes no sense and would split the passengers.
-- Cancelled rides do not count, so cancelling and offering again still works.
create unique index ride_one_open_per_driver_idx
  on public.ride (fixture_id, driver_id)
  where status = 'open';
