-- Testers' accounts created before the offensive-name filter (20261012170000) kept their names. Owner's request,
-- 2026-10-12: replace them with neutral names. The ride expense copied the driver's name into its description.
-- Matched by id, so it only touches these rows; the triggers would refuse the old names from now on anyway.

update public.profile set display_name = 'Utilizador' where id = '5259d9b5-8028-4c03-b10d-dea7866e9a8a';
update public.fan_group set name = 'Grupo' where id = 'b0cc9968-7e54-4fbb-850d-b0edf5c21faf';
update public.trip_expense set description = 'Boleia de Utilizador' where id = '8e1145a0-521a-46b6-ad6d-c70ee6eacb36';
