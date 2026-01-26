import type { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

const DEFAULT_LIMIT = 15;

interface ChannelFeedOptions {
  limit?: number;
  enabled?: boolean;
}

interface ChannelFeedResponse {
  casts: CastWithInteractions[];
  next?: {
    cursor: string;
  };
}

/**
 * Fetches the channel feed for a specific parent URL from the server-side API
 *
 * Phase 2 migration - replaces legacy getFeed logic for channel feeds.
 * Benefits:
 * - Automatic request deduplication
 * - Built-in caching with configurable staleness
 * - Automatic retry on failure
 * - Loading/error states managed automatically
 */
async function fetchChannelFeed(
  parentUrl: string,
  fid: string,
  options?: { cursor?: string; limit?: number }
): Promise<ChannelFeedResponse> {
  const { cursor, limit = DEFAULT_LIMIT } = options ?? {};

  const params = new URLSearchParams();
  params.append('parent_url', parentUrl);
  params.append('fid', fid);
  params.append('limit', limit.toString());
  if (cursor) params.append('cursor', cursor);

  const response = await fetch(`/api/feeds/channel?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch channel feed');

  return response.json();
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
    queryFn: () => fetchChannelFeed(parentUrl, fid, { limit }),
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
    queryFn: ({ pageParam }) => fetchChannelFeed(parentUrl, fid, { cursor: pageParam, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    enabled: enabled && !!parentUrl && !!fid,
    staleTime: 1000 * 60 * 2, // 2 minutes for channel feeds
  });
}

/**
 * Helper to flatten infinite query pages into a single cast array
 */
export function flattenChannelFeedPages(data: { pages: ChannelFeedResponse[] } | undefined): CastWithInteractions[] {
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
