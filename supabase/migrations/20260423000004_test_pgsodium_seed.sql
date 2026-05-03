-- Idempotent seed for the pgsodium key referenced by accounts encrypt
-- triggers. Required for fresh local/CI databases where pgsodium has no
-- pre-existing key with the literal UUID baked into the encrypt expressions
-- (see supabase/migrations/20231201175719_schema_test.sql).
--
-- Why a migration (not seed.sql): in the Supabase CLI image used by CI, the
-- post-migration `postgres` role lacks pgsodium_keymaker membership, so
-- direct INSERT/UPDATE on pgsodium.key fails with "permission denied for
-- table key" (SQLSTATE 42501) — the symptom that surfaces in seed.ts as
-- P0002 "query returned no rows" from crypto_aead_det_encrypt. Migrations
-- run with elevated privileges and can call SECURITY DEFINER pgsodium APIs.
--
-- Production safety: idempotent — returns early if the key already exists.
-- The deployed prod database already has this key (UUID matches the
-- existing encrypt-trigger references), so this migration is a no-op there.
DO $$
DECLARE
  target_uuid constant uuid := 'dcd0dca7-c03a-40c5-b348-fefb87be2845';
  generated_uuid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM pgsodium.key WHERE id = target_uuid) THEN
    RETURN;
  END IF;

  -- Drop any partial earlier attempt under our chosen name. Safe in fresh
  -- environments; in production the EXISTS check above already returned.
  DELETE FROM pgsodium.key WHERE name = 'herocast_encryption_key';

  -- pgsodium.create_key is SECURITY DEFINER (owner pgsodium_keymaker) and
  -- handles the privileged INSERT into pgsodium.key, deriving raw_key from
  -- the server root key. This is the documented pgsodium pattern; passing
  -- an explicit raw_key bypasses the derivation chain and breaks encrypt
  -- in environments where server_root_key is not the storage key (the
  -- decrypted_key view tries to "decrypt" the literal bytes and fails with
  -- "invalid ciphertext").
  SELECT id INTO generated_uuid
  FROM pgsodium.create_key('aead-det'::pgsodium.key_type, 'herocast_encryption_key');

  -- Realign the auto-generated id to the deterministic UUID that the encrypt
  -- expressions in earlier migrations reference by literal.
  UPDATE pgsodium.key SET id = target_uuid WHERE id = generated_uuid;
END $$;
