import type { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

const DEFAULT_LIMIT = 15;

interface FollowingFeedOptions {
  limit?: number;
  enabled?: boolean;
}

interface FollowingFeedResponse {
  casts: CastWithInteractions[];
  next?: {
    cursor: string;
  };
}

/**
 * Fetches the following feed for a specific user from the server-side API
 *
 * Phase 2 migration - replaces legacy getFeed logic for FOLLOWING feed.
 * Benefits:
 * - Automatic request deduplication
 * - Built-in caching with configurable staleness
 * - Automatic retry on failure
 * - Loading/error states managed automatically
 */
async function fetchFollowingFeed(
  fid: string,
  options?: { cursor?: string; limit?: number }
): Promise<FollowingFeedResponse> {
  const { cursor, limit = DEFAULT_LIMIT } = options ?? {};

  const params = new URLSearchParams();
  params.append('fid', fid);
  params.append('limit', limit.toString());
  if (cursor) params.append('cursor', cursor);

  const response = await fetch(`/api/feeds/following?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch following feed');

  return response.json();
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
    queryFn: () => fetchFollowingFeed(fid, { limit }),
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
    queryFn: ({ pageParam }) => fetchFollowingFeed(fid, { cursor: pageParam, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    enabled: enabled && !!fid,
    staleTime: 1000 * 60 * 2, // 2 minutes for following feed
  });
}

/**
 * Helper to flatten infinite query pages into a single cast array
 */
export function flattenFollowingFeedPages(
  data: { pages: FollowingFeedResponse[] } | undefined
): CastWithInteractions[] {
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
