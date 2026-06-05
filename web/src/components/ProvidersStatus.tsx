import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// "Providers wired" indicator for the Phase 1 shell. Reads each provider's hook —
// useQueryClient() returns the client only if QueryClientProvider is mounted;
// useTheme() returns state only if ThemeProvider is mounted — so a green row is live
// proof the provider is reachable, not a static label.
export function ProvidersStatus() {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const rows: Array<{ label: string; detail: string; ok: boolean }> = [
    {
      label: 'TanStack Query',
      detail: queryClient ? 'QueryClientProvider mounted' : 'missing',
      ok: Boolean(queryClient),
    },
    {
      label: 'next-themes',
      // Before mount the resolved theme is unknown (SSR) — show hydrating, not a mismatch.
      detail: mounted ? `ThemeProvider mounted · ${resolvedTheme}` : 'hydrating…',
      ok: mounted,
    },
  ];

  return (
    <dl className="divide-y divide-border">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between py-2">
          <dt className="text-sm font-medium text-foreground">{row.label}</dt>
          <dd className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span
              className={cn('h-2 w-2 rounded-full', row.ok ? 'bg-success' : 'bg-pending')}
              aria-hidden="true"
            />
            {row.detail}
          </dd>
        </div>
      ))}
    </dl>
  );
}
