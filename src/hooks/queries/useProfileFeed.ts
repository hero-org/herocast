import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getProvider } from '@/lib/farcaster/providers';
import { queryKeys } from '@/lib/queryKeys';

const DEFAULT_LIMIT = 25;

export type ProfileFeedType = 'casts' | 'likes' | 'replies_and_recasts' | 'popular';

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
    queryFn: ({ signal }) => getProvider().getProfileCasts({ fid: fid!, limit, signal }),
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
    queryFn: ({ signal }) => getProvider().getProfileLikes({ fid: fid!, limit, signal }),
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
    queryFn: ({ pageParam, signal }) => getProvider().getProfileCasts({ fid: fid!, limit, cursor: pageParam, signal }),
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
    queryFn: ({ pageParam, signal }) => getProvider().getProfileLikes({ fid: fid!, limit, cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    enabled: enabled && !!fid && fid > 0,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook for fetching a user's replies and recasts
 */
export function useUserRepliesAndRecasts(fid: number | undefined, options?: ProfileFeedOptions) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};

  return useQuery({
    queryKey: queryKeys.profiles.repliesAndRecasts(fid, { limit, single: true }),
    queryFn: ({ signal }) => getProvider().getProfileRepliesAndRecasts({ fid: fid!, limit, signal }),
    enabled: enabled && !!fid && fid > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes for feed data
  });
}

/**
 * Hook for fetching a user's replies and recasts with infinite scrolling
 */
export function useUserRepliesAndRecastsInfinite(fid: number | undefined, options?: ProfileFeedOptions) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};

  return useInfiniteQuery({
    queryKey: queryKeys.profiles.repliesAndRecasts(fid, { limit }),
    queryFn: ({ pageParam, signal }) =>
      getProvider().getProfileRepliesAndRecasts({ fid: fid!, limit, cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    enabled: enabled && !!fid && fid > 0,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook for fetching a user's popular casts (single page — no cursor pagination)
 */
export function useUserPopular(fid: number | undefined, options?: ProfileFeedOptions) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};

  return useQuery({
    queryKey: queryKeys.profiles.popular(fid, { limit }),
    queryFn: ({ signal }) => getProvider().getProfilePopular({ fid: fid!, limit, signal }),
    enabled: enabled && !!fid && fid > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes for feed data
  });
}

/**
 * Combined hook for profile feed that switches between casts, likes, replies+recasts and popular
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

  const repliesAndRecastsQuery = useUserRepliesAndRecasts(fid, {
    ...options,
    enabled: (options?.enabled ?? true) && feedType === 'replies_and_recasts',
  });

  const popularQuery = useUserPopular(fid, {
    ...options,
    enabled: (options?.enabled ?? true) && feedType === 'popular',
  });

  switch (feedType) {
    case 'likes':
      return likesQuery;
    case 'replies_and_recasts':
      return repliesAndRecastsQuery;
    case 'popular':
      return popularQuery;
    case 'casts':
    default:
      return castsQuery;
  }
}
