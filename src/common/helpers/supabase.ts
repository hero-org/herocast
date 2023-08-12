import { createClient } from '@supabase/supabase-js'

export const VITE_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const VITE_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const options = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
}
export const supabaseClient = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, options)
