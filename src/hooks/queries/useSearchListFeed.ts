import { useInfiniteQuery } from '@tanstack/react-query';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { queryKeys } from '@/lib/queryKeys';
import { searchService, SearchFilters } from '@/services/searchService';
import { Interval } from '@/common/types/types';

const DEFAULT_LIMIT = 15;

interface SearchListFeedOptions {
  limit?: number;
  enabled?: boolean;
}

interface SearchListFeedResponse {
  casts: CastWithInteractions[];
}

/**
 * Generates a hash of search list contents for query key stability
 */
function hashSearchListContents(term: string, filters?: SearchFilters): string {
  return JSON.stringify({ term, filters });
}

/**
 * Fetches a search list feed using the search service
 *
 * Uses offset-based pagination for search results. The search service returns
 * matching casts based on the search term and filters.
 */
async function fetchSearchListFeed(
  term: string,
  filters: SearchFilters | undefined,
  viewerFid: string,
  options?: { offset?: number; limit?: number }
): Promise<SearchListFeedResponse> {
  const { offset = 0, limit = DEFAULT_LIMIT } = options ?? {};

  // Set default filters if not provided, always set interval for searches
  const effectiveFilters: SearchFilters = {
    ...filters,
    interval: Interval.d7,
  };

  const result = await searchService.searchWithCasts({
    searchTerm: term,
    filters: effectiveFilters,
    viewerFid,
    limit,
    offset,
  });

  return { casts: result.casts };
}

/**
 * Hook for infinite scrolling search list feed
 *
 * Uses offset-based pagination for search results. The hook automatically
 * calculates the next offset based on the number of pages fetched.
 *
 * Phase 2 migration - enables React Query for search list feeds.
 * Benefits:
 * - Automatic request deduplication
 * - Built-in caching with configurable staleness
 * - Automatic retry on failure
 * - Loading/error states managed automatically
 */
export function useSearchListFeedInfinite(
  listId: string,
  term: string,
  filters: SearchFilters | undefined,
  viewerFid: string,
  options?: SearchListFeedOptions
) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};

  // Generate a stable hash of the list contents for the query key
  const contentsHash = hashSearchListContents(term, filters);

  return useInfiniteQuery({
    queryKey: [...queryKeys.feeds.list(listId, { limit }), contentsHash],
    queryFn: ({ pageParam }) => fetchSearchListFeed(term, filters, viewerFid, { offset: pageParam, limit }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const nextOffset = allPages.length * limit;
      // Only return next offset if we got a full page of results
      return lastPage.casts.length >= limit ? nextOffset : undefined;
    },
    enabled: enabled && !!term && !!viewerFid,
    staleTime: 1000 * 60 * 2, // 2 minutes for search list feed
  });
}

/**
 * Helper to flatten infinite query pages into a single cast array
 *
 * Deduplicates casts by hash to handle any potential duplicates
 * across page boundaries.
 */
export function flattenSearchListFeedPages(
  data: { pages: SearchListFeedResponse[] } | undefined
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
