import type { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

const DEFAULT_LIMIT = 15;

interface FidListFeedOptions {
  limit?: number;
  enabled?: boolean;
}

interface FidListFeedResponse {
  casts: CastWithInteractions[];
  next?: {
    cursor: string;
  };
}

/**
 * Fetches feed for a FID list from the server-side API
 *
 * Phase 2 migration - replaces legacy getFeed logic for FID list feeds.
 * Benefits:
 * - Automatic request deduplication
 * - Built-in caching with configurable staleness
 * - Automatic retry on failure
 * - Loading/error states managed automatically
 */
async function fetchFidListFeed(
  fids: string[],
  viewerFid: string,
  options?: { cursor?: string; limit?: number }
): Promise<FidListFeedResponse> {
  const { cursor, limit = DEFAULT_LIMIT } = options ?? {};

  const params = new URLSearchParams();
  params.append('fids', fids.join(','));
  params.append('viewerFid', viewerFid);
  params.append('limit', limit.toString());
  if (cursor) params.append('cursor', cursor);

  const response = await fetch(`/api/lists?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch FID list feed');

  return response.json();
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
    queryFn: () => fetchFidListFeed(fids, viewerFid, { limit }),
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
    queryFn: ({ pageParam }) => fetchFidListFeed(fids, viewerFid, { cursor: pageParam, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    enabled: enabled && fids.length > 0 && !!viewerFid,
    staleTime: 1000 * 60 * 2, // 2 minutes for FID list feed
  });
}

/**
 * Helper to flatten infinite query pages into a single cast array
 */
export function flattenFidListFeedPages(data: { pages: FidListFeedResponse[] } | undefined): CastWithInteractions[] {
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
