// Clean JSON evidence vehicle for the 3 unknowns. Server route handler → runs on
// workerd. curl /api/probe twice to see the Cache API flip MISS → HIT.
import { createFileRoute } from '@tanstack/react-router';
import {
  fetchTrendingViaSDK,
  fetchTrendingViaREST,
  getTrendingCached,
} from '../../lib/trending';
import { getUserFromRequest } from '../../lib/getUser';

function envVar(key: string): string {
  return (globalThis as any).process?.env?.[key] ?? '';
}

export const Route = createFileRoute('/api/probe')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const neynarKey = envVar('NEYNAR_API_KEY');
        const supabaseUrl = envVar('SUPABASE_URL');
        const anonKey = envVar('SUPABASE_ANON_KEY');

        const runtime = {
          hasCachesDefault: typeof (globalThis as any).caches?.default !== 'undefined',
          hasProcess: typeof (globalThis as any).process !== 'undefined',
          neynarKeyPresent: Boolean(neynarKey),
          supabaseEnvPresent: Boolean(supabaseUrl && anonKey),
          userAgent: (globalThis as any).navigator?.userAgent ?? null,
        };

        // Q1 — isolate the SDK path on its own so we capture the raw error if it
        // fails on workerd, independent of the fallback.
        let q1_sdk: any;
        try {
          const r = await fetchTrendingViaSDK(neynarKey, 3);
          q1_sdk = { ok: true, count: r.casts.length, firstAuthor: r.casts?.[0]?.author?.username ?? null };
        } catch (e: any) {
          q1_sdk = { ok: false, error: String(e?.stack || e?.message || e).slice(0, 1200) };
        }

        // Q1 fallback — inline REST over native fetch.
        let q1_rest: any;
        try {
          const r = await fetchTrendingViaREST(neynarKey, 3);
          q1_rest = { ok: true, count: r.casts.length, firstAuthor: r.casts?.[0]?.author?.username ?? null };
        } catch (e: any) {
          q1_rest = { ok: false, error: String(e?.message || e).slice(0, 400) };
        }

        // Q2 — cached trending (Cache API). cacheStatus reveals MISS then HIT.
        const q2_cached = await getTrendingCached(neynarKey, 10);

        // Q3 — Supabase getUser() from request cookie.
        const q3_auth = await getUserFromRequest(request, supabaseUrl, anonKey);

        return Response.json({
          runtime,
          q1_neynar_sdk: q1_sdk,
          q1_neynar_rest: q1_rest,
          q2_cache: {
            cacheStatus: q2_cached.cacheStatus,
            source: q2_cached.source,
            fetchedAt: q2_cached.fetchedAt,
            count: q2_cached.count,
          },
          q3_supabase: q3_auth,
        });
      },
    },
  },
});
