import { z } from 'zod';

/**
 * Request schema for GET /api/feeds/following.
 * Coerces stringy query params (URL search params are always strings).
 */
export const followingFeedRequestSchema = z.object({
  fid: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(100).default(15),
  cursor: z.string().optional(),
});

/**
 * Response schema for GET /api/feeds/following.
 *
 * `casts` is intentionally `z.array(z.unknown())` — the cast shape is the
 * `FarcasterCast` type used outside the contract layer. Tightening the schema
 * here would couple the contract to provider-specific cast shapes; consumers
 * that need typed casts should narrow at their layer.
 *
 * This permissive variant strips unknown top-level keys silently. Callers
 * that need drift detection (e.g. tests, dev-only validation) should use
 * `followingFeedResponseSchemaStrict` instead.
 */
export const followingFeedResponseSchema = z.object({
  casts: z.array(z.unknown()),
  next: z.object({ cursor: z.string().optional() }).default({}),
});

/**
 * Strict variant of `followingFeedResponseSchema`. Rejects unknown top-level
 * keys instead of stripping them. Used by the dev-only route validator and
 * the integration test that asserts the route's actual response shape against
 * the contract — surfaces API contract drift in `pnpm check`.
 */
export const followingFeedResponseSchemaStrict = followingFeedResponseSchema.strict();

/**
 * Pure response builder for GET /api/feeds/following. Lives here (not in the
 * route file) because Next.js App Router rejects helper exports from
 * `route.ts`; see `docs/agents/app-router-exports.md`. The route imports this
 * function; tests import it to assert the route's actual response shape against
 * `followingFeedResponseSchemaStrict` without spawning the handler.
 */
export function buildFollowingFeedResponse(neynarResponse: {
  casts?: unknown[];
  next?: unknown;
}): FollowingFeedResponse {
  return {
    casts: neynarResponse.casts ?? [],
    next: (neynarResponse.next ?? {}) as FollowingFeedResponse['next'],
  };
}

export type FollowingFeedRequest = z.infer<typeof followingFeedRequestSchema>;
export type FollowingFeedResponse = z.infer<typeof followingFeedResponseSchema>;
