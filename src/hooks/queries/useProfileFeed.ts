import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { FarcasterCast } from '@/common/types/farcaster';
import type { FeedResponse } from '@/lib/farcaster/providers';
import { getProvider } from '@/lib/farcaster/providers';

const DEFAULT_LIMIT = 25;

export type ProfileFeedType = 'casts' | 'likes';

interface ProfileFeedOptions {
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching a user's casts feed
 */
export function useUserCasts(fid: number | undefined, options?: ProfileFeedOptions) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};

  return useQuery({
    queryKey: ['profiles', 'casts', fid, { limit, single: true }] as const,
    queryFn: ({ signal }) => getProvider().getProfileCasts(fid!, limit, undefined, { signal }),
    enabled: enabled && !!fid && fid > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes for feed data
  });
}

/**
 * Hook for fetching a user's liked casts
 */
export function useUserLikes(fid: number | undefined, options?: ProfileFeedOptions) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};

  return useQuery({
    queryKey: ['profiles', 'likes', fid, { limit, single: true }] as const,
    queryFn: ({ signal }) => getProvider().getProfileLikes(fid!, limit, undefined, { signal }),
    enabled: enabled && !!fid && fid > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes for feed data
  });
}

/**
 * Hook for fetching a user's feed with infinite scrolling
 */
export function useUserCastsInfinite(fid: number | undefined, options?: ProfileFeedOptions) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};

  return useInfiniteQuery({
    queryKey: ['profiles', 'casts', fid, { limit }] as const,
    queryFn: ({ pageParam, signal }) => getProvider().getProfileCasts(fid!, limit, pageParam, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    enabled: enabled && !!fid && fid > 0,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook for fetching a user's likes with infinite scrolling
 */
export function useUserLikesInfinite(fid: number | undefined, options?: ProfileFeedOptions) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};

  return useInfiniteQuery({
    queryKey: ['profiles', 'likes', fid, { limit }] as const,
    queryFn: ({ pageParam, signal }) => getProvider().getProfileLikes(fid!, limit, pageParam, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    enabled: enabled && !!fid && fid > 0,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Combined hook for profile feed that switches between casts and likes
 */
export function useProfileFeed(fid: number | undefined, feedType: ProfileFeedType, options?: ProfileFeedOptions) {
  const castsQuery = useUserCasts(fid, {
    ...options,
    enabled: (options?.enabled ?? true) && feedType === 'casts',
  });

  const likesQuery = useUserLikes(fid, {
    ...options,
    enabled: (options?.enabled ?? true) && feedType === 'likes',
  });

  return feedType === 'casts' ? castsQuery : likesQuery;
}
