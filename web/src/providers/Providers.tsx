import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { getQueryClient } from '@/lib/queryClient';
import { ThemeProvider } from './ThemeProvider';

// Phase 1 provider tree — the subset of app/providers.tsx needed for the foundation:
//   ThemeProvider (next-themes)  →  QueryClientProvider (TanStack Query)
//
// Deferred to later phases (need store/auth/wallet code that isn't ported yet):
//   - PersistQueryClientProvider + IndexedDB persister (#735) — Phase 2
//   - PostHogProvider — Phase 2 (client-only analytics)
//   - AuthProvider / AppHotkeysProvider / WalletProviders — Phase 2/3
//
// ThemeProvider props match the Next app exactly: attribute="class",
// defaultTheme="light", enableSystem, disableTransitionOnChange.

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools }))
    )
  : () => null;

export function Providers({ children }: { children: React.ReactNode }) {
  // Server: fresh client per request. Browser: stable singleton (getQueryClient).
  const [queryClient] = useState(() => getQueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {children}
        {import.meta.env.DEV && (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
          </Suspense>
        )}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
