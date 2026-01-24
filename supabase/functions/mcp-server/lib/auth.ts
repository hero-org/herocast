import { createClient } from '@supabase/supabase-js';
import type { AuthContext } from './types.ts';

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

  return {
    supabaseClient,
    userId: user.id,
    token,
  };
}
