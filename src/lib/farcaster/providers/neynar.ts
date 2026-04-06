import type { FarcasterCast, FarcasterChannel, FarcasterUser } from '@/common/types/farcaster';
import type {
  FarcasterProvider,
  FeedResponse,
  FetchOptions,
  NotificationsResponse,
  SearchCastsResponse,
} from './types';

function buildUrl(path: string, params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      qs.set(key, String(value));
    }
  }
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Neynar API error ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

export function createNeynarProvider(): FarcasterProvider {
  return {
    type: 'neynar',

    capabilities: {
      trendingFeed: true,
      profileCasts: true,
      profileLikes: true,
      fidListFeed: true,
      castLookup: true,
      allChannels: true,
    },

    async getUser(fid, opts) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(
        buildUrl('/api/users', { fids: String(fid) }),
        opts?.signal
      );
      if (!data.users?.[0]) throw new Error(`User ${fid} not found`);
      return data.users[0];
    },

    async getUserByUsername(username, opts) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(
        buildUrl('/api/users/search', { q: username, limit: 1 }),
        opts?.signal
      );
      const match = data.users?.find((u) => u.username === username);
      if (!match) throw new Error(`User ${username} not found`);
      return match;
    },

    async searchUsers(q, viewerFid, limit, opts) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(
        buildUrl('/api/users/search', { q, viewer_fid: viewerFid, limit }),
        opts?.signal
      );
      return data.users || [];
    },

    async getBulkUsers(fids, viewerFid, opts) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(
        buildUrl('/api/users', { fids: fids.join(','), viewer_fid: viewerFid }),
        opts?.signal
      );
      return data.users || [];
    },

    async getFollowingFeed(fid, limit = 15, cursor, opts) {
      return fetchJson<FeedResponse>(buildUrl('/api/feeds/following', { fid, limit, cursor }), opts?.signal);
    },

    async getTrendingFeed(limit = 10, cursor, opts) {
      return fetchJson<FeedResponse>(buildUrl('/api/feeds/trending', { limit, cursor }), opts?.signal);
    },

    async getChannelFeed(parentUrl, fid, limit = 15, cursor, opts) {
      return fetchJson<FeedResponse>(
        buildUrl('/api/feeds/channel', { parent_url: parentUrl, fid, limit, cursor }),
        opts?.signal
      );
    },

    async getProfileCasts(fid, limit = 25, cursor, opts) {
      return fetchJson<FeedResponse>(
        buildUrl('/api/feeds/profile', { fid, type: 'casts', limit, cursor }),
        opts?.signal
      );
    },

    async getProfileLikes(fid, limit = 25, cursor, opts) {
      return fetchJson<FeedResponse>(
        buildUrl('/api/feeds/profile', { fid, type: 'likes', limit, cursor }),
        opts?.signal
      );
    },

    async getFidListFeed(fids, viewerFid, limit = 15, cursor, opts) {
      return fetchJson<FeedResponse>(
        buildUrl('/api/lists', { fids: fids.join(','), viewerFid, limit, cursor }),
        opts?.signal
      );
    },

    async searchCasts(q, filters, limit, offset, opts) {
      const params: Record<string, string | number | undefined> = { q, limit, offset };
      if (filters) Object.assign(params, filters);
      return fetchJson<SearchCastsResponse>(buildUrl('/api/search', params), opts?.signal);
    },

    async getCasts(hashes, viewerFid, opts) {
      const data = await fetchJson<{ result: { casts: FarcasterCast[] } }>(
        buildUrl('/api/casts', { casts: hashes.join(','), viewer_fid: viewerFid }),
        opts?.signal
      );
      return data.result?.casts || [];
    },

    async getChannel(id, opts) {
      const data = await fetchJson<{ channels: FarcasterChannel[] }>(buildUrl('/api/channels', { id }), opts?.signal);
      const channel = data.channels?.find((c) => c.id === id);
      if (!channel) throw new Error(`Channel ${id} not found`);
      return channel;
    },

    async searchChannels(q, opts) {
      const data = await fetchJson<{ channels: FarcasterChannel[] }>(
        buildUrl('/api/channels/search', { q }),
        opts?.signal
      );
      return data.channels || [];
    },

    async getAllChannels(opts) {
      const data = await fetchJson<{ channels: FarcasterChannel[] }>('/api/channels', opts?.signal);
      return data.channels || [];
    },

    async getNotifications(fid, limit, cursor, type, opts) {
      return fetchJson<NotificationsResponse>(
        buildUrl('/api/notifications', { fid, limit, cursor, type }),
        opts?.signal
      );
    },
  };
}
