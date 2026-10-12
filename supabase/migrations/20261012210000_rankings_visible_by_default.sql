-- Everyone appears in the rankings by default (Martim's decision, 2026-10-12): with the opt-in off by default, 13 of
-- 14 accounts were hidden and the tables looked empty to the testers. What shows is the name, level, club and points,
-- never a location. Anyone can turn it off in Settings → Privacy (right to object); the privacy policy says so.

alter table public.profile alter column show_in_rankings set default true;
update public.profile set show_in_rankings = true where not show_in_rankings;
