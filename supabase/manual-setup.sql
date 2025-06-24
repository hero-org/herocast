-- Manual setup steps for production
-- These are not included in migrations but should be run manually

-- 1. Create cron job for auto-interactions (run every 10 minutes)
SELECT cron.schedule(
  'process-auto-interactions',
  '*/10 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-auto-interactions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || 'YOUR_ANON_KEY'
      )
    );
  $$
);

-- 2. To check if the job was created:
-- SELECT * FROM cron.job;

-- 3. To remove the job if needed:
-- SELECT cron.unschedule('process-auto-interactions');