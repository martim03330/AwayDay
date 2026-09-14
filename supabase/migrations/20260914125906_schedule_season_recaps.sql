-- Season recaps: once a day from 15 to 20 June at 09:00 UTC (10:00 in Lisbon). Running on several days
-- catches anything that failed; the unique constraint makes sure nobody gets two recaps.

select cron.schedule(
  'generate-season-recaps-june',
  '0 9 15-20 6 *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/generate-season-recaps',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
