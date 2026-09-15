-- European fixtures of Portuguese clubs, 2026-27 (first version of the app: Liga Portugal + European competitions).
-- Apply with: supabase db query --linked -f supabase/seed/08_europa_2026_27.sql (upserts, safe to run again).
--
-- - Champions League: fixtures come from the sync (football-data.org). Here only the opponents, matched by
--   football_data_id, and the stadiums where Porto and Sporting play away.
-- - Europa League and Conference League are not in the free API: their fixtures are here, by hand.
--   Sources (checked 2026-09-15): uefa.com fixture lists, Record, RTP, club sites. Times in UTC.
-- - Stadiums: Wikidata (coordinates, capacity). Venues used this season: Betis at La Cartuja (Villamarín being rebuilt),
--   Shakhtar at Stamford Bridge (subject to UEFA approval), Torreense at Leiria (its ground fails UEFA criteria).
-- - Club colours are approximate (kit colours), not official brand colours. Ararat-Armenia uses neutral colours.
-- - Clubs that only visit Portugal have no stadium here (home_venue_id null).

-- Stadiums abroad that host a Portuguese club.
insert into public.venue (id, name, name_article, city, country, region, capacity, location)
values
  ('bollaert-delelis', 'Stade Bollaert-Delelis', 'o', 'Lens', 'França', 'abroad', 38223, extensions.st_setsrid(extensions.st_makepoint(2.8149, 50.4329), 4326)::extensions.geography),
  ('la-cartuja', 'Estadio de La Cartuja', 'o', 'Sevilha', 'Espanha', 'abroad', 70000, extensions.st_setsrid(extensions.st_makepoint(-6.0046, 37.4172), 4326)::extensions.geography),
  ('stamford-bridge', 'Stamford Bridge', '', 'Londres', 'Inglaterra', 'abroad', 41875, extensions.st_setsrid(extensions.st_makepoint(-0.1911, 51.4817), 4326)::extensions.geography),
  ('de-kuip', 'De Kuip', 'o', 'Roterdão', 'Países Baixos', 'abroad', 51577, extensions.st_setsrid(extensions.st_makepoint(4.5233, 51.8939), 4326)::extensions.geography),
  ('anfield', 'Anfield', '', 'Liverpool', 'Inglaterra', 'abroad', 61276, extensions.st_setsrid(extensions.st_makepoint(-2.9608, 53.4308), 4326)::extensions.geography),
  ('etihad', 'Etihad Stadium', 'o', 'Manchester', 'Inglaterra', 'abroad', 52900, extensions.st_setsrid(extensions.st_makepoint(-2.2003, 53.4831), 4326)::extensions.geography),
  ('raiffeisen-arena-linz', 'Raiffeisen Arena', 'a', 'Linz', 'Áustria', 'abroad', 19080, extensions.st_setsrid(extensions.st_makepoint(14.2766, 48.2937), 4326)::extensions.geography),
  ('san-siro', 'San Siro', 'o', 'Milão', 'Itália', 'abroad', 75817, extensions.st_setsrid(extensions.st_makepoint(9.1239, 45.4781), 4326)::extensions.geography),
  ('gsp-nicosia', 'GSP Stadium', 'o', 'Nicósia', 'Chipre', 'abroad', 22709, extensions.st_setsrid(extensions.st_makepoint(33.3629, 35.1145), 4326)::extensions.geography),
  ('doosan-arena', 'Doosan Arena', 'a', 'Plzeň', 'Chéquia', 'abroad', 11700, extensions.st_setsrid(extensions.st_makepoint(13.3856, 49.7500), 4326)::extensions.geography),
  ('de-goffert', 'Stadion de Goffert', 'o', 'Nijmegen', 'Países Baixos', 'abroad', 12500, extensions.st_setsrid(extensions.st_makepoint(5.8367, 51.8225), 4326)::extensions.geography),
  ('arasen', 'Åråsen Stadion', 'o', 'Lillestrøm', 'Noruega', 'abroad', 12250, extensions.st_setsrid(extensions.st_makepoint(11.0635, 59.9628), 4326)::extensions.geography),
  ('groupama-arena', 'Groupama Aréna', 'a', 'Budapeste', 'Hungria', 'abroad', 22122, extensions.st_setsrid(extensions.st_makepoint(19.0961, 47.4753), 4326)::extensions.geography),
  ('reale-arena', 'Reale Arena', 'a', 'San Sebastián', 'Espanha', 'abroad', 40000, extensions.st_setsrid(extensions.st_makepoint(-1.9736, 43.3014), 4326)::extensions.geography),
  ('enea-stadion', 'Enea Stadion', 'o', 'Poznań', 'Polónia', 'abroad', 42873, extensions.st_setsrid(extensions.st_makepoint(16.8581, 52.3972), 4326)::extensions.geography),
  ('parken', 'Parken', 'o', 'Copenhaga', 'Dinamarca', 'abroad', 38065, extensions.st_setsrid(extensions.st_makepoint(12.5722, 55.7025), 4326)::extensions.geography),
  ('ceres-park', 'Ceres Park', 'o', 'Aarhus', 'Dinamarca', 'abroad', 19433, extensions.st_setsrid(extensions.st_makepoint(10.1964, 56.1319), 4326)::extensions.geography),
  ('brann-stadion', 'Brann Stadion', 'o', 'Bergen', 'Noruega', 'abroad', 16750, extensions.st_setsrid(extensions.st_makepoint(5.3569, 60.3664), 4326)::extensions.geography)
on conflict (id) do update set
  name = excluded.name,
  name_article = excluded.name_article,
  city = excluded.city,
  country = excluded.country,
  region = excluded.region,
  capacity = excluded.capacity,
  location = excluded.location;

-- Opponents. football_data_id only for Champions League clubs (the sync matches them by it).
insert into public.club (id, name, short_name, abbreviation, country, primary_color, secondary_color, tier, home_venue_id, football_data_id)
values
  ('lens', 'Racing Club de Lens', 'Lens', 'RCL', 'França', '#EE2A24', '#FFD100', null, 'bollaert-delelis', 546),
  ('betis', 'Real Betis Balompié', 'Betis', 'BET', 'Espanha', '#359B5C', '#FFFFFF', null, 'la-cartuja', 90),
  ('shakhtar', 'FC Shakhtar Donetsk', 'Shakhtar Donetsk', 'SHA', 'Ucrânia', '#FD7D28', '#000000', null, 'stamford-bridge', 1887),
  ('feyenoord', 'Feyenoord Rotterdam', 'Feyenoord', 'FEY', 'Países Baixos', '#E4002B', '#FFFFFF', null, 'de-kuip', 675),
  ('liverpool', 'Liverpool Football Club', 'Liverpool', 'LIV', 'Inglaterra', '#C8102E', '#FFFFFF', null, 'anfield', 64),
  ('man-city', 'Manchester City Football Club', 'Manchester City', 'MCI', 'Inglaterra', '#6CABDD', '#FFFFFF', null, 'etihad', 65),
  ('lask', 'Linzer Athletik-Sport-Klub', 'LASK', 'LAS', 'Áustria', '#000000', '#FFFFFF', null, 'raiffeisen-arena-linz', 2016),
  ('galatasaray', 'Galatasaray Spor Kulübü', 'Galatasaray', 'GAL', 'Turquia', '#A90432', '#FDB912', null, null, 610),
  ('psv', 'PSV Eindhoven', 'PSV Eindhoven', 'PSV', 'Países Baixos', '#E4002B', '#FFFFFF', null, null, 674),
  ('napoles', 'Società Sportiva Calcio Napoli', 'Nápoles', 'NAP', 'Itália', '#12A0D7', '#FFFFFF', null, null, 113),
  ('man-united', 'Manchester United Football Club', 'Manchester United', 'MUN', 'Inglaterra', '#DA291C', '#FFFFFF', null, null, 66),
  ('slavia-praga', 'SK Slavia Praha', 'Slavia Praga', 'SLA', 'Chéquia', '#C8102E', '#FFFFFF', null, null, 930),
  ('barcelona', 'Futbol Club Barcelona', 'Barcelona', 'FCB', 'Espanha', '#A50044', '#004D98', null, null, 81),
  ('milan', 'Associazione Calcio Milan', 'Milan', 'MIL', 'Itália', '#FB090B', '#000000', null, 'san-siro', null),
  ('omonia', 'AC Omonia Nicosia', 'Omonia', 'OMO', 'Chipre', '#00843D', '#FFFFFF', null, 'gsp-nicosia', null),
  ('viktoria-plzen', 'FC Viktoria Plzeň', 'Viktoria Plzeň', 'PLZ', 'Chéquia', '#E30613', '#0055A5', null, 'doosan-arena', null),
  ('nec', 'Nijmegen Eendracht Combinatie', 'NEC', 'NEC', 'Países Baixos', '#E30613', '#000000', null, 'de-goffert', null),
  ('lillestrom', 'Lillestrøm Sportsklubb', 'Lillestrøm', 'LSK', 'Noruega', '#FFDD00', '#000000', null, 'arasen', null),
  ('ferencvaros', 'Ferencvárosi Torna Club', 'Ferencváros', 'FTC', 'Hungria', '#00843D', '#FFFFFF', null, 'groupama-arena', null),
  ('real-sociedad', 'Real Sociedad de Fútbol', 'Real Sociedad', 'RSO', 'Espanha', '#0067B1', '#FFFFFF', null, 'reale-arena', null),
  ('lech-poznan', 'KKS Lech Poznań', 'Lech Poznań', 'LPO', 'Polónia', '#004C9E', '#FFFFFF', null, 'enea-stadion', null),
  ('copenhaga', 'FC København', 'Copenhaga', 'FCK', 'Dinamarca', '#FFFFFF', '#00297A', null, 'parken', null),
  ('aarhus', 'Aarhus Gymnastikforening', 'Aarhus', 'AGF', 'Dinamarca', '#FFFFFF', '#191C51', null, 'ceres-park', null),
  ('brann', 'Sportsklubben Brann', 'Brann', 'BRA', 'Noruega', '#E30613', '#FFFFFF', null, 'brann-stadion', null),
  ('celtic', 'The Celtic Football Club', 'Celtic', 'CEL', 'Escócia', '#018749', '#FFFFFF', null, null, null),
  ('ofi-creta', 'OFI Crete FC', 'OFI Creta', 'OFI', 'Grécia', '#000000', '#FFFFFF', null, null, null),
  ('az-alkmaar', 'AZ Alkmaar', 'AZ Alkmaar', 'AZ', 'Países Baixos', '#E30613', '#FFFFFF', null, null, null),
  ('sunderland', 'Sunderland Association Football Club', 'Sunderland', 'SUN', 'Inglaterra', '#EB172B', '#FFFFFF', null, null, null),
  ('ararat-armenia', 'FC Ararat-Armenia', 'Ararat-Armenia', 'ARA', 'Arménia', '#6B7280', '#FFFFFF', null, null, null),
  ('olympiacos', 'Olympiacos CFP', 'Olympiacos', 'OLY', 'Grécia', '#D71920', '#FFFFFF', null, null, null),
  ('gent', 'KAA Gent', 'Gent', 'GEN', 'Bélgica', '#0023DD', '#FFFFFF', null, null, null),
  ('kups', 'Kuopion Palloseura', 'KuPS', 'KUP', 'Finlândia', '#FFDD00', '#000000', null, null, null),
  ('egnatia', 'KF Egnatia', 'Egnatia', 'EGN', 'Albânia', '#00792B', '#000000', null, null, null)
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  abbreviation = excluded.abbreviation,
  country = excluded.country,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  tier = excluded.tier,
  home_venue_id = excluded.home_venue_id,
  football_data_id = excluded.football_data_id;

-- Roma already exists (Stadio Olimpico).
update public.club set football_data_id = 100 where id = 'roma';

-- Torreense plays its UEFA home games in Leiria.
update public.club set european_venue_id = 'magalhaes-pessoa' where id = 'torreense';

-- Europa League and Conference League fixtures, by hand. Venue per game.
insert into public.fixture (id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at, kickoff_confirmed, season_id)
select f.home || '-' || f.away || '-' || f.competition || '-2026-27', f.competition, 'Fase de liga · Jornada ' || f.matchday,
  f.home, f.away, coalesce(f.venue, c.home_venue_id), f.kickoff::timestamptz, true, '2026-27'
from (values
  -- Benfica, Liga Europa
  ('liga-europa', 1, 'milan', 'benfica', 'san-siro', '2026-09-16T19:00:00Z'),
  ('liga-europa', 2, 'benfica', 'celtic', null, '2026-10-15T19:00:00Z'),
  ('liga-europa', 3, 'omonia', 'benfica', 'gsp-nicosia', '2026-10-22T19:00:00Z'),
  ('liga-europa', 4, 'benfica', 'lech-poznan', null, '2026-11-05T20:00:00Z'),
  ('liga-europa', 5, 'viktoria-plzen', 'benfica', 'doosan-arena', '2026-11-26T17:45:00Z'),
  ('liga-europa', 6, 'benfica', 'ofi-creta', null, '2026-12-10T20:00:00Z'),
  ('liga-europa', 7, 'nec', 'benfica', 'de-goffert', '2027-01-21T17:45:00Z'),
  ('liga-europa', 8, 'benfica', 'az-alkmaar', null, '2027-01-28T20:00:00Z'),
  -- Torreense, Liga Europa (home games in Leiria)
  ('liga-europa', 1, 'lillestrom', 'torreense', 'arasen', '2026-09-17T19:00:00Z'),
  ('liga-europa', 2, 'torreense', 'sunderland', 'magalhaes-pessoa', '2026-10-15T16:45:00Z'),
  ('liga-europa', 3, 'ferencvaros', 'torreense', 'groupama-arena', '2026-10-22T16:45:00Z'),
  ('liga-europa', 4, 'torreense', 'ararat-armenia', 'magalhaes-pessoa', '2026-11-05T20:00:00Z'),
  ('liga-europa', 5, 'torreense', 'celtic', 'magalhaes-pessoa', '2026-11-26T20:00:00Z'),
  ('liga-europa', 6, 'real-sociedad', 'torreense', 'reale-arena', '2026-12-10T20:00:00Z'),
  ('liga-europa', 7, 'lech-poznan', 'torreense', 'enea-stadion', '2027-01-21T20:00:00Z'),
  ('liga-europa', 8, 'torreense', 'olympiacos', 'magalhaes-pessoa', '2027-01-28T20:00:00Z'),
  -- Braga, Liga Conferência
  ('conference', 1, 'copenhaga', 'braga', 'parken', '2026-10-15T19:00:00Z'),
  ('conference', 2, 'braga', 'gent', null, '2026-10-22T19:00:00Z'),
  ('conference', 3, 'aarhus', 'braga', 'ceres-park', '2026-11-05T17:45:00Z'),
  ('conference', 4, 'braga', 'kups', null, '2026-11-26T20:00:00Z'),
  ('conference', 5, 'brann', 'braga', 'brann-stadion', '2026-12-10T17:45:00Z'),
  ('conference', 6, 'braga', 'egnatia', null, '2026-12-17T20:00:00Z')
) as f (competition, matchday, home, away, venue, kickoff)
join public.club as c on c.id = f.home
on conflict (id) do update set
  stage = excluded.stage,
  venue_id = excluded.venue_id,
  kickoff_at = excluded.kickoff_at,
  kickoff_confirmed = excluded.kickoff_confirmed,
  season_id = excluded.season_id;
