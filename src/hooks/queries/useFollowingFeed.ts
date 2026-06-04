import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { FarcasterCast } from '@/common/types/farcaster';
import type { FeedResponse } from '@/lib/farcaster/providers';
import { getProvider } from '@/lib/farcaster/providers';
import { queryKeys } from '@/lib/queryKeys';

const DEFAULT_LIMIT = 15;

interface FollowingFeedOptions {
  limit?: number;
  enabled?: boolean;
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
    queryFn: ({ signal }) => getProvider().getFollowingFeed({ fid: Number(fid), limit, signal }),
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
    queryFn: ({ pageParam, signal }) =>
      getProvider().getFollowingFeed({ fid: Number(fid), limit, cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    enabled: enabled && !!fid,
    staleTime: 1000 * 60 * 2, // 2 minutes for following feed
    // Keep the previous feed painted while the new key loads — no blank frame on switch
    placeholderData: keepPreviousData,
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
