import type { FarcasterCast, FarcasterChannel, FarcasterUser } from '@/common/types/farcaster';
import type {
  FarcasterProvider,
  FeedResponse,
  FetchOptions,
  NotificationsResponse,
  SearchCastsResponse,
} from './types';

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
  throw new Error(`Hypersnap: ${method} not yet supported`);
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
      profileCasts: false,
      profileLikes: false,
      fidListFeed: false,
      castLookup: false,
      allChannels: false,
    },

    async getUser(fid, opts) {
      const data = await fetchJson<{ user: FarcasterUser }>(buildUrl('user', { fid }), opts?.signal);
      if (!data.user) throw new Error(`User ${fid} not found`);
      return data.user;
    },

    async getUserByUsername(username, opts) {
      // /user/by_username not available; use search as workaround
      const data = await fetchJson<{ users: FarcasterUser[] }>(buildUrl('user/search', { q: username }), opts?.signal);
      const match = data.users?.find((u) => u.username === username);
      if (!match) throw new Error(`User ${username} not found`);
      return match;
    },

    async searchUsers(q, _viewerFid, limit, opts) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(buildUrl('user/search', { q, limit }), opts?.signal);
      return data.users || [];
    },

    async getBulkUsers(fids, _viewerFid, opts) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(
        buildUrl('user/bulk', { fids: fids.join(',') }),
        opts?.signal
      );
      return data.users || [];
    },

    async getFollowingFeed(fid, limit = 15, cursor, opts) {
      return fetchJson<FeedResponse>(buildUrl('feed', { feed_type: 'following', fid, limit, cursor }), opts?.signal);
    },

    getTrendingFeed() {
      return unsupported('getTrendingFeed');
    },

    async getChannelFeed(parentUrl, _fid, limit = 15, cursor, opts) {
      const channelId = channelIdFromUrl(parentUrl);
      return fetchJson<FeedResponse>(
        buildUrl('feed/channels', { channel_ids: channelId, limit, cursor }),
        opts?.signal
      );
    },

    getProfileCasts() {
      return unsupported('getProfileCasts');
    },

    getProfileLikes() {
      return unsupported('getProfileLikes');
    },

    getFidListFeed() {
      return unsupported('getFidListFeed');
    },

    async searchCasts(q, _filters, _limit, _offset, opts) {
      const data = await fetchJson<{
        result: { casts: FarcasterCast[]; next?: Record<string, string> };
      }>(buildUrl('cast/search', { q }), opts?.signal);
      return {
        results: (data.result?.casts || []).map((c) => ({
          hash: c.hash,
          fid: c.author?.fid || 0,
          text: c.text,
          timestamp: c.timestamp,
        })),
        next: data.result?.next?.cursor ? { cursor: data.result.next.cursor } : undefined,
      } satisfies SearchCastsResponse;
    },

    getCasts() {
      return unsupported('getCasts');
    },

    async getChannel(id, opts) {
      const data = await fetchJson<{ channel: FarcasterChannel }>(buildUrl('channel', { id }), opts?.signal);
      if (!data.channel) throw new Error(`Channel ${id} not found`);
      return data.channel;
    },

    async searchChannels(q, opts) {
      const data = await fetchJson<{ channels: FarcasterChannel[] }>(buildUrl('channel/search', { q }), opts?.signal);
      return data.channels || [];
    },

    getAllChannels() {
      return unsupported('getAllChannels');
    },

    async getNotifications(fid, limit, cursor, type, opts) {
      return fetchJson<NotificationsResponse>(buildUrl('notifications', { fid, limit, cursor, type }), opts?.signal);
    },
  };
}
