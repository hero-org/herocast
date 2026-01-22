import { createClient } from '@supabase/supabase-js';
import { AuthResult } from './types.ts';
import { ErrorCodes, SignerServiceError } from './errors.ts';

/**
 * Authenticates a request using the Authorization header.
 *
 * Creates a Supabase client with the user's JWT token (not service role)
 * to ensure RLS policies are enforced for all subsequent queries.
 *
 * @param authHeader - The Authorization header value (e.g., "Bearer <token>")
 * @returns AuthResult containing userId and authenticated Supabase client
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
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

  return {
    userId: user.id,
    supabaseClient,
  };
}
