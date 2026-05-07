import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { FarcasterCast } from '@/common/types/farcaster';
import { apiFetch } from '@/lib/api-contracts';
import { followingFeedResponseSchema } from '@/lib/api-contracts/feeds-following';
import type { FeedResponse } from '@/lib/farcaster/providers';
import { queryKeys } from '@/lib/queryKeys';

const DEFAULT_LIMIT = 15;

interface FollowingFeedOptions {
  limit?: number;
  enabled?: boolean;
}

/**
 * Build the following-feed URL with serialized query params.
 * Centralized so request/response stay in lockstep with the contract schema.
 */
function buildFollowingFeedUrl(fid: number, limit: number, cursor?: string): string {
  const params = new URLSearchParams({ fid: String(fid), limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return `/api/feeds/following?${params.toString()}`;
}

/**
 * Fetch + Zod-validate one page of the following feed via the API contract.
 * The schema treats `casts` as `unknown[]`; consumers narrow to `FarcasterCast[]`.
 */
async function fetchFollowingFeedPage(
  fid: number,
  limit: number,
  cursor: string | undefined,
  signal?: AbortSignal
): Promise<FeedResponse> {
  const data = await apiFetch(followingFeedResponseSchema, buildFollowingFeedUrl(fid, limit, cursor), {
    signal,
    perfName: 'feed:following',
  });
  return {
    casts: data.casts as FarcasterCast[],
    next: data.next,
  };
}

/**
 * Hook for fetching a single page of following feed
 *
 * Use this for simple cases where pagination is handled manually.
 */
export function useFollowingFeed(fid: string, options?: FollowingFeedOptions) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};

  return useQuery({
    queryKey: queryKeys.feeds.following(fid, { limit }),
    queryFn: ({ signal }) => fetchFollowingFeedPage(Number(fid), limit, undefined, signal),
    enabled: enabled && !!fid,
    // Override defaults for feed data which changes frequently
    staleTime: 1000 * 60 * 2, // 2 minutes for following feed
  });
}

/**
 * Hook for infinite scrolling following feed
 *
 * Use this for the main feed view with cursor-based pagination.
 * Provides automatic page merging and deduplication.
 */
export function useFollowingFeedInfinite(fid: string, options?: FollowingFeedOptions) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};

  return useInfiniteQuery({
    queryKey: queryKeys.feeds.following(fid, { limit }),
    queryFn: ({ pageParam, signal }) => fetchFollowingFeedPage(Number(fid), limit, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    enabled: enabled && !!fid,
    staleTime: 1000 * 60 * 2, // 2 minutes for following feed
  });
}

/**
 * Helper to flatten infinite query pages into a single cast array
 */
export function flattenFollowingFeedPages(data: { pages: FeedResponse[] } | undefined): FarcasterCast[] {
  if (!data?.pages) return [];

  // Flatten all pages and deduplicate by hash
  const allCasts = data.pages.flatMap((page) => page.casts);
  const seen = new Set<string>();
  return allCasts.filter((cast) => {
    if (seen.has(cast.hash)) return false;
    seen.add(cast.hash);
    return true;
  });
}
