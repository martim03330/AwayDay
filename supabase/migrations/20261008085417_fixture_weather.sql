-- The real weather at kick-off, instead of the simulated one. The Edge Function sync-weather reads free sources (IPMA
-- in Portugal, MET Norway abroad; no keys) and caches one forecast per fixture here. pg_cron calls it every hour with
-- the shared secret from Vault, like sync-fixtures. The same run sends the "take a raincoat" push about 3 hours before
-- kick-off to who is going, once per person and game (weather_notice).

create table public.fixture_weather (
  fixture_id text primary key references public.fixture (id) on delete cascade,
  source text not null check (source in ('ipma', 'met_norway')),
  -- The forecast slot used (the one nearest kick-off).
  forecast_for timestamptz not null,
  condition text not null check (condition in ('sunny', 'clear', 'cloudy', 'showers', 'rain')),
  temperature_c smallint not null check (temperature_c between -40 and 60),
  -- Null when the source has none (MET Norway outside the Nordic countries).
  rain_probability smallint check (rain_probability between 0 and 100),
  wind_kmh smallint not null check (wind_kmh between 0 and 300),
  -- The strongest IPMA warning for the stadium's area around kick-off (yellow, orange or red), if any.
  warning_level text check (warning_level in ('yellow', 'orange', 'red')),
  warning_kind text check (char_length(warning_kind) between 1 and 60),
  updated_at timestamptz not null default now(),
  check ((warning_level is null) = (warning_kind is null))
);

alter table public.fixture_weather enable row level security;

create policy "fixture weather is readable by everyone"
  on public.fixture_weather for select to anon, authenticated using (true);

revoke all on public.fixture_weather from anon, authenticated;
grant select on public.fixture_weather to anon, authenticated;

-- Who already got the weather push for a game. Only the Edge Function reads and writes it.
create table public.weather_notice (
  profile_id uuid not null references public.profile (id) on delete cascade,
  fixture_id text not null references public.fixture (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (profile_id, fixture_id)
);

create index weather_notice_fixture_id_idx on public.weather_notice (fixture_id);

alter table public.weather_notice enable row level security;
-- No policies: no client role reaches it.
revoke all on public.weather_notice from anon, authenticated;

select cron.schedule(
  'sync-weather-hourly',
  '25 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/sync-weather',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
