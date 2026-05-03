-- Signer-key hardening (Phase 0.3 + Phase 1): deterministic search_path, RLS tightening,
-- draft ownership column, auto-interaction ownership trigger, FORCE RLS on sensitive tables.
--
-- Idempotent where reasonable. Policy names match what exists in the live schema
-- (see 20231201175719_schema_test.sql, 20240612125244_add_scheduled_casts.sql,
--  20240722095848_add_customers.sql, 20250709155039_remote_schema.sql).

-- ============================================================================
-- Phase 0.3: deterministic search_path on currently-flagged functions
-- ============================================================================

ALTER FUNCTION public.update_modified_column()                        SET search_path = 'public','pg_catalog';
ALTER FUNCTION public.sync_email_to_profile()                         SET search_path = 'public','pg_catalog';
ALTER FUNCTION public.is_account_of_user(uuid, uuid)                  SET search_path = 'public','pg_catalog';
ALTER FUNCTION public.trigger_process_auto_interactions()             SET search_path = 'public','pg_catalog';
ALTER FUNCTION public.accounts_encrypt_secret_private_key()           SET search_path = 'public','pg_catalog';
ALTER FUNCTION public.accounts_encrypt_secret_farcaster_api_key()     SET search_path = 'public','pg_catalog';

-- ============================================================================
-- Phase 1.1: tighten WITH CHECK on user-scoped tables so inserts/updates must
-- target a row the caller actually owns. Without WITH CHECK, authenticated
-- users can INSERT rows with any user_id value.
-- ============================================================================

ALTER POLICY "Enable access for users based on user_id"
  ON public.accounts
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Enable access to rows for users"
  ON public.accounts_to_channel
  WITH CHECK (public.is_account_of_user(auth.uid(), account_id));

ALTER POLICY "Enable access for users based on user_id"
  ON public.customers
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Enable access for users based on user_id"
  ON public.profile
  WITH CHECK (auth.uid() = user_id);

-- Note: public.list already has tightened WITH CHECK (auth.uid() = user_id)
-- from migration 20250625101126_remote_schema.sql. No change needed.
-- Note: public.channel INSERT policy is intentionally permissive. Channels are a
-- shared, protocol-level namespace (Farcaster channels belong to everyone, not
-- individual herocast users) so any authenticated user may insert channel
-- metadata rows. No user-owned secret material lives on `channel`, so a loose
-- WITH CHECK carries no confidentiality impact. Tagged `lint-allow-with-check-true`
-- so the CI linter permits it going forward.
-- lint-allow-with-check-true: channel is a shared protocol-namespace table

-- ============================================================================
-- Phase 1.2: draft.created_by_user_id — records the user who *scheduled* the draft,
-- independent of the account it publishes from. This is the ownership anchor used by
-- the authorize_draft_publish RPC to verify drafts were created by the account owner.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'draft'
      AND column_name = 'created_by_user_id'
  ) THEN
    ALTER TABLE public.draft
      ADD COLUMN created_by_user_id uuid DEFAULT auth.uid()
      REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill: existing drafts are assumed to have been created by the account owner.
UPDATE public.draft d
SET created_by_user_id = a.user_id
FROM public.accounts a
WHERE d.account_id = a.id
  AND d.created_by_user_id IS NULL;

ALTER TABLE public.draft ALTER COLUMN created_by_user_id SET NOT NULL;

-- ============================================================================
-- Phase 1.3: tighten draft policy — in addition to requiring the draft's account
-- to belong to the caller, also require the draft's creator to be the caller.
-- ============================================================================

ALTER POLICY "Enable access to rows for users"
  ON public.draft
  WITH CHECK (
    public.is_account_of_user(auth.uid(), account_id)
    AND created_by_user_id = auth.uid()
  );

-- ============================================================================
-- Phase 1.4: auto-interaction list ownership trigger
-- Enforces at DB level that contents->>'sourceAccountId' refers to an account
-- owned by the same user who owns the list.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_auto_interaction_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public','pg_catalog'
AS $$
DECLARE
  src_account_id uuid;
  src_user_id uuid;
BEGIN
  IF NEW.type <> 'auto_interaction' THEN
    RETURN NEW;
  END IF;

  src_account_id := (NEW.contents->>'sourceAccountId')::uuid;
  IF src_account_id IS NULL THEN
    RAISE EXCEPTION 'auto_interaction list requires contents.sourceAccountId';
  END IF;

  SELECT user_id INTO src_user_id FROM public.accounts WHERE id = src_account_id;
  IF src_user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'sourceAccountId must belong to list owner';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_auto_interaction_ownership ON public.list;
CREATE TRIGGER enforce_auto_interaction_ownership
  BEFORE INSERT OR UPDATE ON public.list
  FOR EACH ROW EXECUTE FUNCTION public.validate_auto_interaction_list();

-- ============================================================================
-- Phase 1.5: remove user INSERT on signing_audit_log. The signer edge function
-- writes audit rows via the service-role client (narrow, legitimate use).
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.signing_audit_log;

-- ============================================================================
-- Phase 1.6: FORCE RLS on sensitive tables so row-owning postgres roles
-- (e.g. extensions running as table owner) cannot bypass policies.
-- ============================================================================

ALTER TABLE public.accounts              FORCE ROW LEVEL SECURITY;
ALTER TABLE public.draft                 FORCE ROW LEVEL SECURITY;
ALTER TABLE public.list                  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.signing_audit_log     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.signing_idempotency   FORCE ROW LEVEL SECURITY;
