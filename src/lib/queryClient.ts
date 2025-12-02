import { QueryClient } from '@tanstack/react-query';

/**
 * Centralized QueryClient configuration for React Query
 *
 * Configuration rationale:
 * - staleTime: 5 minutes - standard cache duration for profile data
 * - gcTime: 30 minutes - longer retention to prevent re-fetching on navigation
 * - retry: 3 with exponential backoff - resilience for API failures
 * - refetchOnWindowFocus: true - aligns with current visibility-based refresh pattern
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 5 minutes (matches current cache TTL)
        staleTime: 1000 * 60 * 5,

        // Keep unused data in cache for 30 minutes before garbage collection
        gcTime: 1000 * 60 * 30,

        // Retry failed requests 3 times with exponential backoff
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Refetch when window regains focus (stale data only)
        refetchOnWindowFocus: true,

        // Refetch when network reconnects
        refetchOnReconnect: true,

        // Don't refetch on mount if data exists and is fresh
        refetchOnMount: true,
      },
      mutations: {
        // Retry mutations once on failure
        retry: 1,
      },
    },
  });
}

// Singleton for server-side compatibility
let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  // Server: always create a new client to avoid cross-request contamination
  if (typeof window === 'undefined') {
    return createQueryClient();
  }

  // Browser: reuse the same client instance
  if (!browserQueryClient) {
    browserQueryClient = createQueryClient();
  }
  return browserQueryClient;
}
