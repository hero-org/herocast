import type { FarcasterCast, FarcasterChannel, FarcasterUser } from '@/common/types/farcaster';
import { measureAsync } from '@/stores/usePerformanceStore';
import type {
  FarcasterProvider,
  FeedResponse,
  GetNotificationsRequest,
  NotificationsResponse,
  SearchCastResult,
  SearchCastsResponse,
} from './types';
import { UnsupportedProviderFeatureError as UnsupportedFeatureError } from './types';

const PROVIDER = 'hypersnap' as const;
const DIRECT_UPSTREAM = 'https://haatz.quilibrium.com/v2/farcaster';

// SSR safety: `src/lib/farcaster/providers/index.ts` is `'use client'` and `getProviderType()`
// returns 'neynar' when `window` is undefined, so this provider is never constructed server-side
// via `getProvider()`. The SSR branch below is defensive only — route handlers must not call
// `getProvider()` since they'd either bypass the proxy or import a client module from server.
function getBaseUrl(): string {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_HYPERSNAP_URL) {
    return process.env.NEXT_PUBLIC_HYPERSNAP_URL;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/hypersnap`;
  }
  return DIRECT_UPSTREAM;
}

function buildUrl(path: string, params: Record<string, string | number | undefined>): string {
  const base = getBaseUrl();
  const url = new URL(`${base}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function extractMethodFromUrl(url: string): string {
  try {
    const path = new URL(url, 'http://x').pathname.replace(/^\/+/, '').replace(/^api\/hypersnap\//, ''); // strip the proxy prefix when present
    return path.split('/').filter(Boolean).join(':') || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const method = extractMethodFromUrl(url);
  return measureAsync(
    `provider:${PROVIDER}:${method}`,
    async () => {
      const res = await fetch(url, signal ? { signal } : undefined);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Hypersnap error ${res.status}: ${body || res.statusText}`);
      }
      return res.json();
    },
    500,
    { source: PROVIDER, method }
  );
}

function unsupported(method: string): never {
  throw new UnsupportedFeatureError('hypersnap', method);
}

/** Extract channel ID from a Warpcast channel URL like https://warpcast.com/~/channel/degen */
function channelIdFromUrl(parentUrl: string): string {
  try {
    const pathname = new URL(parentUrl).pathname.replace(/\/+$/, '');
    return pathname.split('/').pop() || parentUrl;
  } catch {
    // Not a valid URL, treat as raw channel ID
    return parentUrl;
  }
}

export function createHypersnapProvider(): FarcasterProvider {
  return {
    type: 'hypersnap',

    capabilities: {
      trendingFeed: false,
      profileCasts: true,
      profileLikes: true,
      fidListFeed: false,
      castLookup: true,
      allChannels: true,
      castConversation: true,
      activeUsers: false,
      castByIdentifier: true,
    },

    async getUser({ fid, signal }) {
      const data = await fetchJson<{ user: FarcasterUser }>(buildUrl('user', { fid }), signal);
      if (!data.user) throw new Error(`User ${fid} not found`);
      return data.user;
    },

    async getUserByUsername({ username, signal }) {
      const data = await fetchJson<{ user: FarcasterUser }>(buildUrl('user/by-username', { username }), signal);
      if (!data.user) throw new Error(`User ${username} not found`);
      return data.user;
    },

    async searchUsers({ q, limit = 5, signal }) {
      // Username-prefix match only (no display_name/bio ranking). Tracked in #715.
      const data = await fetchJson<{ users: FarcasterUser[] }>(buildUrl('user/search', { q, limit }), signal);
      return data.users || [];
    },

    async getBulkUsers({ fids, signal }) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(buildUrl('user/bulk', { fids: fids.join(',') }), signal);
      return data.users || [];
    },

    async getFollowingFeed({ fid, limit = 15, cursor, signal }) {
      return fetchJson<FeedResponse>(buildUrl('feed/following', { fid, limit, cursor }), signal);
    },

    getTrendingFeed() {
      // Hypersnap /feed/trending currently takes ~54s per call. Fall back to Neynar until upstream fix.
      return unsupported('getTrendingFeed');
    },

    async getChannelFeed({ parentUrl, limit = 15, cursor, signal }) {
      const channelId = channelIdFromUrl(parentUrl);
      return fetchJson<FeedResponse>(buildUrl('feed/channels', { channel_ids: channelId, limit, cursor }), signal);
    },

    async getProfileCasts({ fid, limit = 25, cursor, signal }) {
      return fetchJson<FeedResponse>(buildUrl('feed/user/casts', { fid, limit, cursor }), signal);
    },

    async getProfileLikes({ fid, limit = 25, signal }) {
      // Hypersnap returns non-hydrated reactions; bulk-hydrate by hash, then re-order to like-order.
      const data = await fetchJson<{ reactions: Array<{ cast: { hash: string } }> }>(
        buildUrl('reaction/user', { fid, type: 'likes', limit }),
        signal
      );
      const hashes = (data.reactions || []).map((r) => r.cast.hash).filter(Boolean);
      if (hashes.length === 0) return { casts: [], next: { cursor: undefined } };
      const hydrated = await fetchJson<{ casts: FarcasterCast[] }>(
        buildUrl('cast/bulk', { hashes: hashes.join(',') }),
        signal
      );
      const byHash = new Map((hydrated.casts || []).map((c) => [c.hash, c]));
      const casts = hashes.map((h) => byHash.get(h)).filter((c): c is FarcasterCast => Boolean(c));
      return { casts, next: { cursor: undefined } };
    },

    getFidListFeed() {
      return unsupported('getFidListFeed');
    },

    async searchCasts({ q, limit, filters, signal }) {
      if (filters && Object.keys(filters).length > 0) {
        // Hypersnap /cast/search is keyword-only; route filtered queries to Neynar via fallback.
        unsupported('searchCasts(filters)');
      }
      const data = await fetchJson<{ result: { casts: FarcasterCast[] } }>(
        buildUrl('cast/search', { q, limit }),
        signal
      );
      const results: SearchCastResult[] = (data.result?.casts || []).map((cast) => ({
        hash: cast.hash,
        fid: cast.author.fid,
        text: cast.text,
        timestamp: cast.timestamp,
      }));
      return { results, next: { cursor: undefined } } satisfies SearchCastsResponse;
    },

    async getCasts({ hashes, signal }) {
      // Hypersnap /cast/bulk omits viewer_context, so liked/recasted hearts render empty
      // even when the viewer reacted. Tracked in #715 — acceptable degradation given
      // the alternative (fall through to Neynar) is currently blocked by quota.
      const data = await fetchJson<{ casts: FarcasterCast[] }>(
        buildUrl('cast/bulk', { hashes: hashes.join(',') }),
        signal
      );
      return data.casts || [];
    },

    async getChannel({ id, signal }) {
      const data = await fetchJson<{ channel: FarcasterChannel }>(buildUrl('channel', { id }), signal);
      if (!data.channel) throw new Error(`Channel ${id} not found`);
      return data.channel;
    },

    async searchChannels({ q, signal }) {
      const data = await fetchJson<{ channels: FarcasterChannel[] }>(buildUrl('channel/search', { q }), signal);
      return data.channels || [];
    },

    async getAllChannels(opts) {
      const data = await fetchJson<{ channels: FarcasterChannel[] }>(buildUrl('channel/all', {}), opts?.signal);
      return data.channels || [];
    },

    async getNotifications({ fid, limit, cursor, type, signal }: GetNotificationsRequest) {
      return fetchJson<NotificationsResponse>(buildUrl('notifications', { fid, limit, cursor, type }), signal);
    },

    async getConversation({ hash, signal }) {
      // Hypersnap exposes /cast/conversation but only returns direct_replies — it does
      // NOT populate chronological_parent_casts. Walk parent_hash manually via /cast.
      // Tracked in #715.
      const data = await fetchJson<{
        conversation?: { cast?: FarcasterCast & { direct_replies?: FarcasterCast[] } };
      }>(buildUrl('cast/conversation', { identifier: hash, type: 'hash' }), signal);
      const focused = data.conversation?.cast;
      if (!focused) throw new Error(`Conversation for ${hash} not found`);
      const { direct_replies: replies = [], ...cast } = focused;

      const parents: FarcasterCast[] = [];
      let current = cast as FarcasterCast;
      for (let depth = 0; depth < 10 && current.parent_hash; depth++) {
        try {
          const parentRes = await fetchJson<{ cast?: FarcasterCast }>(
            buildUrl('cast', { identifier: current.parent_hash }),
            signal
          );
          if (!parentRes.cast) break;
          parents.unshift(parentRes.cast);
          current = parentRes.cast;
        } catch {
          break;
        }
      }
      return { parents, cast: cast as FarcasterCast, replies };
    },

    async getActiveUsers() {
      // No Hypersnap discovery endpoint. RecommendedProfilesCard renders curated defaults
      // when this returns empty — preferable to falling through to a blocked Neynar.
      return [];
    },

    async getCastByIdentifier({ identifier, type, signal }) {
      // Hypersnap supports hash lookup only — server explicitly rejects type=url
      // ("Only hash identifier type is supported"). URL lookups (rare /conversation
      // permalinks from Warpcast deep-links) fall back to Neynar via the fallback proxy.
      if (type === 'url') unsupported('getCastByIdentifier(url)');
      const data = await fetchJson<{ cast?: FarcasterCast }>(buildUrl('cast', { identifier }), signal);
      if (!data.cast) throw new Error(`Cast ${identifier} not found`);
      return data.cast;
    },
  };
}
