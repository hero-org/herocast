import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { FarcasterCast } from '@/common/types/farcaster';
import type { FeedResponse } from '@/lib/farcaster/providers';
import { getProvider } from '@/lib/farcaster/providers';
import { queryKeys } from '@/lib/queryKeys';

const DEFAULT_LIMIT = 15;

interface ChannelFeedOptions {
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching a single page of channel feed
 *
 * Use this for simple cases where pagination is handled manually.
 */
export function useChannelFeed(parentUrl: string, fid: string, options?: ChannelFeedOptions) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};

  return useQuery({
    queryKey: queryKeys.feeds.channel(parentUrl, fid, { limit }),
    queryFn: ({ signal }) => getProvider().getChannelFeed(parentUrl, Number(fid), limit, undefined, { signal }),
    enabled: enabled && !!parentUrl && !!fid,
    // Override defaults for feed data which changes frequently
    staleTime: 1000 * 60 * 2, // 2 minutes for channel feeds
  });
}

/**
 * Hook for infinite scrolling channel feed
 *
 * Use this for the main feed view with cursor-based pagination.
 * Provides automatic page merging and deduplication.
 */
export function useChannelFeedInfinite(parentUrl: string, fid: string, options?: ChannelFeedOptions) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};

  return useInfiniteQuery({
    queryKey: queryKeys.feeds.channel(parentUrl, fid, { limit }),
    queryFn: ({ pageParam, signal }) =>
      getProvider().getChannelFeed(parentUrl, Number(fid), limit, pageParam, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    enabled: enabled && !!parentUrl && !!fid,
    staleTime: 1000 * 60 * 2, // 2 minutes for channel feeds
  });
}

/**
 * Helper to flatten infinite query pages into a single cast array
 */
export function flattenChannelFeedPages(data: { pages: FeedResponse[] } | undefined): FarcasterCast[] {
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
