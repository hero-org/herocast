import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { UrlMetadata } from '@/app/api/embeds/metadata/route';

interface UrlMetadataResponse {
  metadata: UrlMetadata | null;
  error?: string;
}

interface UseUrlMetadataOptions {
  enabled?: boolean;
}

async function fetchUrlMetadata(url: string): Promise<UrlMetadata | null> {
  const params = new URLSearchParams({ url });
  const response = await fetch(`/api/embeds/metadata?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch URL metadata');
  }

  const data: UrlMetadataResponse = await response.json();
  return data.metadata;
}

/**
 * Hook for fetching URL metadata (title, favicon, etc.)
 *
 * Uses aggressive caching since URL metadata rarely changes:
 * - 1 hour staleTime
 * - 24 hour gcTime
 *
 * Supports lazy loading via `enabled` option for use with
 * intersection observer (only fetch when visible).
 */
export function useUrlMetadata(url: string, options?: UseUrlMetadataOptions) {
  const { enabled = true } = options ?? {};

  return useQuery({
    queryKey: queryKeys.embeds.urlMetadata(url),
    queryFn: () => fetchUrlMetadata(url),
    enabled: enabled && !!url && url.length > 0,
    staleTime: 1000 * 60 * 60, // 1 hour - metadata rarely changes
    gcTime: 1000 * 60 * 60 * 24, // 24 hours - keep in cache long
    retry: 1, // Only retry once for performance
    retryDelay: 1000, // 1 second delay
  });
}
