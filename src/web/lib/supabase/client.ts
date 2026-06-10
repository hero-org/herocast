// Browser Supabase client (singleton). Port of the repo-root
// src/common/helpers/supabase/component.ts — only the env source changes:
// `import.meta.env.VITE_*` instead of `process.env.NEXT_PUBLIC_*`.
//
// IMPORTANT: Vite inlines VITE_* at BUILD time from `.env.local` (or the shell) — NOT
// from `.dev.vars` (which is worker-runtime only).
//
// DORMANT in Phase 1 (no client component calls it yet); the auth read/write paths
// run server-side (see ./server.ts). Wired into client components in Phase 2.
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Add them to .env.local ' +
        'so Vite inlines them into the client bundle at build time.'
    );
  }

  if (supabaseInstance) return supabaseInstance;
  supabaseInstance = createBrowserClient(url, anonKey);
  return supabaseInstance;
}
