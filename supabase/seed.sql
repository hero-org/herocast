-- Test/CI seed: ensure the pgsodium key referenced by the encrypt triggers
-- exists. Runs after migrations as part of `supabase db reset`, with the
-- privileged role used by the migration runner (so pgsodium.key writes are
-- allowed — the postgres role used by post-reset psql sessions cannot).
--
-- Idempotent: returns early if the key already exists. Safe to ship in repo.
DO $$
DECLARE
  target_uuid constant uuid := 'dcd0dca7-c03a-40c5-b348-fefb87be2845';
  generated_uuid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM pgsodium.key WHERE id = target_uuid) THEN
    RETURN;
  END IF;

  -- Drop any previous attempt that left a partial key under our chosen name.
  DELETE FROM pgsodium.key WHERE name = 'herocast_encryption_key';

  -- Create the key the proper way; pgsodium handles raw_key generation.
  SELECT id INTO generated_uuid
  FROM pgsodium.create_key('aead-det'::pgsodium.key_type, 'herocast_encryption_key');

  -- Reassign the auto-generated id to the deterministic UUID that the
  -- accounts encrypt trigger functions reference by literal.
  UPDATE pgsodium.key SET id = target_uuid WHERE id = generated_uuid;
END $$;

-- Re-grant the pgsodium role required for the test path. Migration
-- 20260423000003 revokes this from `authenticated` for production hardening;
-- tests need it back for the encrypt/decrypt path to work.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgsodium_keyiduser') THEN
    EXECUTE 'GRANT pgsodium_keyiduser TO authenticated';
  END IF;
END $$;
