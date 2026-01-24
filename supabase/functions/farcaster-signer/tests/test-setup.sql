-- Test Setup for Farcaster Signing Service Integration Tests
--
-- This script creates test users and accounts for running integration tests.
--
-- PREREQUISITES:
--   1. Local Supabase running: supabase start
--   2. pgsodium extension enabled with encryption key
--
-- USAGE:
--   1. Update the PRIVATE_KEY placeholders with real Farcaster signer private keys
--   2. Update the FID values with corresponding Farcaster IDs
--   3. Run: psql -h localhost -p 54322 -U postgres -d postgres -f test-setup.sql
--      OR via Supabase Studio SQL Editor

-- ===========================================================================
-- Create Test Users
-- ===========================================================================

-- Note: We create users via Supabase auth API, not directly in SQL.
-- The test helpers will create users automatically on first run.
-- But we need a way to link test accounts to those users.

-- For local testing, you can manually create users in Supabase Studio:
-- Authentication > Users > Add User
--   - Email: test-user-1@herocast.test
--   - Password: test-password-123
--   - Auto Confirm: true
--
--   - Email: test-user-2@herocast.test
--   - Password: test-password-456
--   - Auto Confirm: true

-- ===========================================================================
-- Create Test Accounts (after users exist)
-- ===========================================================================

-- IMPORTANT: Replace these values with real test data!
--
-- To get a private key, you can:
-- 1. Use an existing herocast account's signer key (from your local DB)
-- 2. Generate a new signer key via Farcaster protocol
-- 3. Use a test account that you control

-- Example: Insert test account for user 1
-- (Uncomment and modify with real values)

/*
-- First, get the user_id for test-user-1@herocast.test from auth.users
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'test-user-1@herocast.test';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Test user 1 not found. Create the user first.';
  END IF;

  -- Insert test account
  INSERT INTO accounts (
    user_id,
    platform,
    public_key,
    name,
    status,
    private_key,
    platform_account_id
  ) VALUES (
    v_user_id,
    'farcaster',
    '0x...YOUR_PUBLIC_KEY...',           -- Public key (hex)
    'Test Account 1',
    'active',                             -- Must be 'active' for signing to work
    '0x...YOUR_PRIVATE_KEY...',          -- Private key (will be encrypted by trigger)
    '12345'                               -- Farcaster FID
  )
  ON CONFLICT (public_key) DO UPDATE
  SET
    status = 'active',
    name = 'Test Account 1';
END $$;
*/

-- ===========================================================================
-- Verify Test Setup
-- ===========================================================================

-- Check test users exist
SELECT id, email, created_at
FROM auth.users
WHERE email LIKE '%@herocast.test'
ORDER BY email;

-- Check test accounts exist and are active
SELECT
  a.id,
  a.name,
  a.status,
  a.platform_account_id as fid,
  u.email as user_email
FROM accounts a
JOIN auth.users u ON a.user_id = u.id
WHERE u.email LIKE '%@herocast.test';

-- Verify decryption works (should show decrypted key for your session)
-- Note: This only works with proper RLS context
-- SELECT id, name, decrypted_private_key IS NOT NULL as has_key
-- FROM decrypted_accounts
-- WHERE status = 'active';

-- ===========================================================================
-- Clean Up (optional - run manually when needed)
-- ===========================================================================

-- Delete test accounts
-- DELETE FROM accounts WHERE user_id IN (
--   SELECT id FROM auth.users WHERE email LIKE '%@herocast.test'
-- );

-- Delete test users
-- DELETE FROM auth.users WHERE email LIKE '%@herocast.test';

-- Delete test idempotency records
-- DELETE FROM signing_idempotency WHERE created_at > NOW() - INTERVAL '1 day';

-- Delete test audit logs
-- DELETE FROM signing_audit_log WHERE created_at > NOW() - INTERVAL '1 day';
