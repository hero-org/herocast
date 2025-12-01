import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { queryKeys } from '@/lib/queryKeys';

const DEFAULT_LIMIT = 25;

export type ProfileFeedType = 'casts' | 'likes';

interface ProfileFeedOptions {
  limit?: number;
  enabled?: boolean;
}

interface ProfileFeedResponse {
  casts: CastWithInteractions[];
  next?: {
    cursor: string | null;
  };
}

/**
 * Fetches casts authored by a specific user from the server-side API
 */
async function fetchUserCasts(
  fid: number,
  options?: { cursor?: string; limit?: number }
): Promise<ProfileFeedResponse> {
  const { cursor, limit = DEFAULT_LIMIT } = options ?? {};

  const params = new URLSearchParams();
  params.append('fid', fid.toString());
  params.append('type', 'casts');
  params.append('limit', limit.toString());
  if (cursor) params.append('cursor', cursor);

  const response = await fetch(`/api/feeds/profile?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch user casts');

  return response.json();
}

/**
 * Fetches casts liked by a specific user from the server-side API
 */
async function fetchUserLikes(
  fid: number,
  options?: { cursor?: string; limit?: number }
): Promise<ProfileFeedResponse> {
  const { cursor, limit = DEFAULT_LIMIT } = options ?? {};

  const params = new URLSearchParams();
  params.append('fid', fid.toString());
  params.append('type', 'likes');
  params.append('limit', limit.toString());
  if (cursor) params.append('cursor', cursor);

  const response = await fetch(`/api/feeds/profile?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch user likes');

  return response.json();
}

/**
 * Hook for fetching a user's casts feed
 */
export function useUserCasts(fid: number | undefined, options?: ProfileFeedOptions) {
  const { limit = DEFAULT_LIMIT, enabled = true } = options ?? {};

  return useQuery({
    queryKey: ['profiles', 'casts', fid, { limit }] as const,
    queryFn: () => fetchUserCasts(fid!, { limit }),
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
    queryKey: ['profiles', 'likes', fid, { limit }] as const,
    queryFn: () => fetchUserLikes(fid!, { limit }),
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
    queryFn: ({ pageParam }) => fetchUserCasts(fid!, { cursor: pageParam, limit }),
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
    queryFn: ({ pageParam }) => fetchUserLikes(fid!, { cursor: pageParam, limit }),
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
