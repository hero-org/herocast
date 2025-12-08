import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export interface UserInteractions {
  likes: { count: number; mostRecent: string | null };
  recasts: { count: number; mostRecent: string | null };
  replies: { count: number; mostRecent: string | null };
  mentions: { count: number; mostRecent: string | null };
  quotes: { count: number; mostRecent: string | null };
}

/**
 * Fetches user interaction data between viewer and target user
 */
async function fetchUserInteractions(viewerFid: number, targetFid: number): Promise<UserInteractions> {
  const params = new URLSearchParams({
    viewer_fid: viewerFid.toString(),
    target_fid: targetFid.toString(),
  });

  const response = await fetch(`/api/users/interactions?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch interactions');
  }
  return response.json();
}

/**
 * Hook for fetching user interactions between viewer and target
 *
 * Benefits:
 * - Automatic request deduplication
 * - Built-in caching with 15-minute staleness
 * - Automatic background refetching
 * - Loading/error states managed automatically
 *
 * @param viewerFid - The FID of the current user viewing the profile
 * @param targetFid - The FID of the profile being viewed
 * @param options - Optional configuration including enabled flag
 *
 * @example
 * const { data, isLoading } = useUserInteractions(123, 456);
 */
export function useUserInteractions(
  viewerFid: number | undefined,
  targetFid: number | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.interactions.between(viewerFid ?? 0, targetFid ?? 0),
    queryFn: () => fetchUserInteractions(viewerFid!, targetFid!),
    enabled: options?.enabled !== false && !!viewerFid && !!targetFid && viewerFid !== targetFid,
    staleTime: 1000 * 60 * 15, // 15 minutes client-side
  });
}
