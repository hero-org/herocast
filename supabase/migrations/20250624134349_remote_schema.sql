alter table "public"."draft" alter column "encoded_message_bytes" set data type bigint[] using "encoded_message_bytes"::bigint[];

alter table "public"."profile" enable row level security;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.trigger_process_auto_interactions()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.sync_email_to_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profile (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email;

  RETURN NEW;
END;
$function$
;

create policy "Enable access for users based on user_id"
on "public"."profile"
as permissive
for all
to public
using ((auth.uid() = user_id))
with check (true);



