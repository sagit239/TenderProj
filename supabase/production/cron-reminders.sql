-- Production only (not a migration): calls the reminders endpoint every 15 minutes (ADR-2).
-- Before running: replace <APP_URL> with the Vercel address, and store the secret in Vault:
--   select vault.create_secret('<the CRON_SECRET value>', 'cron_secret');
-- Never save the real secret in this file.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := '<APP_URL>/api/cron/reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 55000
  );
  $$
);
