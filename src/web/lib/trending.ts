// Client-importable server-fn wrapper for the trending feed. The migration probe route
// imports `getTrendingFn` from here directly, so this module MUST stay in the client
// graph — the Start compiler replaces the handler body (and tree-shakes its server-only
// top-level imports from `trending.server`: the Neynar SDK, `neynar.server` →
// `env.server` → `cloudflare:workers`) with an RPC stub in the client bundle.
//
// The Neynar fetch + Cloudflare-Cache implementation lives in `trending.server.ts` so it
// is deny-listed out of the client deterministically (see that file). Only the server fn
// + the erased result types cross the boundary into this client-importable module.
import { createServerFn } from '@tanstack/react-start';
import {
  type Cached,
  getTrendingCached,
  type SerializableCast,
  type TrendingResult,
  toSerializableCast,
} from '@/web/lib/trending.server';

export type { Cached, SerializableCast, TrendingResult };

export const getTrendingFn = createServerFn({ method: 'GET' }).handler(async () => {
  const result = await getTrendingCached(10);
  // Simple, serializable return shape: normalized casts + the cache/diagnostic envelope.
  return {
    casts: result.casts.map(toSerializableCast),
    source: result.source,
    cacheStatus: result.cacheStatus,
    fetchedAt: result.fetchedAt,
    sdkError: result.sdkError,
  };
});
