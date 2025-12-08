/**
 * Type-safe query key factory for React Query
 *
 * Benefits:
 * - Centralized key management prevents typos
 * - TypeScript inference for query invalidation
 * - Hierarchical structure enables granular cache invalidation
 *
 * Usage:
 *   useQuery({ queryKey: queryKeys.feeds.trending() })
 *   queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all })
 */

export const queryKeys = {
  // Feed queries
  feeds: {
    all: ['feeds'] as const,
    trending: (options?: { cursor?: string; limit?: number }) => ['feeds', 'trending', options ?? {}] as const,
    following: (fid: string, options?: { cursor?: string; limit?: number }) =>
      ['feeds', 'following', fid, options ?? {}] as const,
    channel: (parentUrl: string, fid: string, options?: { cursor?: string; limit?: number }) =>
      ['feeds', 'channel', parentUrl, fid, options ?? {}] as const,
    list: (listId: string, options?: { cursor?: string; limit?: number; contentsHash?: string }) =>
      ['feeds', 'list', listId, options ?? {}] as const,
  },

  // Profile queries
  profiles: {
    all: ['profiles'] as const,
    byFid: (fid: number) => ['profiles', 'byFid', fid] as const,
    byUsername: (username: string) => ['profiles', 'byUsername', username] as const,
    bulk: (fids: number[]) =>
      [
        'profiles',
        'bulk',
        fids
          .slice()
          .sort((a, b) => a - b)
          .join(','),
      ] as const,
    additionalInfo: (fid: number) => ['profiles', 'additionalInfo', fid] as const,
  },

  // Cast queries
  casts: {
    all: ['casts'] as const,
    byHash: (hash: string, viewerFid?: number) => ['casts', 'byHash', hash, viewerFid ?? null] as const,
    thread: (hash: string, viewerFid?: number) => ['casts', 'thread', hash, viewerFid ?? null] as const,
    bulk: (hashes: string[], viewerFid?: number) =>
      ['casts', 'bulk', hashes.slice().sort().join(','), viewerFid ?? null] as const,
  },

  // Search queries
  search: {
    all: ['search'] as const,
    casts: (term: string, filters?: Record<string, unknown>) => ['search', 'casts', term, filters ?? {}] as const,
    users: (query: string) => ['search', 'users', query] as const,
  },

  // Notification queries
  notifications: {
    all: ['notifications'] as const,
    byFid: (fid: number, options?: { cursor?: string; limit?: number }) =>
      ['notifications', fid, options ?? {}] as const,
  },

  // Analytics queries
  analytics: {
    all: ['analytics'] as const,
    casts: (fid: number, options?: { startDate?: string; endDate?: string }) =>
      ['analytics', 'casts', fid, options ?? {}] as const,
    engagement: (fid: number) => ['analytics', 'engagement', fid] as const,
  },

  // Channel queries
  channels: {
    all: ['channels'] as const,
    byUrl: (url: string) => ['channels', 'byUrl', url] as const,
    search: (query: string) => ['channels', 'search', query] as const,
  },

  // Embed queries
  embeds: {
    all: ['embeds'] as const,
    urlMetadata: (url: string) => ['embeds', 'urlMetadata', url] as const,
  },

  // User interaction queries
  interactions: {
    between: (viewerFid: number, targetFid: number) => ['interactions', viewerFid, targetFid] as const,
  },
} as const;

// Type helpers for query key inference
export type QueryKeys = typeof queryKeys;
export type FeedQueryKey = ReturnType<
  typeof queryKeys.feeds.trending | typeof queryKeys.feeds.following | typeof queryKeys.feeds.channel
>;
export type ProfileQueryKey = ReturnType<typeof queryKeys.profiles.byFid | typeof queryKeys.profiles.bulk>;
