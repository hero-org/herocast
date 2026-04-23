-- Signer-key hardening (Phase 2a): authorization RPCs used by cron edge functions
-- as the trust boundary for signer service calls.
--
-- Both RPCs are SECURITY DEFINER and called by the service-role client from
-- publish-cast-from-db and process-auto-interactions. They verify ownership
-- invariants, then return the validated (owner_user_id, account/source_account_id)
-- tuple. Callers mint a short-TTL user JWT with the returned sub and present it
-- to the signer service (no more service-role bypass).

-- ============================================================================
-- authorize_draft_publish: verifies the draft is 'scheduled' and that its
-- created_by_user_id matches the account owner. Raises on any mismatch.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.authorize_draft_publish(p_draft_id uuid)
RETURNS TABLE(owner_user_id uuid, account_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public','pg_catalog'
AS $$
BEGIN
  RETURN QUERY
    SELECT a.user_id, d.account_id
    FROM public.draft d
    JOIN public.accounts a ON a.id = d.account_id
    WHERE d.id = p_draft_id
      AND d.status = 'scheduled'
      AND d.created_by_user_id = a.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unauthorized draft publish' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

ALTER FUNCTION public.authorize_draft_publish(uuid) OWNER TO postgres;
-- The project's ALTER DEFAULT PRIVILEGES (see 20231201175719_schema_test.sql:202)
-- grants ALL on new functions to anon and authenticated. Revoking PUBLIC alone
-- leaves those role-specific grants in place, so we revoke them explicitly too.
REVOKE ALL ON FUNCTION public.authorize_draft_publish(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_draft_publish(uuid) TO service_role;

-- ============================================================================
-- authorize_auto_interaction: verifies the list is of type 'auto_interaction',
-- has a sourceAccountId, and that the source account belongs to the list owner.
-- Returns the owner's user_id and the validated source account id.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.authorize_auto_interaction(p_list_id uuid)
RETURNS TABLE(owner_user_id uuid, source_account_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public','pg_catalog'
AS $$
DECLARE
  _list_user uuid;
  _src uuid;
  _src_user uuid;
BEGIN
  SELECT l.user_id, (l.contents->>'sourceAccountId')::uuid
    INTO _list_user, _src
  FROM public.list l
  WHERE l.id = p_list_id
    AND l.type = 'auto_interaction';

  IF _list_user IS NULL OR _src IS NULL THEN
    RAISE EXCEPTION 'list not found or sourceAccountId missing' USING ERRCODE = 'P0001';
  END IF;

  SELECT user_id INTO _src_user FROM public.accounts WHERE id = _src;
  IF _src_user IS DISTINCT FROM _list_user THEN
    RAISE EXCEPTION 'sourceAccountId ownership mismatch' USING ERRCODE = 'P0001';
  END IF;

  owner_user_id := _list_user;
  source_account_id := _src;
  RETURN NEXT;
END;
$$;

ALTER FUNCTION public.authorize_auto_interaction(uuid) OWNER TO postgres;
-- Same rationale as above: explicit revoke from anon, authenticated to override
-- the project's default privileges that grant ALL on new functions to them.
REVOKE ALL ON FUNCTION public.authorize_auto_interaction(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_auto_interaction(uuid) TO service_role;
