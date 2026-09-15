-- European fixtures (first version: Liga Portugal and the European competitions only).
-- Some clubs play their UEFA home games away from their usual ground (e.g. clubs from countries at war, or stadiums
-- that fail UEFA criteria). The fixtures sync uses this venue for European home games when it is set.
alter table public.club
  add column european_venue_id text references public.venue (id) on delete set null;

create index club_european_venue_id_idx on public.club (european_venue_id);
