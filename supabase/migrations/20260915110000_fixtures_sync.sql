-- Real fixtures from football-data.org (Primeira Liga on the free plan). The Edge Function sync-fixtures calls the
-- API (the key only lives in the function's secrets) and caches the fixtures in public.fixture. pg_cron calls it every
-- 6 hours with the shared secret from Vault, like generate-nudges.

-- Which football-data.org team each club is. Filled for the 2026-27 Primeira Liga.
alter table public.club add column football_data_id integer unique;

-- football-data.org gives a provisional date for fixtures whose kick-off is not set yet.
alter table public.fixture add column kickoff_confirmed boolean not null default true;

update public.club as c
set football_data_id = m.football_data_id
from (values
  ('academico-viseu', 5527),
  ('alverca', 7822),
  ('estrela', 9136),
  ('arouca', 712),
  ('braga', 5613),
  ('nacional', 5529),
  ('casa-pia', 6618),
  ('estoril', 582),
  ('famalicao', 5531),
  ('gil-vicente', 5533),
  ('maritimo', 5575),
  ('moreirense', 583),
  ('porto', 503),
  ('rio-ave', 496),
  ('benfica', 1903),
  ('santa-clara', 5530),
  ('sporting', 498),
  ('vitoria', 5543)
) as m(id, football_data_id)
where c.id = m.id;

select cron.schedule(
  'sync-fixtures-every-6-hours',
  '15 */6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/sync-fixtures',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
