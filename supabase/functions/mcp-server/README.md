# Herocast MCP Server (Supabase Edge Function)

Minimal MCP server exposing:

- `tools/list`
- `tools/call` for `post_cast` and `list_accounts`

## Local Dev

```bash
supabase start
supabase functions serve mcp-server --no-verify-jwt
```

Run the smoke test:

```bash
./supabase/functions/mcp-server/tests/smoke.sh
```

The smoke test reuses the signing-service seed script to create test users/accounts.

## OAuth discovery

To support MCP OAuth discovery, set the canonical resource URL so the server can emit
`WWW-Authenticate` headers:

```bash
MCP_RESOURCE_URL=https://mcp.herocast.xyz/mcp
```

## Claude Code (local)

Start Supabase and serve the functions:

```bash
supabase start
supabase functions serve farcaster-signer --no-verify-jwt
supabase functions serve mcp-server --no-verify-jwt
```

Add the MCP server to Claude Code (project scope):

```bash
./supabase/functions/mcp-server/tests/claude-setup.sh
```

Re-run the script if the token expires or you change test users.
