alter table "public"."accounts" add column "farcaster_api_key" text;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.accounts_encrypt_secret_farcaster_api_key()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
		BEGIN
		        new.farcaster_api_key = CASE WHEN new.farcaster_api_key IS NULL THEN NULL ELSE
			CASE WHEN 'dcd0dca7-c03a-40c5-b348-fefb87be2845' IS NULL THEN NULL ELSE pg_catalog.encode(
			  pgsodium.crypto_aead_det_encrypt(
				pg_catalog.convert_to(new.farcaster_api_key, 'utf8'),
				pg_catalog.convert_to(('')::text, 'utf8'),
				'dcd0dca7-c03a-40c5-b348-fefb87be2845'::uuid,
				NULL
			  ),
				'base64') END END;
		RETURN new;
		END;
		$function$
;

create or replace view "public"."decrypted_dm_accounts" as  SELECT accounts.id,
    accounts.user_id,
    accounts.platform_account_id,
        CASE
            WHEN (accounts.farcaster_api_key IS NULL) THEN NULL::text
            ELSE convert_from(pgsodium.crypto_aead_det_decrypt(decode(accounts.farcaster_api_key, 'base64'::text), convert_to(''::text, 'utf8'::name), 'dcd0dca7-c03a-40c5-b348-fefb87be2845'::uuid, NULL::bytea), 'utf8'::name)
        END AS decrypted_farcaster_api_key
   FROM accounts
  WHERE (accounts.user_id = auth.uid());


create or replace view "public"."decrypted_accounts" as  SELECT accounts.created_at,
    accounts.platform,
    accounts.id,
    accounts.public_key,
    accounts.name,
    accounts.data,
    accounts.user_id,
    accounts.status,
    accounts.private_key,
        CASE
            WHEN (accounts.private_key IS NULL) THEN NULL::text
            ELSE
            CASE
                WHEN ('dcd0dca7-c03a-40c5-b348-fefb87be2845' IS NULL) THEN NULL::text
                ELSE convert_from(pgsodium.crypto_aead_det_decrypt(decode(accounts.private_key, 'base64'::text), convert_to(''::text, 'utf8'::name), 'dcd0dca7-c03a-40c5-b348-fefb87be2845'::uuid, NULL::bytea), 'utf8'::name)
            END
        END AS decrypted_private_key,
    accounts.platform_account_id,
    accounts.farcaster_api_key,
        CASE
            WHEN (accounts.farcaster_api_key IS NULL) THEN NULL::text
            ELSE
            CASE
                WHEN ('dcd0dca7-c03a-40c5-b348-fefb87be2845' IS NULL) THEN NULL::text
                ELSE convert_from(pgsodium.crypto_aead_det_decrypt(decode(accounts.farcaster_api_key, 'base64'::text), convert_to(''::text, 'utf8'::name), 'dcd0dca7-c03a-40c5-b348-fefb87be2845'::uuid, NULL::bytea), 'utf8'::name)
            END
        END AS decrypted_farcaster_api_key
   FROM accounts;


CREATE TRIGGER accounts_encrypt_secret_trigger_farcaster_api_key BEFORE INSERT OR UPDATE OF farcaster_api_key ON public.accounts FOR EACH ROW EXECUTE FUNCTION accounts_encrypt_secret_farcaster_api_key();


