'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { getQueryClient } from '@/lib/queryClient';
import { useUserSettingsStore } from '@/stores/useUserSettingsStore';
import { createFallbackProvider } from './fallback';
import { createHypersnapProvider } from './hypersnap';
import { createNeynarProvider } from './neynar';
import type { FarcasterProvider, ProviderType } from './types';

const STORAGE_KEY = 'farcaster-provider';

export function getProviderType(): ProviderType {
  if (typeof window === 'undefined') return 'neynar';
  // Prefer the hydrated store value
  const storeValue = useUserSettingsStore.getState().farcasterProvider;
  if (storeValue) return storeValue;
  // Fallback for very early reads before store hydrate completes
  return (localStorage.getItem(STORAGE_KEY) as ProviderType) || 'neynar';
}

function createProvider(type: ProviderType): FarcasterProvider {
  if (type === 'hypersnap') {
    return createFallbackProvider(createHypersnapProvider(), createNeynarProvider());
  }
  return createNeynarProvider();
}

// Singleton for use outside React (store hydration, feed hooks, searchService, etc.). Rebuilt
// whenever the resolved provider type changes: the settings store seeds synchronously from
// localStorage, but the authoritative value arrives later from Supabase during hydrate(). A
// singleton pinned at first call would otherwise stay on the wrong provider for the whole
// session — on a device whose localStorage wasn't seeded yet, that means every feed query runs
// against the quota-limited Neynar default and silently comes back empty (the onboarding
// empty-feeds bug).
let _provider: FarcasterProvider | null = null;

export function getProvider(): FarcasterProvider {
  const type = getProviderType();
  if (!_provider || _provider.type !== type) {
    _provider = createProvider(type);
  }
  return _provider;
}

// React context
const FarcasterProviderContext = createContext<{
  provider: FarcasterProvider;
  providerType: ProviderType;
  setProviderType: (type: ProviderType) => void;
} | null>(null);

export { FarcasterProviderContext };

export function useFarcasterProvider(): FarcasterProvider {
  const ctx = useContext(FarcasterProviderContext);
  if (!ctx) {
    // Fallback for components outside the provider tree (e.g. during SSR or tests)
    return getProvider();
  }
  return ctx.provider;
}

export function useProviderSwitch() {
  const ctx = useContext(FarcasterProviderContext);
  if (!ctx) throw new Error('useProviderSwitch must be used within FarcasterProviderRoot');
  return { providerType: ctx.providerType, setProviderType: ctx.setProviderType };
}

/**
 * Hook to create the provider state. Use this in a client component wrapper:
 *
 * ```tsx
 * function FarcasterProviderRoot({ children }) {
 *   const value = useFarcasterProviderValue();
 *   return (
 *     <FarcasterProviderContext.Provider value={value}>
 *       {children}
 *     </FarcasterProviderContext.Provider>
 *   );
 * }
 * ```
 */
export function useFarcasterProviderValue() {
  const providerType = useUserSettingsStore((s) => s.farcasterProvider);

  const setProviderType = useCallback(async (type: ProviderType) => {
    await useUserSettingsStore.getState().setFarcasterProvider(type);
    _provider = null; // Reset singleton so getProvider() rebuilds with the new type
    // Refetch everything from the new provider. The persisted snapshot is keyed by
    // provider via the persist buster (see providers.tsx), so a stale provider's
    // cache is discarded on the next cold start.
    getQueryClient().invalidateQueries();
  }, []);

  // hydrate() resolves the authoritative provider from Supabase after the synchronous
  // localStorage seed, so providerType can flip (e.g. neynar → hypersnap) once the remote
  // preference loads on a device whose localStorage wasn't seeded yet. When it does, drop the
  // stale singleton and refetch — the data hooks read getProvider() (not this context), so
  // without a refetch they keep serving the old provider's empty/quota-limited results. The
  // ref skips the initial render so a correctly-seeded load doesn't double-fetch.
  const seededProviderTypeRef = useRef(providerType);
  useEffect(() => {
    if (seededProviderTypeRef.current === providerType) return;
    seededProviderTypeRef.current = providerType;
    _provider = null;
    getQueryClient().invalidateQueries();
  }, [providerType]);

  const provider = useMemo(() => createProvider(providerType), [providerType]);

  return useMemo(() => ({ provider, providerType, setProviderType }), [provider, providerType, setProviderType]);
}

export type {
  CastReaction,
  CastReactionsResponse,
  FarcasterProvider,
  FeedResponse,
  FetchOptions,
  GetActiveUsersRequest,
  GetBestFriendsRequest,
  GetBulkUsersRequest,
  GetCastReactionsRequest,
  GetCastsRequest,
  GetChannelFeedRequest,
  GetChannelRequest,
  GetFidListFeedRequest,
  GetFollowingFeedRequest,
  GetNotificationsRequest,
  GetProfileFeedRequest,
  GetTrendingChannelsRequest,
  GetTrendingFeedRequest,
  GetUserByUsernameRequest,
  GetUserChannelsRequest,
  GetUserRequest,
  NotificationsResponse,
  ProviderCapabilities,
  ProviderType,
  SearchCastsRequest,
  SearchCastsResponse,
  SearchChannelsRequest,
  SearchUsersRequest,
} from './types';

export { UnsupportedProviderFeatureError } from './types';
