drop policy "Enable access for users based on user_id" on "public"."list";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.decrypted_account(account_id uuid)
 RETURNS TABLE(created_at timestamp with time zone, platform character varying, id uuid, public_key text, name text, data jsonb, user_id uuid, status text, private_key text, decrypted_private_key text, platform_account_id text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT
      created_at,
      platform,
      id,
      public_key,
      name,
      data,
      user_id,
      status,
      private_key,
      decrypted_private_key,
      platform_account_id
    FROM decrypted_accounts
    WHERE id = account_id
    AND user_id = auth.uid();
  $function$
;

create policy "Enable access for users based on user_id"
on "public"."list"
as permissive
for all
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



