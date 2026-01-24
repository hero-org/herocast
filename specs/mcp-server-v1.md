# Herocast MCP Server V1 Spec

## Problem

Herocast users cannot access posting features via AI agents (Claude Code, ChatGPT, etc.) or programmatic tools. MCP (Model Context Protocol) is the emerging standard for AI tool integration, and without it, herocast is inaccessible to the growing ecosystem of AI-powered workflows. Users want to post to Farcaster from their AI assistants while maintaining the multi-account management herocast provides.

## Success Criteria

All three scenarios must pass:

1. **Claude Code post test**: User configures MCP in Claude Code, says "post hello world to Farcaster as @myaccount", cast appears on-chain within 30 seconds
2. **Multi-account switch**: User with 2+ accounts can say "post X as @account1" then "post Y as @account2" - both casts appear under correct accounts
3. **Error handling**: When user tries to post as account they don't own, they receive a clear error message (not silent failure, not wrong account)

## Scope

### In Scope

- **MCP server deployment**: Supabase Edge Function (same project as herocast)
- **OAuth 2.1 authentication**: Using Supabase OAuth Server feature
- **Tool: `post_cast`**: Post a single cast to Farcaster
  - Parameters: `text` (required), `account_id` or `account_username` (required), `channel_id` (optional), `parent_url` (optional), `parent_cast_id` (optional), `embeds` (optional, supports URL and quote cast embeds), `idempotency_key` (optional)
  - Returns: cast hash on success, error message on failure
- **Tool: `list_accounts`**: List user's connected Farcaster accounts
  - Returns: array of `{ id, username, fid, display_name }`
- **Integration tests**: Automated tests for MCP endpoints with mock auth
- **E2E tests**: Tests verifying actual posting flow
- **Auth isolation tests**: Tests verifying user A cannot access user B's accounts

### Out of Scope

- **DMs**: Too sensitive for MCP access - excluded permanently
- **Account management**: No creating/removing/linking Farcaster accounts via MCP
- **Analytics/billing**: No subscription management or analytics export
- **Rate limiting**: Not in V1 (add later)
- **Audit logging**: Not in V1 (add later)
- **Threads**: Not in V1 (add later with proper partial failure handling)
- **Scheduling**: Not in V1 (add in V2 with lists)
- **Reading feeds**: Not in V1 (focus on write operations first)
- **Lists**: Not in V1 (planned for V2)

## Constraints

### Must Follow

1. **Use Supabase OAuth Server** for authentication

   - Supabase's built-in OAuth 2.1 server issues tokens
   - Users authenticate via existing herocast login flow
   - No new auth libraries (no Clerk, Auth0, etc.)

2. **Proxy to existing API routes** for posting

   - MCP server does NOT access private keys directly
   - MCP server calls herocast's existing authenticated API routes
   - Keys remain in Supabase with existing encryption (pgsodium)
   - Follow pattern in `app/api/dms/messages/route.ts` for auth verification

3. **Same Supabase project**

   - MCP server connects to same Supabase instance as herocast
   - Uses same `accounts` table with same RLS policies
   - User identity from OAuth token maps to `auth.users.id`

4. **Stateless design**

   - No complex session state in MCP server
   - Each request validated independently via OAuth token
   - Session ID used only for MCP protocol compliance, not for auth

5. **User isolation via token binding**
   - Every request extracts `user_id` from validated OAuth token
   - Account queries always include `.eq('user_id', user.id)` constraint
   - Session IDs bound to user IDs per MCP spec: `session_key = user_id:session_id`

### Must Avoid

- **Do NOT** store or cache private keys in MCP server
- **Do NOT** trust client-provided user identity (always extract from token)
- **Do NOT** use session IDs for authentication (sessions are for context only)
- **Do NOT** add new authentication libraries or providers
- **Do NOT** implement DM features (permanently out of scope)
- **Do NOT** allow account creation/deletion via MCP

## Technical Approach

### Hosting Decision: Supabase Edge Functions

**Recommended: Supabase Edge Functions** over Cloudflare Workers or Vercel.

| Factor         | Supabase Edge                            | Cloudflare Workers     | Vercel       |
| -------------- | ---------------------------------------- | ---------------------- | ------------ |
| **Cost**       | Included in Pro ($25/mo, 2M invocations) | $5/mo + usage          | $20/user/mo  |
| **Setup**      | Already have account                     | New account + wrangler | Already have |
| **DB Access**  | Direct (same project)                    | Via API                | Via API      |
| **OAuth**      | Native Supabase OAuth Server             | Manual integration     | Manual       |
| **Cold Start** | ~50-200ms                                | <1ms                   | ~200-500ms   |

**Why Supabase wins for herocast:**

1. Already using Supabase - no new accounts/billing
2. Direct database access with RLS - no API proxy needed for account queries
3. Supabase OAuth Server is native - simpler auth flow
4. Cost included in existing Pro plan
5. Simpler architecture - fewer moving parts

**Trade-off:** Cloudflare has better cold starts and more MCP tooling, but the simplicity of staying in Supabase outweighs this for V1.

### Architecture Overview

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│   MCP Client    │────▶│         Supabase                      │
│ (Claude Code)   │     │  ┌────────────────────────────────┐  │
└─────────────────┘     │  │  Edge Function: mcp-server     │  │
                        │  │  - OAuth 2.1 via Supabase Auth │  │
                        │  │  - Translates MCP → Signing API│  │
                        │  └───────────────┬────────────────┘  │
                        │                  │ (internal call)   │
                        │                  ▼                   │
                        │  ┌────────────────────────────────┐  │
                        │  │  Edge Function: farcaster-signer│  │
                        │  │  - Signs messages              │  │
                        │  │  - Hub submission              │  │
                        │  └───────────────┬────────────────┘  │
                        │                  │                   │
                        │  ┌─────────┐  ┌──┴─────────────────┐ │
                        │  │  Auth   │  │ decrypted_accounts │ │
                        │  │ (OAuth) │  │ (private keys)     │ │
                        │  └─────────┘  └────────────────────┘ │
                        └──────────────────────────────────────┘
```

**Dependency:** MCP server requires the Farcaster Signing Service (see `specs/farcaster-signing-service.md`).
Build order: Signing Service first → then MCP Server.

### Authentication Flow

1. MCP client connects to herocast MCP server
2. Server returns 401 with OAuth metadata pointing to Supabase
3. Client initiates OAuth 2.1 flow with Supabase
4. User authenticates via herocast login (existing flow)
5. Supabase issues access token with `user_id` in claims
6. Client includes token in subsequent MCP requests
7. MCP server validates token and extracts `user_id`

### Posting Flow

1. MCP client calls `post_cast` tool with text and account identifier
2. MCP server validates OAuth token, extracts `user_id`
3. MCP server resolves account (by id or username) with `user_id` constraint
4. MCP server calls **Farcaster Signing Service** (see `specs/farcaster-signing-service.md`)
   - Passes the same OAuth token
   - Signing service handles key access, validation, and Hub submission
5. MCP server returns cast hash to client

**Note:** MCP does NOT implement signing logic - it's a thin adapter over the signing service. This means MCP automatically inherits validation and security from the signing layer.

### Key Files

**New files to create (Supabase Edge Function):**

- `supabase/functions/mcp-server/index.ts` - Main MCP server entry point
- `supabase/functions/mcp-server/tools/post-cast.ts` - Post cast tool implementation
- `supabase/functions/mcp-server/tools/list-accounts.ts` - List accounts tool
- `supabase/functions/mcp-server/deno.json` - Deno configuration with imports
- `supabase/functions/mcp-server/tests/` - Integration and E2E tests

**Prerequisite: Farcaster Signing Service**

- See `specs/farcaster-signing-service.md`
- MCP server calls signing service - does NOT implement signing itself
- No new API routes needed in herocast Next.js app

**Existing code to reference (patterns, not direct usage):**

- `app/api/dms/conversations/route.ts` - Pattern for auth verification with `user_id`
- `src/common/helpers/supabase/route.ts` - Server-side Supabase client creation

### MCP Tool Schemas

```typescript
// post_cast tool
const PostCastSchema = z
  .object({
    text: z.string().min(1).max(1024).describe('The text content of the cast'),
    account_id: z.string().uuid().optional().describe('UUID of the account to post from'),
    account_username: z.string().optional().describe('Username of the account (alternative to account_id)'),
    channel_id: z.string().optional().describe("Channel name to post in (e.g., 'neynar')"),
    parent_url: z.string().url().optional().describe('Channel URL to post in (alternative to channel_id)'),
    parent_cast_id: z
      .object({
        fid: z.number(),
        hash: z.string().regex(/^0x[a-fA-F0-9]+$/),
      })
      .optional()
      .describe('Cast to reply to'),
    embeds: z
      .array(
        z.union([
          z.object({ url: z.string().url() }), // URL embed
          z.object({ cast_id: z.object({ fid: z.number(), hash: z.string() }) }), // Quote cast
        ])
      )
      .max(2)
      .optional()
      .describe('Embeds (max 2) - URLs or quote casts'),
    idempotency_key: z.string().optional().describe('Unique key to prevent duplicate posts on retry'),
  })
  .refine((data) => data.account_id || data.account_username, {
    message: 'Either account_id or account_username is required',
  })
  .refine((data) => !(data.channel_id && data.parent_url), {
    message: 'Use either channel_id or parent_url, not both',
  });

// list_accounts tool
const ListAccountsSchema = z.object({});
// Returns: { accounts: [{ id, username, fid, display_name }] }
```

### Environment Variables

**MCP Server (Supabase Edge Function):**

```bash
# These are automatically available in Supabase Edge Functions:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY (for admin operations if needed)

# Custom secrets (set via `supabase secrets set`):
HEROCAST_API_URL=https://herocast.xyz
HEROCAST_API_SECRET=xxx  # Shared secret for internal API calls
```

**Herocast (new env var):**

```bash
MCP_API_SECRET=xxx  # Same as HEROCAST_API_SECRET above
```

### Deployment Commands

```bash
# Local development
supabase functions serve mcp-server --no-verify-jwt

# Deploy to production
supabase functions deploy mcp-server --no-verify-jwt

# Set secrets
supabase secrets set HEROCAST_API_SECRET=xxx HEROCAST_API_URL=https://herocast.xyz
```

**Note:** `--no-verify-jwt` is used because MCP handles its own OAuth 2.1 authentication. The function validates tokens via Supabase Auth internally.

## Edge Cases

1. **Account not found**: Return error `{ error: "Account not found or not accessible", code: "ACCOUNT_NOT_FOUND" }`
2. **Account not active**: Return error `{ error: "Account is pending activation", code: "ACCOUNT_PENDING" }`
3. **Text too long**: Return error with character count `{ error: "Text exceeds 1024 characters (got 1500)", code: "TEXT_TOO_LONG" }`
4. **Invalid parent cast**: Return error `{ error: "Parent cast not found", code: "PARENT_NOT_FOUND" }`
5. **Hub submission failure**: Return error with Hub error `{ error: "Failed to submit to Hub: {hub_error}", code: "HUB_ERROR" }`
6. **Token expired**: Return 401 with standard OAuth error, client should refresh
7. **User has no accounts**: Return empty array for `list_accounts`, error for `post_cast`

## Testing Strategy

### Integration Tests (Required)

Located in `mcp-server/tests/integration/`:

1. **Auth flow tests**

   - Valid token accepted
   - Invalid token rejected (401)
   - Expired token rejected (401)
   - Missing token rejected (401)

2. **Tool validation tests**

   - `post_cast` with valid params succeeds
   - `post_cast` with missing account fails
   - `post_cast` with invalid account_id fails
   - `list_accounts` returns expected format

3. **Account isolation tests** (CRITICAL)
   - User A cannot post as User B's account
   - User A cannot see User B's accounts in list
   - Invalid user_id in token returns empty/error

### E2E Tests (Required)

Located in `mcp-server/tests/e2e/`:

1. **Full posting flow**

   - Configure MCP client
   - Authenticate via OAuth
   - Call `list_accounts`
   - Call `post_cast`
   - Verify cast appears on Farcaster (via Neynar API)

2. **Multi-account flow**
   - User with 2 accounts
   - Post as account 1
   - Post as account 2
   - Verify both casts under correct accounts

### Test Infrastructure

- Use Deno's built-in test runner (`deno test`) for Supabase Edge Functions
- Mock Supabase auth for integration tests using `supabase-js` mock
- Use test Farcaster account for E2E tests
- CI runs integration tests on every PR via GitHub Actions
- E2E tests run on merge to main (with real Farcaster testnet or controlled account)
- Local testing via `supabase functions serve` with test client

## Open Questions

1. **Long casts**: Should MCP support long casts (pro feature)? Need to check pro status from user account.
2. **Embed validation**: Should MCP server validate embed URLs are reachable before posting?

## Future Considerations (V2+)

- `post_thread` tool for posting threads
- `schedule_cast` tool for scheduling posts
- `list_feed` tool for reading feeds
- `list_search` / `manage_lists` tools for list operations
- Rate limiting per user
- Webhook notifications for cast status

---

## Rebuildability Checklist

- [x] Problem statement is clear and specific
- [x] Success criteria are concrete and testable
- [x] Scope boundaries are explicit (in AND out)
- [x] Constraints reference actual codebase files
- [x] Technical approach shows architecture
- [x] Edge cases are enumerated
- [x] Test strategy is defined
- [x] No tribal knowledge assumed

**This spec is your durable artifact.** If implementation gets messy, update the spec and rebuild clean.

Before implementing: `/clear` to start with fresh context containing only this spec.
