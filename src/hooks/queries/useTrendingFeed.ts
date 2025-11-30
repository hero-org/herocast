import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { queryKeys } from '@/lib/queryKeys';

const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);

const DEFAULT_LIMIT = 10;

interface TrendingFeedOptions {
  limit?: number;
  enabled?: boolean;
}

interface TrendingFeedResponse {
  casts: CastWithInteractions[];
  next?: {
    cursor: string;
  };
}

/**
 * Fetches the trending feed from Neynar API
 *
 * This is a Phase 1 validation hook to test React Query integration.
 * Benefits over current implementation:
 * - Automatic request deduplication
 * - Built-in caching with configurable staleness
 * - Automatic retry on failure
 * - Loading/error states managed automatically
 */
async function fetchTrendingFeed(options?: {
  cursor?: string;
  limit?: number;
}): Promise<TrendingFeedResponse> {
  const { cursor, limit = DEFAULT_LIMIT } = options ?? {};

  const response = await neynarClient.fetchTrendingFeed({
    limit,
    cursor,
  });

  return {
    casts: response.casts,
    next: response.next,
  };
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
    queryFn: () => fetchTrendingFeed({ limit }),
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
    queryFn: ({ pageParam }) => fetchTrendingFeed({ cursor: pageParam, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes for trending feed
  });
}

/**
 * Helper to flatten infinite query pages into a single cast array
 */
export function flattenTrendingFeedPages(
  data: { pages: TrendingFeedResponse[] } | undefined
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
