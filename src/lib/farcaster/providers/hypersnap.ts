import type { FarcasterCast, FarcasterChannel, FarcasterUser } from '@/common/types/farcaster';
import type {
  FarcasterProvider,
  FeedResponse,
  GetNotificationsRequest,
  NotificationsResponse,
  SearchCastResult,
  SearchCastsResponse,
} from './types';
import { UnsupportedProviderFeatureError as UnsupportedFeatureError } from './types';

const DEFAULT_BASE_URL = 'https://haatz.quilibrium.com/v2/farcaster';

function getBaseUrl(): string {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_HYPERSNAP_URL) {
    return process.env.NEXT_PUBLIC_HYPERSNAP_URL;
  }
  return DEFAULT_BASE_URL;
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

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Hypersnap error ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
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
      castLookup: false,
      allChannels: true,
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

    searchUsers() {
      // Hypersnap user search is exact-prefix only — no fuzzy/display-name match. Fall back to Neynar.
      return unsupported('searchUsers');
    },

    async getBulkUsers({ fids, signal }) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(buildUrl('user/bulk', { fids: fids.join(',') }), signal);
      return data.users || [];
    },

    async getFollowingFeed({ fid, limit = 15, cursor, signal }) {
      return fetchJson<FeedResponse>(buildUrl('feed', { feed_type: 'following', fid, limit, cursor }), signal);
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

    getCasts() {
      // Hypersnap /cast/bulk omits viewer_context, so has_liked/has_recasted UI state would be wrong.
      return unsupported('getCasts');
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
  };
}
