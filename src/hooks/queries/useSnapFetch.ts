import { useQuery } from '@tanstack/react-query';

// Use a simple inline key factory since snap queries are self-contained
const snapQueryKey = (url: string) => ['snap', 'fetch', url] as const;

interface SnapFetchResponse {
  snap: unknown | null;
  error?: string;
}

interface UseSnapFetchOptions {
  enabled?: boolean;
}

async function fetchSnap(url: string): Promise<unknown | null> {
  const params = new URLSearchParams({ url });
  const response = await fetch(`/api/snap/fetch?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch snap');
  }

  const data: SnapFetchResponse = await response.json();
  return data.snap;
}

/**
 * Hook for detecting and fetching Farcaster Snap data from a URL.
 *
 * Uses content negotiation: sends Accept: application/vnd.farcaster.snap+json
 * to detect if a URL serves snap JSON.
 *
 * Returns null if the URL does not support snaps (not an error).
 *
 * Caching:
 * - 5 min staleTime (snaps are dynamic)
 * - 15 min gcTime
 */
export function useSnapFetch(url: string, options?: UseSnapFetchOptions) {
  const { enabled = true } = options ?? {};

  return useQuery({
    queryKey: snapQueryKey(url),
    queryFn: () => fetchSnap(url),
    enabled: enabled && !!url && url.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
    retry: 0, // Don't retry - if URL doesn't support snaps, retrying won't help
  });
}
