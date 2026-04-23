import { createClient } from '@supabase/supabase-js';
import { ErrorCodes, SignerServiceError } from './errors.ts';
import type { AuthResult } from './types.ts';

const VALID_SOURCES = /^(user|cron:publish|cron:auto-interaction|system)$/;

/**
 * Best-effort decode of a JWT's payload segment. Returns null if the token is
 * malformed — this helper is advisory only (already-validated tokens only) and
 * should never throw.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    // base64url -> base64
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Authenticates a request using the Authorization header.
 *
 * Creates a Supabase client with the user's JWT token (not service role)
 * to ensure RLS policies are enforced for all subsequent queries.
 *
 * Cron callers mint a short-lived HS256 JWT with `sub = <owner_user_id>` and
 * present it here — this path validates it identically to a human-user JWT.
 *
 * @param authHeader - The Authorization header value (e.g., "Bearer <token>")
 * @returns AuthResult containing userId and Supabase client
 * @throws SignerServiceError if authentication fails
 */
export async function authenticateRequest(authHeader: string | null): Promise<AuthResult> {
  if (!authHeader) {
    throw new SignerServiceError(ErrorCodes.MISSING_AUTH_HEADER, 'Missing Authorization header', 401);
  }

  // Extract token from "Bearer <token>" format
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token || token === authHeader) {
    throw new SignerServiceError(ErrorCodes.INVALID_TOKEN, 'Invalid Authorization header format', 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('API_URL') || Deno.env.get('SUPABASE_API_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL/API_URL or SUPABASE_ANON_KEY/ANON_KEY environment variables');
  }

  // Create Supabase client with anon key + user's JWT for RLS enforcement
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // Validate the token by getting the user
  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error) {
    // Check for specific error types
    if (error.message?.toLowerCase().includes('expired')) {
      throw new SignerServiceError(ErrorCodes.EXPIRED_TOKEN, 'Token has expired', 401);
    }
    throw new SignerServiceError(ErrorCodes.INVALID_TOKEN, `Invalid token: ${error.message}`, 401);
  }

  if (!user || !user.id) {
    throw new SignerServiceError(ErrorCodes.INVALID_TOKEN, 'Invalid token: no user found', 401);
  }

  // Extract the `source` claim so audit rows can distinguish user traffic from
  // cron-minted traffic. Default to 'user' if absent or malformed.
  const payload = decodeJwtPayload(token);
  const rawSource = payload && typeof payload.source === 'string' ? payload.source : undefined;
  const source = rawSource && VALID_SOURCES.test(rawSource) ? rawSource : 'user';

  return {
    userId: user.id,
    supabaseClient,
    source,
  };
}
