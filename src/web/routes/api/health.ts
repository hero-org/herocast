import { createFileRoute } from '@tanstack/react-router';
import { serverEnv } from '@/web/lib/env.server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/web/lib/supabase/server.server';

// GET /api/health — forkability self-check. Confirms the worker is live on workerd
// and reports whether the required secrets resolved (presence only, never values), so
// a fork can verify `wrangler secret put ...` worked. Also reports a small runtime
// self-check (process / Cache API availability) that the Phase-0 spike relied on.
// Server route handler -> runs on the edge.
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          ok: true,
          phase: 'phase-1-foundation',
          runtime: {
            // Read inside the handler — module-scope `cloudflare:workers` reads are
            // undefined on workerd.
            hasProcess: typeof (globalThis as { process?: unknown }).process !== 'undefined',
            hasCachesDefault: Boolean((globalThis as { caches?: { default?: unknown } }).caches?.default),
            userAgent: (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? null,
          },
          // Boolean presence only — never echo secret values.
          secrets: {
            NEYNAR_API_KEY: Boolean(serverEnv('NEYNAR_API_KEY')),
            SUPABASE_URL: Boolean(getSupabaseUrl()),
            SUPABASE_ANON_KEY: Boolean(getSupabaseAnonKey()),
          },
        });
      },
    },
  },
});
