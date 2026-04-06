import type { FarcasterCast } from '@/common/types/farcaster';
import type { SearchFilters } from '@/services/searchService';
import type { CastSearchPage } from './useCastSearch';
import { useCastSearchInfinite } from './useCastSearch';

const DEFAULT_LIMIT = 15;

interface SearchListFeedOptions {
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook for infinite scrolling search list feed
 *
 * Delegates to the shared cast search hook, but scopes the query key to the list
 * so saved searches don't alias the interactive search page cache.
 */
export function useSearchListFeedInfinite(
  listId: string,
  term: string,
  filters: SearchFilters | undefined,
  viewerFid: string,
  options?: SearchListFeedOptions
) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};

  return useCastSearchInfinite(term, filters, viewerFid, {
    limit,
    enabled: enabled && !!term && !!viewerFid,
    queryKeyScope: { source: 'search-list', listId },
  });
}

/**
 * Helper to flatten infinite query pages into a single cast array
 *
 * Deduplicates casts by hash to handle any potential duplicates
 * across page boundaries.
 */
export function flattenSearchListFeedPages(data: { pages: CastSearchPage[] } | undefined): FarcasterCast[] {
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
