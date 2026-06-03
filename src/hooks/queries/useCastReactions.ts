import { useQuery } from '@tanstack/react-query';
import type { CastReactionsResponse } from '@/lib/farcaster/providers';
import { getProvider } from '@/lib/farcaster/providers';
import { queryKeys } from '@/lib/queryKeys';

interface CastReactionsOptions {
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching the reactions (likes / recasts) on a cast.
 *
 * @param types Comma-separated reaction types ('likes', 'recasts', or 'likes,recasts').
 *              Defaults to the provider default ('likes,recasts').
 */
export function useCastReactions(hash: string | undefined, types?: string, options?: CastReactionsOptions) {
  const { limit, enabled = true } = options ?? {};

  return useQuery<CastReactionsResponse>({
    queryKey: queryKeys.reactions.byCast(hash ?? '', { types, limit }),
    queryFn: ({ signal }) => getProvider().getCastReactions({ hash: hash!, types, limit, signal }),
    enabled: enabled && !!hash,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
