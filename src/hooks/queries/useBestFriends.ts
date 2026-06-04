import { useQuery } from '@tanstack/react-query';
import type { FarcasterUser } from '@/common/types/farcaster';
import { getProvider } from '@/lib/farcaster/providers';
import { queryKeys } from '@/lib/queryKeys';

interface BestFriendsOptions {
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching a user's best friends (affinity ranking) for the sidebar.
 */
export function useBestFriends(fid: number | undefined, options?: BestFriendsOptions) {
  const { limit, enabled = true } = options ?? {};

  return useQuery<FarcasterUser[]>({
    queryKey: queryKeys.affinity.bestFriends(fid, { limit }),
    queryFn: ({ signal }) => getProvider().getBestFriends({ fid: fid!, limit, signal }),
    enabled: enabled && !!fid && fid > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
