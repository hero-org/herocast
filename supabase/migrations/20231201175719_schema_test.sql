
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE OR REPLACE FUNCTION "public"."accounts_encrypt_secret_private_key"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
		BEGIN
		        new.private_key = CASE WHEN new.private_key IS NULL THEN NULL ELSE
			CASE WHEN 'dcd0dca7-c03a-40c5-b348-fefb87be2845' IS NULL THEN NULL ELSE pg_catalog.encode(
			  pgsodium.crypto_aead_det_encrypt(
				pg_catalog.convert_to(new.private_key, 'utf8'),
				pg_catalog.convert_to(('')::text, 'utf8'),
				'dcd0dca7-c03a-40c5-b348-fefb87be2845'::uuid,
				NULL
			  ),
				'base64') END END;
		RETURN new;
		END;
		$$;

ALTER FUNCTION "public"."accounts_encrypt_secret_private_key"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."is_account_of_user"("_user_id" "uuid", "_account_id" "uuid") RETURNS boolean
    LANGUAGE "sql"
    AS $$SELECT EXISTS (
  SELECT 1
  FROM accounts
  WHERE accounts.id = _account_id
  AND accounts.user_id = _user_id
);$$;

ALTER FUNCTION "public"."is_account_of_user"("_user_id" "uuid", "_account_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "platform" character varying DEFAULT 'farcaster'::character varying,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "public_key" "text" DEFAULT ''::"text",
    "name" "text",
    "data" "jsonb",
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "status" "text" DEFAULT '''pending''::text'::"text",
    "private_key" "text" NOT NULL,
    "platform_account_id" "text"
);

ALTER TABLE "public"."accounts" OWNER TO "postgres";

SECURITY LABEL FOR "pgsodium" ON COLUMN "public"."accounts"."private_key" IS 'ENCRYPT WITH KEY ID dcd0dca7-c03a-40c5-b348-fefb87be2845 SECURITY INVOKER';

CREATE TABLE IF NOT EXISTS "public"."accounts_to_channel" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_read" timestamp with time zone,
    "index" bigint,
    "account_id" "uuid" NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL
);

ALTER TABLE "public"."accounts_to_channel" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."channel" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "icon_url" "text",
    "url" "text",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text"
);

ALTER TABLE "public"."channel" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."decrypted_accounts" WITH ("security_invoker"='true') AS
 SELECT "accounts"."created_at",
    "accounts"."platform",
    "accounts"."id",
    "accounts"."public_key",
    "accounts"."name",
    "accounts"."data",
    "accounts"."user_id",
    "accounts"."status",
    "accounts"."private_key",
        CASE
            WHEN ("accounts"."private_key" IS NULL) THEN NULL::"text"
            ELSE
            CASE
                WHEN ('dcd0dca7-c03a-40c5-b348-fefb87be2845' IS NULL) THEN NULL::"text"
                ELSE "convert_from"("pgsodium"."crypto_aead_det_decrypt"("decode"("accounts"."private_key", 'base64'::"text"), "convert_to"(''::"text", 'utf8'::"name"), 'dcd0dca7-c03a-40c5-b348-fefb87be2845'::"uuid", NULL::"bytea"), 'utf8'::"name")
            END
        END AS "decrypted_private_key",
    "accounts"."platform_account_id"
   FROM "public"."accounts";

ALTER TABLE "public"."decrypted_accounts" OWNER TO "postgres";

ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_duplicate_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_duplicate_public_key_key" UNIQUE ("public_key");

ALTER TABLE ONLY "public"."accounts_to_channel"
    ADD CONSTRAINT "accounts_to_channel_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."channel"
    ADD CONSTRAINT "channel_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."channel"
    ADD CONSTRAINT "channel_url_key" UNIQUE ("url");

CREATE OR REPLACE TRIGGER "accounts_encrypt_secret_trigger_private_key" BEFORE INSERT OR UPDATE OF "private_key" ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."accounts_encrypt_secret_private_key"();

ALTER TABLE ONLY "public"."accounts_to_channel"
    ADD CONSTRAINT "accounts_to_channel_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");

ALTER TABLE ONLY "public"."accounts_to_channel"
    ADD CONSTRAINT "accounts_to_channel_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channel"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

CREATE POLICY "Enable access for users based on user_id" ON "public"."accounts" USING (("auth"."uid"() = "user_id")) WITH CHECK (true);

CREATE POLICY "Enable access to rows for users" ON "public"."accounts_to_channel" USING ("public"."is_account_of_user"("auth"."uid"(), "account_id")) WITH CHECK (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."channel" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON "public"."channel" FOR SELECT TO "authenticated" USING (true);

ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."accounts_to_channel" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."channel" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."accounts_encrypt_secret_private_key"() TO "anon";
GRANT ALL ON FUNCTION "public"."accounts_encrypt_secret_private_key"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."accounts_encrypt_secret_private_key"() TO "service_role";

GRANT ALL ON FUNCTION "public"."is_account_of_user"("_user_id" "uuid", "_account_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_account_of_user"("_user_id" "uuid", "_account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_account_of_user"("_user_id" "uuid", "_account_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";

GRANT ALL ON TABLE "public"."accounts_to_channel" TO "anon";
GRANT ALL ON TABLE "public"."accounts_to_channel" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts_to_channel" TO "service_role";

GRANT ALL ON TABLE "public"."channel" TO "anon";
GRANT ALL ON TABLE "public"."channel" TO "authenticated";
GRANT ALL ON TABLE "public"."channel" TO "service_role";

GRANT ALL ON TABLE "public"."decrypted_accounts" TO "anon";
GRANT ALL ON TABLE "public"."decrypted_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."decrypted_accounts" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";

RESET ALL;
