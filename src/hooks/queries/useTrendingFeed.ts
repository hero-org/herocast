import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { FarcasterCast } from '@/common/types/farcaster';
import type { FeedResponse } from '@/lib/farcaster/providers';
import { getProvider } from '@/lib/farcaster/providers';
import { queryKeys } from '@/lib/queryKeys';

const DEFAULT_LIMIT = 10;

interface TrendingFeedOptions {
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching a single page of trending feed
 *
 * Use this for simple cases where pagination is handled manually.
 */
export function useTrendingFeed(options?: TrendingFeedOptions) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};

  return useQuery({
    queryKey: queryKeys.feeds.trending({ limit }),
    queryFn: ({ signal }) => getProvider().getTrendingFeed({ limit, signal }),
    enabled,
    // Override defaults for feed data which changes frequently
    staleTime: 1000 * 60 * 2, // 2 minutes for trending feed
  });
}

/**
 * Hook for infinite scrolling trending feed
 *
 * Use this for the main feed view with cursor-based pagination.
 * Provides automatic page merging and deduplication.
 */
export function useTrendingFeedInfinite(options?: TrendingFeedOptions) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};

  return useInfiniteQuery({
    queryKey: queryKeys.feeds.trending({ limit }),
    queryFn: ({ pageParam, signal }) => getProvider().getTrendingFeed({ limit, cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes for trending feed
    // Keep the previous feed painted while the new key loads — no blank frame on switch
    placeholderData: keepPreviousData,
  });
}

/**
 * Helper to flatten infinite query pages into a single cast array
 */
export function flattenTrendingFeedPages(data: { pages: FeedResponse[] } | undefined): FarcasterCast[] {
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
