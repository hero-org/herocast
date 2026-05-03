-- Ensures the deterministic key referenced by the accounts encrypt triggers
-- exists locally / in CI. Uses pgsodium.create_key() so that raw_key is
-- generated correctly and the encrypt path works (a bare INSERT into
-- pgsodium.key leaves raw_key derivation broken, surfacing as
-- "query returned no rows" P0002 from pgsodium.crypto_aead_det_encrypt).
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
