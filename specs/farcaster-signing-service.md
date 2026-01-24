# Farcaster Signing Service Spec

## Problem

Herocast currently sends decrypted private keys to the frontend for signing Farcaster messages. This is a security risk - keys are exposed to browser JavaScript where they could be extracted by malicious extensions, XSS attacks, or debugging tools. Additionally, adding new clients (MCP server, mobile app, integrations) requires each to implement its own signing logic and key handling.

## Solution

A centralized signing service that:

1. Keeps private keys server-side (never sent to clients)
2. Provides a unified API for all Farcaster signing operations
3. Validates requests and applies rate limits
4. Serves as the single signing layer for frontend, MCP, and future clients

## Success Criteria

1. **Security**: Private keys never leave Supabase - not sent to frontend, MCP, or any client
2. **Functionality**: All existing frontend features work through the new signing service
3. **Performance**: Signing requests complete in <500ms (p95)
4. **Isolation**: User A cannot sign as User B's account (enforced by RLS + auth)

## Scope

### In Scope

- **Signing service**: Supabase Edge Function at `supabase/functions/farcaster-signer/`
- **Cast operations**: `sign_cast`, `remove_cast`
- **Reaction operations**: `sign_like`, `sign_recast`, `sign_follow`, `sign_unfollow`
- **Basic audit logging**: Log (account_id, action, timestamp, success/fail) for each signing request
- **Frontend migration**: Update all signing calls to use new service
- **Basic validation**: Valid Farcaster message structure

### Out of Scope

- **Threads**: Not in V1 (add later with proper partial failure handling)
- **Profile updates**: Username, bio, pfp changes (add later)
- **Channel operations**: Join/leave channels (add later)
- **Advanced validation**: Content moderation, embed reachability checks
- **Action-specific permissions**: All-or-nothing per account for V1
- **Rate limiting**: Not in V1 (rely on Farcaster Hub limits, add later if needed)
- **Hub retries**: Not in V1 (if Hub fails, return error immediately, user retries manually)

## Constraints

### Must Follow

1. **Supabase Edge Function** - same infrastructure as MCP
2. **OAuth token auth** - same auth pattern as MCP (user's Supabase session)
3. **Anon key + user JWT** - use anon key with user's JWT so RLS is enforced automatically (NOT service_role)
4. **RLS for key access** - use existing `decrypted_accounts` view with `user_id` constraint
5. **Stateless design** - no session state, validate every request independently

### Must Avoid

- **Do NOT** return private keys to any client
- **Do NOT** trust client-provided user_id (extract from token)
- **Do NOT** add new auth libraries

## Technical Approach

### API Design

**Base URL**: `https://<project>.supabase.co/functions/v1/farcaster-signer`

**Authentication**: Bearer token (Supabase access token from OAuth flow)

```typescript
// All requests require:
Headers: {
  "Authorization": "Bearer <supabase_access_token>",
  "Content-Type": "application/json"
}
```

### Endpoints

#### POST /cast

Sign and submit a cast.

```typescript
// Request
{
  "account_id": "uuid",           // Required: which account to sign with
  "text": "Hello world",          // Required: cast text
  "channel_id": "neynar",         // Optional: channel name (alternative to parent_url)
  "parent_url": "https://...",    // Optional: channel URL (alternative to channel_id)
  "parent_cast_id": {             // Optional: reply to
    "fid": 12345,
    "hash": "0xabc..."
  },
  "embeds": [                     // Optional: up to 2 embeds
    { "url": "https://..." },                        // URL embed
    { "cast_id": { "fid": 123, "hash": "0x..." } }  // Quote cast embed
  ],
  "idempotency_key": "unique-id"  // Optional: prevents duplicate posts on retry
}

// Response (success)
{
  "success": true,
  "hash": "0xdef...",             // Cast hash
  "fid": 12345                    // FID that posted
}

// Response (error)
{
  "success": false,
  "error": "Invalid request",
  "code": "INVALID_MESSAGE"
}
```

#### POST /reaction

Sign and submit a reaction (like, recast).

```typescript
// Request
{
  "account_id": "uuid",
  "type": "like" | "recast",
  "target": {
    "fid": 12345,
    "hash": "0xabc..."
  }
}

// Response
{
  "success": true,
  "hash": "0x..."
}
```

#### DELETE /reaction

Remove a reaction.

```typescript
// Request
{
  "account_id": "uuid",
  "type": "like" | "recast",
  "target": {
    "fid": 12345,
    "hash": "0xabc..."
  }
}
```

#### POST /follow

Follow a user.

```typescript
// Request
{
  "account_id": "uuid",
  "target_fid": 67890
}
```

#### DELETE /follow

Unfollow a user.

```typescript
// Request
{
  "account_id": "uuid",
  "target_fid": 67890
}
```

#### DELETE /cast

Remove a cast.

```typescript
// Request
{
  "account_id": "uuid",
  "cast_hash": "0xabc..."
}
```

### Audit Log Table

```sql
-- supabase/migrations/YYYYMMDD_signing_audit_log.sql
CREATE TABLE signing_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,  -- 'cast', 'remove_cast', 'like', 'recast', 'follow', 'unfollow'
  success BOOLEAN NOT NULL,
  error_code TEXT,  -- null on success, error code on failure
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying by account or user
CREATE INDEX idx_audit_account ON signing_audit_log(account_id, created_at DESC);
CREATE INDEX idx_audit_user ON signing_audit_log(user_id, created_at DESC);

-- RLS: Users can read their own audit logs, service can write
ALTER TABLE signing_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own audit logs"
  ON signing_audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Idempotency cache (prevents duplicate posts on retry)
CREATE TABLE signing_idempotency (
  idempotency_key TEXT NOT NULL,
  account_id UUID REFERENCES accounts(id) NOT NULL,
  response_hash TEXT,  -- Cast hash if successful
  response_error TEXT, -- Error code if failed
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (idempotency_key, account_id)
);

-- Auto-expire old entries (keep for 24 hours)
CREATE INDEX idx_idempotency_created ON signing_idempotency(created_at);
-- Run cleanup: DELETE FROM signing_idempotency WHERE created_at < now() - interval '24 hours'
```

### Request Flow

```
1. Client sends request with OAuth token
2. Edge Function validates token (using anon key + JWT), extracts user_id
3. Query account with user_id constraint (RLS enforced automatically)
4. If idempotency_key provided, check signing_idempotency table
   - If found, return cached response immediately
5. Validate message structure (basic checks)
6. Resolve channel_id to parent_url if provided
7. Get private key from decrypted_accounts (RLS enforced)
8. Sign message using @farcaster/hub-web
9. Submit to Hub
10. If idempotency_key provided, store result in signing_idempotency
11. Log to audit table (account_id, action, success/fail)
12. Return hash to client
```

### Key Files

**New files:**

- `supabase/functions/farcaster-signer/index.ts` - Main entry point, routing
- `supabase/functions/farcaster-signer/handlers/cast.ts` - Cast signing
- `supabase/functions/farcaster-signer/handlers/reaction.ts` - Reaction signing
- `supabase/functions/farcaster-signer/handlers/follow.ts` - Follow signing
- `supabase/functions/farcaster-signer/lib/auth.ts` - Token validation, user extraction
- `supabase/functions/farcaster-signer/lib/validate.ts` - Message validation
- `supabase/functions/farcaster-signer/lib/sign.ts` - Signing logic (uses @farcaster/hub-web)
- `supabase/functions/farcaster-signer/lib/audit.ts` - Audit logging helper
- `supabase/functions/farcaster-signer/lib/idempotency.ts` - Idempotency cache helper
- `supabase/functions/farcaster-signer/lib/channels.ts` - Channel ID to URL resolution
- `supabase/migrations/YYYYMMDD_signing_service.sql` - Audit log + idempotency tables

**Modified files:**

- `src/common/helpers/farcaster.ts` - Replace `submitCast()` to call signing service
- `src/stores/useDraftStore.ts` - Update `publishDraftById()` to use signing service
- All frontend code that currently uses private keys directly

**Existing code to leverage:**

- `src/common/helpers/farcaster.ts` - Reuse `formatPlaintextToHubCastMessage()` logic
- `@farcaster/hub-web` - Same signing library, just runs server-side now

### Frontend Migration

**Before (current):**

```typescript
// Frontend fetches decrypted key
const account = await getDecryptedAccount(accountId);

// Frontend signs locally
const hash = await submitCast({
  text,
  signerPrivateKey: account.privateKey,  // Key exposed to frontend!
  fid: account.platformAccountId,
  ...
});
```

**After (new):**

```typescript
// Frontend calls signing service
const response = await fetch('/functions/v1/farcaster-signer/cast', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${supabaseSession.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    account_id: accountId,
    text,
    parent_url,
    embeds,
  }),
});

const { hash, error } = await response.json();
```

**Migration strategy: Big bang**

- Update all signing calls in one release
- Test thoroughly in staging
- Deploy frontend + signing service together
- No backward compatibility needed (internal change)

## Edge Cases

1. **Account not found**: 404 with `{ error: "Account not found", code: "ACCOUNT_NOT_FOUND" }`
2. **Account not owned by user**: 403 with `{ error: "Access denied", code: "ACCESS_DENIED" }`
3. **Account pending**: 400 with `{ error: "Account not active", code: "ACCOUNT_PENDING" }`
4. **Invalid message**: 400 with `{ error: "Invalid message: {details}", code: "INVALID_MESSAGE" }`
5. **Hub error**: 502 with `{ error: "Hub submission failed: {details}", code: "HUB_ERROR" }`
6. **Token expired**: 401 - client should refresh token
7. **Channel not found**: 400 with `{ error: "Channel not found: {channel_id}", code: "CHANNEL_NOT_FOUND" }`
8. **Both channel_id and parent_url**: 400 with `{ error: "Use channel_id or parent_url, not both", code: "INVALID_MESSAGE" }`
9. **Duplicate idempotency_key**: 200 with cached response (same hash as original request)
10. **Quote cast not found**: 400 with `{ error: "Quoted cast not found", code: "QUOTE_NOT_FOUND" }`

## Testing Strategy

Tests live in `supabase/functions/farcaster-signer/tests/`

### Unit Tests (`tests/unit/`)

**Validation tests (`validate.test.ts`):**

```typescript
describe('validateCastMessage', () => {
  it('accepts valid cast with text only');
  it('accepts valid cast with URL embeds');
  it('accepts valid cast with quote cast embed');
  it('accepts valid cast with mixed embeds (URL + quote)');
  it('accepts valid cast with parent_url');
  it('accepts valid cast with channel_id');
  it('accepts valid cast with parent_cast_id');
  it('accepts valid cast with idempotency_key');
  it('rejects empty text');
  it('rejects text over 1024 chars');
  it('rejects more than 2 embeds');
  it('rejects invalid embed URL format');
  it('rejects invalid quote cast hash format');
  it('rejects invalid parent_cast_id hash format');
  it('rejects both channel_id and parent_url together');
});

describe('validateReaction', () => {
  it('accepts valid like');
  it('accepts valid recast');
  it('rejects invalid reaction type');
  it('rejects missing target');
  it('rejects invalid target hash format');
});

describe('idempotency', () => {
  it('processes first request with idempotency_key');
  it('returns cached result for duplicate idempotency_key');
  it('allows same content with different idempotency_key');
});
```

### Integration Tests (`tests/integration/`)

**Auth tests (`auth.test.ts`):**

```typescript
describe('authentication', () => {
  it('accepts valid Supabase access token');
  it('rejects missing Authorization header', async () => {
    const res = await fetch(SIGNER_URL + '/cast', {
      method: 'POST',
      body: JSON.stringify({ account_id: 'xxx', text: 'test' }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });
  it('rejects invalid token');
  it('rejects expired token');
  it('rejects malformed token');
});
```

**Account ownership tests (`ownership.test.ts`):** **(CRITICAL)**

```typescript
describe('account ownership', () => {
  // Setup: Create two users with their own accounts
  let userA: { token: string; accountId: string };
  let userB: { token: string; accountId: string };

  beforeAll(async () => {
    userA = await createTestUserWithAccount();
    userB = await createTestUserWithAccount();
  });

  it('user can sign with their own account', async () => {
    const res = await fetch(SIGNER_URL + '/cast', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ account_id: userA.accountId, text: 'test' }),
    });
    expect(res.status).toBe(200);
  });

  it("user CANNOT sign with another user's account", async () => {
    const res = await fetch(SIGNER_URL + '/cast', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ account_id: userB.accountId, text: 'test' }),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'ACCESS_DENIED' });
  });

  it('returns 404 for non-existent account', async () => {
    const res = await fetch(SIGNER_URL + '/cast', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ account_id: 'non-existent-uuid', text: 'test' }),
    });
    expect(res.status).toBe(404);
  });

  it('rejects pending (non-active) accounts', async () => {
    const pendingAccount = await createPendingAccount(userA.token);
    const res = await fetch(SIGNER_URL + '/cast', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ account_id: pendingAccount.id, text: 'test' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'ACCOUNT_PENDING' });
  });
});
```

**Handler tests (`handlers.test.ts`):**

```typescript
describe('POST /cast', () => {
  it('signs and submits valid cast');
  it('returns cast hash on success');
  it('handles parent_url correctly');
  it('handles parent_cast_id correctly');
  it('handles embeds correctly');
  it('returns error for invalid request body');
});

describe('POST /reaction', () => {
  it('signs like reaction');
  it('signs recast reaction');
  it('rejects invalid reaction type');
});

describe('DELETE /reaction', () => {
  it('removes like');
  it('removes recast');
});

describe('POST /follow', () => {
  it('signs follow');
  it('rejects invalid target_fid');
});

describe('DELETE /follow', () => {
  it('signs unfollow');
});

describe('DELETE /cast', () => {
  it('removes cast');
  it('rejects if cast not owned by account');
});
```

### E2E Tests (`tests/e2e/`)

These tests hit real Farcaster infrastructure (use testnet or controlled test account).

**Full flow tests (`full-flow.test.ts`):**

```typescript
describe('E2E: Cast flow', () => {
  it('posts cast and verifies on Farcaster', async () => {
    // 1. Sign and submit cast
    const res = await fetch(SIGNER_URL + '/cast', {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({
        account_id: testAccountId,
        text: `E2E test cast ${Date.now()}`,
      }),
    });

    expect(res.status).toBe(200);
    const { hash, fid } = await res.json();

    // 2. Verify cast exists on Farcaster via Neynar API
    await waitFor(5000); // Allow propagation
    const cast = await neynarClient.lookupCast(hash);
    expect(cast).toBeDefined();
    expect(cast.author.fid).toBe(fid);

    // 3. Verify audit log entry exists
    const auditLog = await supabase
      .from('signing_audit_log')
      .select('*')
      .eq('account_id', testAccountId)
      .order('created_at', { ascending: false })
      .limit(1);
    expect(auditLog.data[0].action).toBe('cast');
    expect(auditLog.data[0].success).toBe(true);
  });
});

describe('E2E: Reactions', () => {
  it('likes cast and verifies', async () => {
    // Like
    await fetch(SIGNER_URL + '/reaction', {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({
        account_id: testAccountId,
        type: 'like',
        target: { fid: targetFid, hash: targetHash },
      }),
    });

    // Verify via Neynar
    await waitFor(3000);
    const reactions = await neynarClient.fetchCastReactions(targetHash);
    expect(reactions.likes.some((l) => l.fid === testFid)).toBe(true);
  });

  it('unlikes cast and verifies removed');
  it('recasts and verifies');
  it('removes recast and verifies');
});

describe('E2E: Follow', () => {
  it('follows user and verifies');
  it('unfollows user and verifies');
});
```

### Test Infrastructure

**Test utilities (`tests/helpers/`):**

```typescript
// tests/helpers/setup.ts
export async function createTestUserWithAccount() {
  // Create Supabase user
  // Create Farcaster account linked to user
  // Return { token, accountId, fid }
}

export async function createPendingAccount(token: string) {
  // Create account in 'pending' status
}

// tests/helpers/api.ts
export async function signCast(token: string, accountId: string, text: string) {
  return fetch(SIGNER_URL + '/cast', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_id: accountId, text }),
  });
}

// Similar helpers for signLike, signRecast, signFollow, etc.
```

**CI Configuration (`.github/workflows/signing-service-tests.yml`):**

```yaml
name: Signing Service Tests

on:
  push:
    paths:
      - 'supabase/functions/farcaster-signer/**'
  pull_request:
    paths:
      - 'supabase/functions/farcaster-signer/**'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v1
      - run: deno test supabase/functions/farcaster-signer/tests/unit/

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: supabase functions serve farcaster-signer &
      - run: deno test supabase/functions/farcaster-signer/tests/integration/

  e2e-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' # Only on main
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: deno test supabase/functions/farcaster-signer/tests/e2e/
    env:
      TEST_FARCASTER_FID: ${{ secrets.TEST_FARCASTER_FID }}
      TEST_SUPABASE_TOKEN: ${{ secrets.TEST_SUPABASE_TOKEN }}
```

### Test Coverage Requirements

| Category       | Minimum Coverage         |
| -------------- | ------------------------ |
| Auth/ownership | 100% (critical security) |
| Validation     | 80%                      |
| Handlers       | 80%                      |
| E2E flows      | All happy paths          |

## Relationship to MCP Server

The MCP server becomes a **thin adapter**:

```
MCP Server receives: post_cast tool call
MCP Server does:
  1. Extract user_id from MCP OAuth token
  2. Look up account_id from username (if needed)
  3. Call signing service with same OAuth token
  4. Return result to MCP client
```

**MCP server does NOT:**

- Handle private keys
- Implement signing logic
- Manage rate limits

This means the MCP spec should be updated to show MCP calling the signing service, not a separate `/api/mcp/publish` route.

---

## Implementation Order

1. **Phase 1: Signing Service** (this spec)

   - Build Edge Function with all handlers
   - Add rate limits table
   - Test thoroughly

2. **Phase 2: Frontend Migration**

   - Update all signing calls to use service
   - Remove key decryption from frontend
   - Test all features

3. **Phase 3: MCP Server** (updated spec)
   - MCP server calls signing service
   - Much simpler implementation
   - Inherits rate limits automatically

---

## Implementation Summary (2026-01-22)

### Files Created

| Category      | Files                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Core**      | `supabase/functions/farcaster-signer/index.ts`, `deno.json`                                                                                                  |
| **Libraries** | `lib/auth.ts`, `lib/accounts.ts`, `lib/validate.ts`, `lib/sign.ts`, `lib/errors.ts`, `lib/types.ts`, `lib/audit.ts`, `lib/idempotency.ts`, `lib/channels.ts` |
| **Handlers**  | `handlers/cast.ts`, `handlers/reaction.ts`, `handlers/follow.ts`                                                                                             |
| **Migration** | `supabase/migrations/20260122000000_signing_service.sql`                                                                                                     |

### P0 Issues Found & Fixed (Codex Review)

| Issue                    | Problem                                                | Fix Applied                                       |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------- |
| CORS missing DELETE      | Only POST/OPTIONS allowed, DELETE endpoints would fail | Added DELETE to `Access-Control-Allow-Methods`    |
| Buffer.from() in Deno    | Node.js Buffer not available in Deno runtime           | Replaced with native hex-to-bytes conversion loop |
| Zod version mismatch     | validate.ts used v3.22.4, deno.json specified v3.23.8  | Aligned to v3.23.8                                |
| Audit RLS too permissive | Anyone could insert audit logs for any user            | Changed policy to `auth.uid() = user_id`          |
| Error code mapping       | ACCOUNT_PENDING mapped to ACCOUNT_NOT_FOUND            | Now uses distinct ACCOUNT_PENDING code            |
| Wrong HTTP status        | ACCOUNT_PENDING returned 403                           | Changed to 400 per spec                           |

### Known P1 Issues (Not Yet Fixed)

| Issue                    | Description                                                                                         | Impact                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Duplicate Hub client     | `handlers/reaction.ts` and `handlers/follow.ts` have their own Hub implementations without failover | If primary Hub is down, reactions/follows fail while casts succeed |
| Missing JSON parse error | Reaction/Follow handlers don't wrap `req.json()` in try/catch                                       | Invalid JSON returns 500 instead of 400                            |

### Testing Commands

```bash
# 1. Start local Supabase
supabase start

# 2. Apply migration (if not already applied)
supabase db push

# 3. Serve the function locally
supabase functions serve farcaster-signer --no-verify-jwt

# 4. Create test users in Supabase Studio (http://localhost:54323)
#    - Authentication > Users > Add User
#    - test-user-1@herocast.test / test-password-123
#    - test-user-2@herocast.test / test-password-456

# 5. Create test accounts for those users (Table Editor > accounts)
#    - Set status = 'active'
#    - Set platform_account_id = <FID>
#    - Set private_key = <Farcaster signer key>

# 6. Run integration tests (validation only - no Hub required)
cd supabase/functions/farcaster-signer
SKIP_E2E_TESTS=true ./tests/run-tests.sh

# 7. Run E2E tests (requires Hub connectivity + real signer keys)
./tests/run-tests.sh --e2e

# Manual test: Cast endpoint
curl -X POST http://localhost:54321/functions/v1/farcaster-signer/cast \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"account_id": "<uuid>", "text": "Hello from signing service!"}'
```

### Test Files Created

| File                     | Tests                                              |
| ------------------------ | -------------------------------------------------- |
| `tests/helpers.ts`       | Test utilities: config, auth, HTTP client          |
| `tests/auth.test.ts`     | Auth validation, cross-user isolation, CORS        |
| `tests/cast.test.ts`     | Cast validation + E2E: create, idempotency, embeds |
| `tests/reaction.test.ts` | Reaction validation + E2E: like, recast            |
| `tests/follow.test.ts`   | Follow validation + E2E: follow, unfollow          |
| `tests/test-setup.sql`   | SQL template for test data                         |
| `tests/run-tests.sh`     | Test runner script                                 |
| `tests/README.md`        | Detailed test documentation                        |

### Remaining Work

- [x] Integration tests for auth and account access
- [x] Integration tests for cast, reaction, follow endpoints
- [x] Test runner script
- [ ] GitHub Actions workflow for CI
- [ ] Idempotency table cleanup cron job (can use pg_cron)
- [ ] Fix P1 issues (duplicate Hub client, JSON parse error handling)

---

## Rebuildability Checklist

- [x] Problem statement clear
- [x] Security improvement explicit
- [x] API design complete with examples
- [x] Rate limiting defined (out of scope for V1)
- [x] Migration strategy defined
- [x] Relationship to MCP clarified
- [x] Implementation order specified
- [x] Implementation summary with issues found/fixed
