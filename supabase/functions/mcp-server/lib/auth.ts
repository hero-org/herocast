import { createClient } from '@supabase/supabase-js';
import type { AuthContext } from './types.ts';

export async function authenticateRequest(authHeader: string | null): Promise<AuthContext> {
  // Debug logging for auth issues
  console.log('[auth] Received auth header:', authHeader ? `${authHeader.slice(0, 20)}...` : 'null');

  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token || token === authHeader) {
    console.log('[auth] Invalid format - token extraction failed');
    throw new Error('Invalid Authorization header format');
  }

  console.log('[auth] Token extracted, length:', token.length);

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
    console.log('[auth] Supabase auth.getUser error:', error.message);
    throw new Error(error.message || 'Invalid token');
  }

  if (!user?.id) {
    console.log('[auth] No user found in token');
    throw new Error('Invalid token: no user found');
  }

  console.log('[auth] Auth successful for user:', user.id);

  return {
    supabaseClient,
    userId: user.id,
    token,
  };
}
