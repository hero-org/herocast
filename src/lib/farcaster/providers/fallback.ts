import { usePerformanceStore } from '@/stores/usePerformanceStore';
import { type FarcasterProvider, UnsupportedProviderFeatureError } from './types';

type ProviderMethod = (this: FarcasterProvider, ...args: unknown[]) => unknown;

/**
 * Wraps a primary provider with a fallback.
 * If the primary provider does not support a feature, retries with fallback.
 */
export function createFallbackProvider(primary: FarcasterProvider, fallback: FarcasterProvider): FarcasterProvider {
  const handler: ProxyHandler<FarcasterProvider> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      // Don't proxy non-async properties like 'type' and 'capabilities'
      if (prop === 'type' || prop === 'capabilities') return value;

      return async (...args: unknown[]) => {
        try {
          return await (value as ProviderMethod).apply(target, args);
        } catch (error) {
          if (error instanceof UnsupportedProviderFeatureError) {
            usePerformanceStore.getState().addMetric({
              name: 'provider:fallback',
              duration: 0,
              timestamp: Date.now(),
              threshold: 0,
              status: 'warning', // ensures PostHog emission
              metadata: {
                method: String(prop),
                reason: 'unsupported',
                from: primary.type,
                to: fallback.type,
              },
            });
            const fallbackMethod = Reflect.get(fallback, prop);
            if (typeof fallbackMethod === 'function') {
              return (fallbackMethod as ProviderMethod).apply(fallback, args);
            }
          }
          throw error;
        }
      };
    },
  };

  const proxy = new Proxy(primary, handler);
  // Merge capabilities — if either provider supports it, the combo supports it
  return Object.defineProperty(proxy, 'capabilities', {
    get() {
      const pc = primary.capabilities;
      const fc = fallback.capabilities;
      return {
        trendingFeed: pc.trendingFeed || fc.trendingFeed,
        profileCasts: pc.profileCasts || fc.profileCasts,
        profileLikes: pc.profileLikes || fc.profileLikes,
        fidListFeed: pc.fidListFeed || fc.fidListFeed,
        castLookup: pc.castLookup || fc.castLookup,
        allChannels: pc.allChannels || fc.allChannels,
        castConversation: pc.castConversation || fc.castConversation,
        activeUsers: pc.activeUsers || fc.activeUsers,
        castByIdentifier: pc.castByIdentifier || fc.castByIdentifier,
      };
    },
  });
}
