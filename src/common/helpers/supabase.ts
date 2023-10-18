import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const options = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
}
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options)
