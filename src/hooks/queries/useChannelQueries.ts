import { useQuery } from '@tanstack/react-query';
import type { FarcasterChannel } from '@/common/types/farcaster';
import { getProvider } from '@/lib/farcaster/providers';
import { queryKeys } from '@/lib/queryKeys';

interface ChannelQueryOptions {
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching trending channels
 */
export function useTrendingChannels(options?: ChannelQueryOptions) {
  const { limit, enabled = true } = options ?? {};

  return useQuery<FarcasterChannel[]>({
    queryKey: queryKeys.channels.trending({ limit }),
    queryFn: ({ signal }) => getProvider().getTrendingChannels({ limit, signal }),
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook for fetching the channels a user is a member of / actively casts in
 */
export function useUserChannels(fid: number | undefined, options?: ChannelQueryOptions) {
  const { limit, enabled = true } = options ?? {};

  return useQuery<FarcasterChannel[]>({
    queryKey: queryKeys.channels.byUser(fid, { limit }),
    queryFn: ({ signal }) => getProvider().getUserChannels({ fid: fid!, limit, signal }),
    enabled: enabled && !!fid && fid > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
