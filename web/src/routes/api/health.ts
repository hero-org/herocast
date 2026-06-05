import { createFileRoute } from '@tanstack/react-router';
import { getNeynarApiKey } from '@/lib/neynar';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/server';

// GET /api/health — forkability self-check. Confirms the worker is live on workerd
// and reports whether the required secrets resolved (without leaking values), so a
// fork can verify `wrangler secret put ...` worked. Server route handler -> runs on
// the edge.
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          ok: true,
          phase: 'phase-1-foundation',
          issue: 'hero-org/herocast#754',
          runtime: {
            userAgent: (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? null,
            hasProcess: typeof (globalThis as { process?: unknown }).process !== 'undefined',
            hasCachesDefault:
              typeof (globalThis as { caches?: { default?: unknown } }).caches?.default !== 'undefined',
          },
          // Boolean presence only — never echo secret values.
          secrets: {
            NEYNAR_API_KEY: Boolean(getNeynarApiKey()),
            SUPABASE_URL: Boolean(getSupabaseUrl()),
            SUPABASE_ANON_KEY: Boolean(getSupabaseAnonKey()),
          },
        });
      },
    },
  },
});
