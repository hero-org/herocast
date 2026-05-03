import { createClient } from '@supabase/supabase-js';
import type { AuthContext } from './types.ts';
import { DEFAULT_SCOPES } from './scopes.ts';

/**
 * base64url decode (JWT-safe: no padding, uses `-` and `_`).
 * Returns the decoded UTF-8 string or `null` if the input is not valid.
 */
function decodeBase64Url(segment: string): string | null {
  try {
    // Convert base64url → base64 and pad to a multiple of 4.
    const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Extract an array of OAuth scopes from a JWT. Supports:
 *   - `scopes: string[]` (array form)
 *   - `scopes: 'a b c'` (space-separated string)
 *   - `scope:  string[]` or `scope: 'a b c'` (RFC 6749 standard claim)
 * Returns the fallback if no scope/scopes claim is present.
 *
 * NOTE: This does NOT verify the JWT signature — that's already done by
 * supabase.auth.getUser() upstream. We only read claims from a token we
 * just verified.
 */
function extractScopesFromJwt(token: string, fallback: string[]): string[] {
  const parts = token.split('.');
  if (parts.length < 2) return fallback;

  const payloadJson = decodeBase64Url(parts[1]);
  if (!payloadJson) return fallback;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    return fallback;
  }

  const raw = payload.scopes ?? payload.scope;
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === 'string');
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim().split(/\s+/);
  }
  return fallback;
}

export async function authenticateRequest(authHeader: string | null): Promise<AuthContext> {
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token || token === authHeader) {
    throw new Error('Invalid Authorization header format');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('API_URL') || Deno.env.get('SUPABASE_API_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL/API_URL or SUPABASE_ANON_KEY/ANON_KEY environment variables');
  }

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error) {
    throw new Error(error.message || 'Invalid token');
  }

  if (!user?.id) {
    throw new Error('Invalid token: no user found');
  }

  // Scope claim is OPTIONAL. If the token has no OAuth scopes (e.g. it's a
  // first-party user session), fall back to read-only. NOT full session power.
  const scopes = extractScopesFromJwt(token, DEFAULT_SCOPES as unknown as string[]);

  return {
    supabaseClient,
    userId: user.id,
    token,
    scopes,
  };
}
