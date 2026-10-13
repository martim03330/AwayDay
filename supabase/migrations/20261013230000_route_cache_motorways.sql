-- Every motorway a cached route takes, in driving order, free ones included ("A13", "A23", "A1"): the ride quote
-- names the cheaper road by them, and the A13 between Coimbra and Atalaia (free since 2025) has no toll segment to be
-- named by. Only the Edge Function (service role) reads and writes this table.
alter table public.route_cache add column motorways text[] not null default '{}';
