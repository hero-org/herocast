-- Ensures the deterministic key referenced by triggers exists locally.
DO $$
DECLARE
  target_uuid constant uuid := 'dcd0dca7-c03a-40c5-b348-fefb87be2845';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pgsodium.key WHERE id = target_uuid
  ) THEN
    INSERT INTO pgsodium.key (id, key_type, key_id, key_context)
    VALUES (
      target_uuid,
      'aead-det',
      nextval('pgsodium.key_key_id_seq'),
      decode('7067736f6469756d', 'hex')
    );
  END IF;
END $$;
