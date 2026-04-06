import type { FarcasterProvider } from './types';

/**
 * Wraps a primary provider with a fallback.
 * If primary throws "not yet supported", silently retries with fallback.
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
          return await (value as Function).apply(target, args);
        } catch (error) {
          if (error instanceof Error && error.message.includes('not yet supported')) {
            const fallbackMethod = (fallback as any)[prop];
            if (typeof fallbackMethod === 'function') {
              return fallbackMethod.apply(fallback, args);
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
      };
    },
  });
}
