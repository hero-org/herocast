-- Signer-key hardening (Phases 3, 4.1, 6.3): grant cleanup, audit log expansion,
-- vault lockdown, and pgsodium decrypt narrowing.
--
-- All revokes use DO blocks where the target role may not be granted, so the
-- migration is safe to re-run and survives variation between Supabase projects.

-- ============================================================================
-- Phase 3.1: revoke direct view grants from anon/authenticated. The signer now
-- calls the decrypted_account RPC (next block); no other caller should read
-- the decrypted views directly.
-- ============================================================================

REVOKE ALL ON public.decrypted_accounts    FROM anon, authenticated;
REVOKE ALL ON public.decrypted_dm_accounts FROM anon, authenticated;

-- ============================================================================
-- Phase 3.2: decrypted_account RPC EXECUTE is deliberately retained for
-- `authenticated`.
--
-- The RPC is SECURITY DEFINER and self-filters on `auth.uid() = user_id`,
-- which is the intended user-facing decryption boundary. Revoking EXECUTE
-- from `authenticated` would break the signer's user-JWT client path
-- (the signer calls the RPC via a Supabase client whose role is
-- `authenticated`, carrying either a real user JWT or a cron-minted short-
-- lived JWT). The view revokes above (Phase 3.1) are the surface we locked
-- down because the view has no built-in filter; the RPC stays open to
-- authenticated callers by design. Application-level defense-in-depth lives
-- in `farcaster-signer/lib/accounts.ts`, which double-checks the returned
-- row's `user_id` against the caller's JWT `sub`.
--
-- The GRANT below is redundant with service_role's default privileges but
-- is harmless and makes the intent explicit.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.decrypted_account(uuid) TO service_role;

-- ============================================================================
-- Phase 3.3: audit log expansion. Adds actor_user_id (who initiated the action,
-- may differ from signing_audit_log.user_id which is the account owner) and
-- source (user action vs. cron job).
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'signing_audit_log'
      AND column_name = 'actor_user_id'
  ) THEN
    ALTER TABLE public.signing_audit_log
      ADD COLUMN actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'signing_audit_log'
      AND column_name = 'source'
  ) THEN
    ALTER TABLE public.signing_audit_log
      ADD COLUMN source text
        CHECK (source IN ('user','cron:publish','cron:auto-interaction','system'))
        DEFAULT 'user';
  END IF;
END $$;

-- ============================================================================
-- Phase 4.1: vault lockdown. Do this BEFORE any secret is placed in vault.secrets.
-- The vault schema should only be readable by service_role / postgres.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'vault') THEN
    EXECUTE 'REVOKE USAGE ON SCHEMA vault FROM authenticated';
    EXECUTE 'REVOKE ALL ON vault.secrets FROM authenticated';
    EXECUTE 'REVOKE ALL ON vault.decrypted_secrets FROM authenticated';
  END IF;
END $$;

-- ============================================================================
-- Phase 6.3: narrow pgsodium decrypt capability to service_role only.
-- Guarded because the role may not be granted to authenticated in every project.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgsodium_keyiduser') THEN
    BEGIN
      EXECUTE 'REVOKE pgsodium_keyiduser FROM authenticated';
    EXCEPTION WHEN OTHERS THEN
      -- Not granted to authenticated in this project — safe to ignore.
      NULL;
    END;
  END IF;
END $$;

-- ============================================================================
-- OPERATOR-ACTION SQL (NOT executed by this migration)
-- ============================================================================
-- The steps below require Supabase-dashboard or manual operator actions and are
-- documented here so the operator can apply them in a controlled way.
-- See `.context/phase-6-operator-actions.md` for full context.
--
-- ----------------------------------------------------------------------------
-- Phase 4.2: rotate service_role, migrate cron secrets to vault
-- ----------------------------------------------------------------------------
-- 1) In Supabase dashboard: Project Settings -> API -> Rotate service_role.
--    Note the new JWT value.
--
-- 2) Store the rotated secret in vault (requires postgres/service_role connection):
--
--    INSERT INTO vault.secrets (name, secret)
--    VALUES ('signer_cron_token', '<new service_role jwt>');
--
-- 3) For each cron job that currently embeds the old service_role JWT in its
--    command (jobids observed: 3, 5, 6, 9, 11), rewrite the command to read
--    the token from vault at call time. Example pattern:
--
--    UPDATE cron.job
--    SET command = $cron$
--      SELECT net.http_post(
--        url := 'https://<project>.supabase.co/functions/v1/publish-cast-from-db',
--        headers := jsonb_build_object(
--          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'signer_cron_token'),
--          'Content-Type', 'application/json'
--        ),
--        body := '{}'::jsonb
--      );
--    $cron$
--    WHERE jobid = 3;
--
-- 4) Revoke the old JWT: Supabase dashboard -> rotate again if the previous
--    value leaked, otherwise the earlier rotation already invalidates it.
--
-- ----------------------------------------------------------------------------
-- Phase 6.1: wrap pgsodium KEK under platform root key
-- ----------------------------------------------------------------------------
-- The pgsodium key `dcd0dca7-c03a-40c5-b348-fefb87be2845` is currently stored in
-- the database. Wrap it under the Supabase platform root key so an admin with
-- DB-only access cannot exfiltrate the KEK.
--
-- Procedure is Supabase-specific; see:
--   https://supabase.com/docs/guides/database/vault
-- for the current instructions.
--
-- ----------------------------------------------------------------------------
-- Phase 6.2 (housekeeping): retire the unnamed pgsodium key `95866e70…`
-- ----------------------------------------------------------------------------
-- Audit all code and schema references first. If none remain, mark the key
-- inactive via the Supabase dashboard or pgsodium key-management SQL.
