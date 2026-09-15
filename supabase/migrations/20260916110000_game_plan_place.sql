-- "O meu jogo": the tasco a fan picked for a game they are going to. Lives with the attendance row, so it follows the
-- same rules (own rows only; "going" only before kick-off). Picking a tasco never creates a check-in or a visit.
alter table public.fixture_attendance
  add column place_id text references public.place (id) on delete set null;

create index fixture_attendance_place_id_idx on public.fixture_attendance (place_id);
