# MCP OAuth 2.1 Discovery PRD (Phase 0)

## Overview

Enable OAuth 2.1 authentication for the Herocast MCP server using Supabase Auth so Claude Code can connect via browser-based login. This PRD captures discovery objectives, unknowns, and next steps before implementation.

## Goals (Discovery)

- Validate Supabase OAuth 2.1 + MCP auth flow works end-to-end for Claude Code.
- Define canonical MCP resource URI (`https://mcp.herocast.xyz/mcp`) and required metadata.
- Confirm dynamic client registration (DCR) is acceptable for easier setup.
- Map the minimal consent UI requirements for Supabase OAuth 2.1.
- Identify implementation risks early (headers, caching, resource mismatch, RLS).

## Non-Goals (Discovery)

- No production code changes beyond low-risk spikes.
- No custom token system (OAuth only).
- No full UI polish for consent screens.

## Current State

- MCP server is a Supabase Edge Function (`supabase/functions/mcp-server/`) and expects Supabase JWTs.
- Signing service already validates Supabase JWTs; OAuth tokens should work without changes.
- No existing `.well-known` routes or OAuth consent UI in the Next.js app.

## Proposed OAuth Architecture (Target)

- **Resource server**: `mcp.herocast.xyz/mcp` (Next.js route proxying to Supabase Edge Function).
- **Protected Resource Metadata**: `https://mcp.herocast.xyz/.well-known/oauth-protected-resource`
- **Auth server**: Supabase OAuth 2.1 (`https://<project-ref>.supabase.co/auth/v1`)
- **Discovery endpoint**: `https://<project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1`
- **Client registration**: Dynamic client registration enabled (for easy setup).
- **Consent UI**: Hosted in Next.js; user approves Claude Code access with scopes/permissions.
  - Planned path: `/oauth/consent` on `app.herocast.xyz`.

## Discovery Checklist

1. Confirm Supabase OAuth 2.1 is enabled in the project and discovery endpoint is live.
2. Verify DCR is supported and acceptable for Claude Code.
3. Determine canonical `resource` value and ensure it matches MCP server origin.
4. Test `WWW-Authenticate` flow: 401 response includes `resource_metadata` URL.
5. Confirm Claude Code OAuth flow behavior (DCR vs pre-registered client).
6. Decide token validation approach: `auth.getUser()` vs JWKS verification.
7. Identify which scopes are required (or if RLS-only is sufficient).

## Known Unknowns

- Supabase OAuth consent UI requirements and endpoints to implement in Next.js.
- `@supabase/supabase-js` version may need upgrade to access `auth.oauth.*` helpers.
- Whether Claude Code requires DCR or can use Client ID Metadata Documents.
- Whether Supabase tokens include audience claims that satisfy MCP resource checks.
- How much scope enforcement we need beyond RLS.

## Risks / Gotchas

- `WWW-Authenticate` headers may be stripped by proxies/CDNs.
- `.well-known` metadata might be cached by clients and cause confusing failures.
- OAuth beta maturity: subtle edge cases in DCR or token exchange.
- Resource/audience mismatch can cause valid tokens to fail validation.
- DCR can be abused without guardrails or rate limits.

## Next Steps (Phase 0)

- Add temporary Next.js routes for:
  - `/.well-known/oauth-protected-resource`
  - `/mcp` proxy to the Edge Function
- Update MCP server to emit `WWW-Authenticate` with `resource_metadata`.
- Run a Claude Code flow test against `mcp.herocast.xyz`.
- Document required consent UI behavior and any DCR restrictions.
- Decide validation strategy and scope model.

## References

- Supabase MCP auth: https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication
- Supabase OAuth 2.1 server: https://supabase.com/docs/guides/auth/oauth-server
- MCP Authorization spec: https://modelcontextprotocol.io/specification/draft/basic/authorization
