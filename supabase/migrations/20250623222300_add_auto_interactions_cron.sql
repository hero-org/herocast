-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create a function to call the edge function
CREATE OR REPLACE FUNCTION public.trigger_process_auto_interactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  service_role_key text;
  supabase_url text;
BEGIN
  -- Get the service role key from vault (you need to store it there)
  -- For now, this is a placeholder - in production, store the key securely
  service_role_key := current_setting('app.settings.service_role_key', true);
  supabase_url := current_setting('app.settings.supabase_url', true);
  
  -- Make HTTP request to edge function
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/process-auto-interactions',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_role_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule the function to run every 10 minutes
SELECT cron.schedule(
  'process-auto-interactions',
  '*/10 * * * *', -- Every 10 minutes
  $$SELECT public.trigger_process_auto_interactions();$$
);

-- Add a comment to document the cron job
COMMENT ON FUNCTION public.trigger_process_auto_interactions() IS 'Triggers the process-auto-interactions edge function to handle automatic likes and recasts';