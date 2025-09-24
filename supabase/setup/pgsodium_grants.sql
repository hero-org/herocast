-- Run as the Postgres superuser after supabase start finishes.
-- Applies pgsodium privileges required by the application.
GRANT USAGE ON SCHEMA pgsodium TO anon;
GRANT USAGE ON SCHEMA pgsodium TO authenticated;
GRANT USAGE ON SCHEMA pgsodium TO service_role;

DO $$
DECLARE
  fn_exists boolean;
BEGIN
  fn_exists := to_regprocedure('pgsodium.crypto_aead_det_encrypt(bytea, bytea, bytea, bytea)') IS NOT NULL;
  IF fn_exists THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION pgsodium.crypto_aead_det_encrypt(bytea, bytea, bytea, bytea) TO authenticated';
  END IF;

  fn_exists := to_regprocedure('pgsodium.crypto_aead_det_encrypt(bytea, bytea, uuid, bytea)') IS NOT NULL;
  IF fn_exists THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION pgsodium.crypto_aead_det_encrypt(bytea, bytea, uuid, bytea) TO authenticated';
  END IF;

  fn_exists := to_regprocedure('pgsodium.crypto_aead_det_decrypt(bytea, bytea, bytea, bytea)') IS NOT NULL;
  IF fn_exists THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION pgsodium.crypto_aead_det_decrypt(bytea, bytea, bytea, bytea) TO authenticated';
  END IF;

  fn_exists := to_regprocedure('pgsodium.crypto_aead_det_decrypt(bytea, bytea, uuid, bytea)') IS NOT NULL;
  IF fn_exists THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION pgsodium.crypto_aead_det_decrypt(bytea, bytea, uuid, bytea) TO authenticated';
  END IF;
END $$;

GRANT pgsodium_keyiduser TO authenticated;
