-- Drop the existing function
DROP FUNCTION IF EXISTS public.trigger_process_auto_interactions();

-- Create a new function that constructs the URL properly
CREATE OR REPLACE FUNCTION public.trigger_process_auto_interactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_ref text;
  service_role_key text;
  full_url text;
BEGIN
  -- Get the project reference from the current database
  -- This extracts it from the current database host
  SELECT split_part(split_part(current_setting('listen_addresses'), '.', 1), '-', 1) 
  INTO project_ref;
  
  -- Get service role key from vault
  -- First, you need to insert your service role key into vault:
  -- INSERT INTO vault.secrets (secret) VALUES ('your-service-role-key-here') RETURNING id;
  -- Then update this to use the correct secret_id
  SELECT decrypted_secret 
  FROM vault.decrypted_secrets 
  WHERE id = 'YOUR_SECRET_ID_HERE'::uuid -- Replace with actual secret ID
  INTO service_role_key;
  
  -- Construct the full URL
  full_url := 'https://' || project_ref || '.supabase.co/functions/v1/process-auto-interactions';
  
  -- Make HTTP request to edge function
  PERFORM net.http_post(
    url := full_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_role_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail silently
    RAISE NOTICE 'Error in trigger_process_auto_interactions: %', SQLERRM;
    RAISE;
END;
$$;

-- Alternative: Direct cron job without the function wrapper
-- This is simpler but requires hardcoding the URL and key
/*
SELECT cron.unschedule('process-auto-interactions');

SELECT cron.schedule(
  'process-auto-interactions',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-auto-interactions',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
*/

COMMENT ON FUNCTION public.trigger_process_auto_interactions() IS 'Triggers the process-auto-interactions edge function. Requires service_role_key to be stored in vault.';