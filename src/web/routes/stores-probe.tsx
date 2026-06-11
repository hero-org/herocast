// THROWAWAY / INTERNAL — unit #4 (stores + RQ hooks SSR-safety) probe. Deleted at/before cutover.
//
// Imports the ENTIRE shared state surface — all 12 Zustand store hooks (plus
// initializeStores / userPreferencesSync / StoreStorage via their import chains) and all
// 14 React Query hook modules under src/hooks/queries/ — and SSR-renders a selector read
// from every store. That exercises, on real workerd:
//   - module evaluation of every store/hook (no import-time window/localStorage/env throw;
//     Supabase clients are lazy as of this unit; public NEXT_PUBLIC_* config is inlined by
//     the vite `define` block)
//   - zustand's useSyncExternalStore server-snapshot path for every store
//   - one real RQ hook (useTrendingFeed) rendering its pending state during SSR; on the
//     client it fetches through the FarcasterProvider seam (expected to error on the worker
//     until the data routes port in unit #10 — the probe renders that state honestly)
//   - a client-mount store write/read round-trip (toggleCommandPalette), proving the
//     hydrated client tree shares the same store instances
//
// Per the forkability bar, this page must render 200 with NO secrets configured.
//
// NOTE: the filename must NOT start with `_` — a leading underscore is TanStack's
// pathless/layout-route convention and would mount this at `/` instead of /stores-probe.
// Mirrors nav-probe.tsx / providers-probe.tsx / migration-probe.tsx.
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
// React Query hooks — import every module so its chain is proven in the route graph.
// (Only useTrendingFeed is mounted; the rest just need to survive bundling + evaluation.)
import { getProfileBatcher } from '@/hooks/queries/profileBatcher';
import { useBestFriends } from '@/hooks/queries/useBestFriends';
import { useBulkProfiles } from '@/hooks/queries/useBulkProfiles';
import { useCastReactions } from '@/hooks/queries/useCastReactions';
import { useCastSearchInfinite } from '@/hooks/queries/useCastSearch';
import { useChannelFeed } from '@/hooks/queries/useChannelFeed';
import { useTrendingChannels } from '@/hooks/queries/useChannelQueries';
import { useFidListFeed } from '@/hooks/queries/useFidListFeed';
import { useFollowingFeed } from '@/hooks/queries/useFollowingFeed';
import { useProfile } from '@/hooks/queries/useProfile';
import { useProfileFeed } from '@/hooks/queries/useProfileFeed';
import { useSearchListFeedInfinite } from '@/hooks/queries/useSearchListFeed';
import { useTrendingFeed } from '@/hooks/queries/useTrendingFeed';
import { useUrlMetadata } from '@/hooks/queries/useUrlMetadata';
// initializeStores must be IMPORTABLE on the server (calling it stays client-only — unit #5).
import { initializeStores } from '@/stores/initializeStores';
// Zustand stores — the full surface (side-effect-free to import; that's the test).
import { useAccountStore } from '@/stores/useAccountStore';
import { useDataStore } from '@/stores/useDataStore';
import { useDraftStore } from '@/stores/useDraftStore';
import { useListStore } from '@/stores/useListStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { usePerformanceStore } from '@/stores/usePerformanceStore';
import { useSocialGraphStore } from '@/stores/useSocialGraphStore';
import { useSpacesStore } from '@/stores/useSpacesStore';
import { useUserSettingsStore } from '@/stores/useUserSettingsStore';
import { useUserStore } from '@/stores/useUserStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

export const Route = createFileRoute('/stores-probe')({
  component: StoresProbe,
});

// Referenced (not invoked) so bundlers can't tree-shake the imports away — every module
// above must survive evaluation in BOTH the workerd and client bundles.
const importedHookModules = [
  getProfileBatcher,
  useBestFriends,
  useBulkProfiles,
  useCastReactions,
  useCastSearchInfinite,
  useChannelFeed,
  useTrendingChannels,
  useFidListFeed,
  useFollowingFeed,
  useProfile,
  useProfileFeed,
  useSearchListFeedInfinite,
  useUrlMetadata,
  initializeStores,
] as const;

function StoresProbe() {
  // One selector per store: proves zustand's server-snapshot render path end-to-end.
  const accounts = useAccountStore((s) => s.accounts.length);
  const dataKeys = useDataStore((s) => Object.keys(s).length);
  const drafts = useDraftStore((s) => s.drafts.length);
  const lists = useListStore((s) => s.lists.length);
  const commandPaletteOpen = useNavigationStore((s) => s.isCommandPaletteOpen);
  const notificationQueue = useNotificationStore((s) => s.syncQueue.length);
  const perfMetrics = usePerformanceStore((s) => s.metrics.length);
  const socialGraphKeys = useSocialGraphStore((s) => Object.keys(s).length);
  const spacesKeys = useSpacesStore((s) => Object.keys(s).length);
  const farcasterProvider = useUserSettingsStore((s) => s.farcasterProvider);
  const userKeys = useUserStore((s) => Object.keys(s).length);
  const workspaceHydrated = useWorkspaceStore((s) => s.isHydrated);

  // Real RQ hook through the FarcasterProvider seam. SSR renders 'pending'; the client
  // fetch will error on the worker until unit #10 ports the data routes — expected.
  const trending = useTrendingFeed({ limit: 2 });

  // Client round-trip: write to a store after mount and read the result back through the
  // same hook the server rendered with. Distinguishes hydrated output from SSR output.
  const [clientStoresOk, setClientStoresOk] = useState(false);
  useEffect(() => {
    const before = useNavigationStore.getState().isCommandPaletteOpen;
    useNavigationStore.getState().toggleCommandPalette();
    const after = useNavigationStore.getState().isCommandPaletteOpen;
    useNavigationStore.getState().toggleCommandPalette(); // restore
    setClientStoresOk(before !== after);
  }, []);

  const storeSnapshot: Record<string, string | number | boolean> = {
    'accountStore.accounts': accounts,
    'dataStore (keys)': dataKeys,
    'draftStore.drafts': drafts,
    'listStore.lists': lists,
    'navigationStore.isCommandPaletteOpen': commandPaletteOpen,
    'notificationStore.syncQueue': notificationQueue,
    'performanceStore.metrics': perfMetrics,
    'socialGraphStore (keys)': socialGraphKeys,
    'spacesStore (keys)': spacesKeys,
    'userSettingsStore.farcasterProvider': farcasterProvider,
    'userStore (keys)': userKeys,
    'workspaceStore.isHydrated': workspaceHydrated,
  };

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 24, lineHeight: 1.5 }}>
      <h1>stores + hooks probe</h1>
      <p>
        <small>
          Internal / throwaway (unit #4). All {Object.keys(storeSnapshot).length} Zustand stores +{' '}
          {importedHookModules.length} query-hook modules imported and SSR-rendered.
        </small>
      </p>

      <h2>Store selectors (rendered during SSR)</h2>
      <ul>
        {Object.entries(storeSnapshot).map(([k, v]) => (
          <li key={k}>
            {k}: <code>{String(v)}</code>
          </li>
        ))}
      </ul>

      <h2>React Query hook (useTrendingFeed via FarcasterProvider)</h2>
      <ul>
        <li>
          status: <code>{trending.status}</code>{' '}
          <small>(client fetch is expected to error until unit #10 ports the data routes)</small>
        </li>
        <li>
          casts: <code>{trending.data?.casts?.length ?? 'n/a'}</code>
        </li>
        <li>
          error: <code>{trending.error ? String(trending.error) : 'none'}</code>
        </li>
      </ul>

      <h2>Client hydration</h2>
      <ul>
        <li>
          store write/read round-trip: <code>{clientStoresOk ? 'client stores OK' : '(hydrating…)'}</code>
        </li>
      </ul>
    </main>
  );
}
