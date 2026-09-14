-- Calls generate-nudges every hour. The function only does work at 10:00 in Lisbon, which also covers
-- the change between summer and winter time (cron runs in UTC). The project URL and the shared secret
-- live in Vault and are created outside migrations, so they are never committed.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'generate-nudges-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/generate-nudges',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
