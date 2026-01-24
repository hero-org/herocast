# Farcaster Signing Service Tests

Integration and E2E tests for the Farcaster signing service.

## Prerequisites

1. **Local Supabase** running:

   ```bash
   supabase start
   ```

2. **pgsodium grants + key** (required for `private_key` encryption):

   ```bash
   # Option A: psql (recommended)
   PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -f supabase/setup/pgsodium_grants.sql
   PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -f supabase/setup/pgsodium_seed_key.sql
   ```

3. **Environment variables** - Create a `.env` file or export:

   ```bash
   export SUPABASE_URL="http://localhost:54321"
   export SUPABASE_ANON_KEY="<your-local-anon-key>"
   # Get anon key from: supabase status
   ```

4. **Seed test users/accounts** (auto via script):

   ```bash
   deno run --allow-net --allow-env --allow-read tests/seed.ts
   ```

5. **Signing service** deployed locally:

   ```bash
   supabase functions serve farcaster-signer --no-verify-jwt
   ```

6. **Manual fallback** (if seed script is skipped):
   - Go to Supabase Studio: http://localhost:54323
   - Create test users in Authentication > Users:
     - `test-user-1@herocast.test` / `test-password-123`
     - `test-user-2@herocast.test` / `test-password-456`
   - Create accounts for test users with valid signer keys

## Running Tests

### Validation Tests Only (no Hub required)

```bash
cd supabase/functions/farcaster-signer

# Run all validation tests
SKIP_E2E_TESTS=true deno test --allow-net --allow-env tests/

# Run specific test file
SKIP_E2E_TESTS=true deno test --allow-net --allow-env tests/auth.test.ts
SKIP_E2E_TESTS=true deno test --allow-net --allow-env tests/cast.test.ts
SKIP_E2E_TESTS=true deno test --allow-net --allow-env tests/reaction.test.ts
SKIP_E2E_TESTS=true deno test --allow-net --allow-env tests/follow.test.ts
```

### Full E2E Tests (requires Hub connectivity)

```bash
cd supabase/functions/farcaster-signer

# Run all tests including E2E
deno test --allow-net --allow-env tests/
```

### Quick Test Script

```bash
# From project root
./supabase/functions/farcaster-signer/tests/run-tests.sh
```

You can skip setup steps with `SKIP_PGSODIUM_SETUP=true` or `SKIP_TEST_SEED=true`.

## Test Categories

### Auth Tests (`auth.test.ts`)

- Missing authorization header → 401
- Invalid token → 401
- Expired token → 401
- Valid token with non-existent account → 404
- Cross-user account access → 404 (RLS blocks)
- CORS preflight → 200 with correct headers
- Unknown route → 404

### Cast Tests (`cast.test.ts`)

- Validation: missing fields, invalid formats, field limits
- E2E: create cast, idempotency, channel_id, embeds

### Reaction Tests (`reaction.test.ts`)

- Validation: missing fields, invalid type, invalid target
- E2E: like, recast

### Follow Tests (`follow.test.ts`)

- Validation: missing fields, invalid FID
- E2E: follow, unfollow

## Test Data Requirements

For **validation tests**, you need:

- Test users created in Supabase Auth
- At least one active account per user (can have dummy keys)

For **E2E tests**, you need:

- Real Farcaster signer private keys
- Valid FIDs for those signers
- Hub connectivity (tests will gracefully skip if Hub unavailable)

## Troubleshooting

### "SUPABASE_ANON_KEY must be set"

Run `supabase status` and export the anon key:

```bash
export SUPABASE_ANON_KEY="eyJ..."
```

### "Test user has no active account"

Create a test account in Supabase Studio (or re-run `tests/seed.ts`):

1. Go to Table Editor > accounts
2. Insert a row with:
   - `user_id`: ID of your test user (from Authentication > Users)
   - `status`: `active`
   - `platform_account_id`: A valid FID
   - `private_key`: A valid Farcaster signer private key

### "Hub not available" (E2E tests)

E2E tests that hit the Farcaster Hub will log this and pass. This is expected if:

- You don't have Hub connectivity from your machine
- The test accounts don't have valid signer keys

To actually submit to Farcaster, you need real credentials.

### Cross-user test skipped

If you only have one test user with an account, the cross-user isolation test will be skipped. Create a second test user with an account to enable it.
