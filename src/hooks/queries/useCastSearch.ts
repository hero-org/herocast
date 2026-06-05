import { useInfiniteQuery } from '@tanstack/react-query';
import type { FarcasterCast } from '@/common/types/farcaster';
import { Interval } from '@/common/types/types';
import { queryKeys } from '@/lib/queryKeys';
import { type RawSearchResult, type SearchFilters, searchService } from '@/services/searchService';

interface CastSearchPageParam {
  offset: number;
  limit: number;
}

export interface CastSearchPage {
  casts: FarcasterCast[];
  results: RawSearchResult[];
  limitUsed: number;
}

interface UseCastSearchOptions {
  enabled?: boolean;
  initialLimit?: number;
  limit?: number;
  queryKeyScope?: Record<string, unknown>;
}

function getEffectiveFilters(filters?: SearchFilters): SearchFilters {
  return {
    ...filters,
    interval: filters?.interval ?? Interval.d7,
  };
}

export async function fetchCastSearchPage(
  term: string,
  filters: SearchFilters | undefined,
  viewerFid: string,
  pageParam: CastSearchPageParam
): Promise<CastSearchPage> {
  const result = await searchService.searchWithCasts({
    searchTerm: term,
    filters: getEffectiveFilters(filters),
    viewerFid,
    limit: pageParam.limit,
    offset: pageParam.offset,
  });

  if (result.isTimeout) {
    throw new Error('Search timed out - please try again');
  }

  if (result.error) {
    throw new Error(result.error);
  }

  return {
    casts: result.casts,
    results: result.results ?? [],
    limitUsed: pageParam.limit,
  };
}

export function flattenCastSearchPages(data: { pages: CastSearchPage[] } | undefined): FarcasterCast[] {
  if (!data?.pages) return [];

  const allCasts = data.pages.flatMap((page) => page.casts);
  const seen = new Set<string>();
  return allCasts.filter((cast) => {
    if (seen.has(cast.hash)) return false;
    seen.add(cast.hash);
    return true;
  });
}

export function totalCastSearchResults(data: { pages: CastSearchPage[] } | undefined): number {
  return data?.pages.reduce((sum, page) => sum + page.results.length, 0) ?? 0;
}

export function useCastSearchInfinite(
  term: string,
  filters: SearchFilters | undefined,
  viewerFid: string,
  options?: UseCastSearchOptions
) {
  const { enabled = true, initialLimit, limit = 10, queryKeyScope } = options ?? {};
  const firstPageLimit = initialLimit ?? limit;
  const effectiveFilters = getEffectiveFilters(filters);

  const query = useInfiniteQuery({
    queryKey: queryKeys.search.casts(term, {
      ...effectiveFilters,
      viewerFid,
      limit,
      initialLimit: firstPageLimit,
      ...queryKeyScope,
    }),
    queryFn: ({ pageParam }) => fetchCastSearchPage(term, effectiveFilters, viewerFid, pageParam),
    initialPageParam: { offset: 0, limit: firstPageLimit } as CastSearchPageParam,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.results.length < lastPage.limitUsed) return undefined;

      // Stop when a page adds no new cast hashes. Guards against providers that ignore `offset`
      // and return a single fixed page (hypersnap /cast/search has no pagination): without this,
      // a full first page would refetch identical results forever. Neynar's offset pages always
      // bring new hashes, so this never short-circuits real pagination.
      const priorHashes = new Set(allPages.slice(0, -1).flatMap((page) => page.results.map((r) => r.hash)));
      if (!lastPage.results.some((r) => !priorHashes.has(r.hash))) return undefined;

      const nextOffset = allPages.reduce((sum, page) => sum + page.results.length, 0);
      return { offset: nextOffset, limit };
    },
    enabled: enabled && !!term && !!viewerFid,
    staleTime: 1000 * 60 * 2,
  });

  return {
    ...query,
    casts: flattenCastSearchPages(query.data),
    totalResults: totalCastSearchResults(query.data),
  };
}
