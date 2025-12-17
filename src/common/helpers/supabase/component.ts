import { Database } from '@/common/types/database.types';
import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient<Database> | null = null;

export function createClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During SSR/build, environment variables may not be available
  // Return the cached instance or create a new one only when env vars are present
  if (!url || !anonKey) {
    if (typeof window === 'undefined') {
      // During SSR/build, throw a more descriptive error or return a mock
      // For prerendering, we shouldn't reach this code path if components are properly wrapped
      throw new Error(
        'Supabase client cannot be created during server-side rendering without environment variables. ' +
          'Ensure this code only runs on the client side.'
      );
    }
    throw new Error(
      "Your project's URL and Key are required to create a Supabase client!\n\n" +
        "Check your Supabase project's API settings to find these values\n\n" +
        'https://supabase.com/dashboard/project/_/settings/api'
    );
  }

  // Return cached instance for client-side singleton pattern
  if (supabaseInstance) {
    return supabaseInstance;
  }

  supabaseInstance = createBrowserClient<Database>(url, anonKey);
  return supabaseInstance;
}
