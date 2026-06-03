'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
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

// Singleton for use outside React (store hydration, etc.)
let _provider: FarcasterProvider | null = null;

export function getProvider(): FarcasterProvider {
  if (!_provider) {
    _provider = createProvider(getProviderType());
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
    // Clear all cached data so it refreshes from the new provider
    getQueryClient().invalidateQueries();
  }, []);

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
