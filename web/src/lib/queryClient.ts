import { QueryClient } from '@tanstack/react-query';

/**
 * Centralized QueryClient configuration — ported verbatim from the repo-root
 * src/lib/queryClient.ts so cache semantics match the Next app.
 *
 * NOTE (Phase 1): the IndexedDB persistence layer (#735 — root src/lib/queryPersister.ts
 * + PersistQueryClientProvider) is intentionally NOT wired here. It's client-only and
 * depends on store code (getProviderType) that ports in Phase 2. The defaults below
 * (5-min staleTime, 24h gcTime) are unchanged so re-adding the persister later is a
 * drop-in.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 5 minutes (matches current cache TTL)
        staleTime: 1000 * 60 * 5,
        // Keep unused data for 24h (matches the persister's maxAge in the Next app).
        gcTime: 1000 * 60 * 60 * 24,
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

// Server: always create a fresh client per request (no cross-request contamination).
// Browser: reuse one instance.
let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    return createQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = createQueryClient();
  }
  return browserQueryClient;
}
