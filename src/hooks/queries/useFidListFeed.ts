import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { FarcasterCast } from '@/common/types/farcaster';
import type { FeedResponse } from '@/lib/farcaster/providers';
import { getProvider } from '@/lib/farcaster/providers';
import { queryKeys } from '@/lib/queryKeys';

const DEFAULT_LIMIT = 15;

interface FidListFeedOptions {
  limit?: number;
  enabled?: boolean;
}

/**
 * Helper to create a stable hash from FID array for cache invalidation
 */
function createFidsHash(fids: string[]): string {
  return fids.slice().sort().join(',');
}

/**
 * Hook for fetching a single page of FID list feed
 *
 * Use this for simple cases where pagination is handled manually.
 */
export function useFidListFeed(listId: string, fids: string[], viewerFid: string, options?: FidListFeedOptions) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};
  const contentsHash = createFidsHash(fids);

  return useQuery({
    queryKey: queryKeys.feeds.list(listId, { limit, contentsHash }),
    queryFn: ({ signal }) =>
      getProvider().getFidListFeed({ fids: fids.map(Number), viewerFid: Number(viewerFid), limit, signal }),
    enabled: enabled && fids.length > 0 && !!viewerFid,
    // Override defaults for feed data which changes frequently
    staleTime: 1000 * 60 * 2, // 2 minutes for FID list feed
  });
}

/**
 * Hook for infinite scrolling FID list feed
 *
 * Use this for the main feed view with cursor-based pagination.
 * Provides automatic page merging and deduplication.
 */
export function useFidListFeedInfinite(
  listId: string,
  fids: string[],
  viewerFid: string,
  options?: FidListFeedOptions
) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};
  const contentsHash = createFidsHash(fids);

  return useInfiniteQuery({
    queryKey: queryKeys.feeds.list(listId, { limit, contentsHash }),
    queryFn: ({ pageParam, signal }) =>
      getProvider().getFidListFeed({
        fids: fids.map(Number),
        viewerFid: Number(viewerFid),
        limit,
        cursor: pageParam,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    enabled: enabled && fids.length > 0 && !!viewerFid,
    staleTime: 1000 * 60 * 2, // 2 minutes for FID list feed
  });
}

/**
 * Helper to flatten infinite query pages into a single cast array
 */
export function flattenFidListFeedPages(data: { pages: FeedResponse[] } | undefined): FarcasterCast[] {
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
