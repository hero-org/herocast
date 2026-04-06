import type { FarcasterChannel, FarcasterUser } from '@/common/types/farcaster';
import type { FarcasterProvider, FeedResponse, GetNotificationsRequest, NotificationsResponse } from './types';
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

function findUserByUsername(users: FarcasterUser[] | undefined, username: string) {
  if (!users?.length) return null;

  const normalizedUsername = username.toLowerCase();
  const matchingUsernames = new Set([normalizedUsername, `${normalizedUsername}.eth`]);
  return users.find((user) => matchingUsernames.has(user.username.toLowerCase())) || users[0];
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
      profileCasts: false,
      profileLikes: false,
      fidListFeed: false,
      castLookup: false,
      allChannels: false,
    },

    async getUser({ fid, signal }) {
      const data = await fetchJson<{ user: FarcasterUser }>(buildUrl('user', { fid }), signal);
      if (!data.user) throw new Error(`User ${fid} not found`);
      return data.user;
    },

    async getUserByUsername({ username, signal }) {
      // /user/by_username not available; use search as workaround
      const data = await fetchJson<{ users: FarcasterUser[] }>(buildUrl('user/search', { q: username }), signal);
      const match = findUserByUsername(data.users, username);
      if (!match) throw new Error(`User ${username} not found`);
      return match;
    },

    async searchUsers({ q, limit, signal }) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(buildUrl('user/search', { q, limit }), signal);
      return data.users || [];
    },

    async getBulkUsers({ fids, signal }) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(buildUrl('user/bulk', { fids: fids.join(',') }), signal);
      return data.users || [];
    },

    async getFollowingFeed({ fid, limit = 15, cursor, signal }) {
      return fetchJson<FeedResponse>(buildUrl('feed', { feed_type: 'following', fid, limit, cursor }), signal);
    },

    getTrendingFeed() {
      return unsupported('getTrendingFeed');
    },

    async getChannelFeed({ parentUrl, limit = 15, cursor, signal }) {
      const channelId = channelIdFromUrl(parentUrl);
      return fetchJson<FeedResponse>(buildUrl('feed/channels', { channel_ids: channelId, limit, cursor }), signal);
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

    async searchCasts() {
      return unsupported('searchCasts');
    },

    getCasts() {
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

    getAllChannels() {
      return unsupported('getAllChannels');
    },

    async getNotifications({ fid, limit, cursor, type, signal }: GetNotificationsRequest) {
      return fetchJson<NotificationsResponse>(buildUrl('notifications', { fid, limit, cursor, type }), signal);
    },
  };
}
