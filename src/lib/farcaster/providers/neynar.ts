import type { FarcasterCast, FarcasterChannel, FarcasterUser } from '@/common/types/farcaster';
import { measureAsync } from '@/stores/usePerformanceStore';
import type {
  CastReactionsResponse,
  ConversationResponse,
  FarcasterProvider,
  FeedResponse,
  GetActiveUsersRequest,
  GetCastByIdentifierRequest,
  GetConversationRequest,
  GetNotificationsRequest,
  NotificationsResponse,
  SearchCastsResponse,
} from './types';

const PROVIDER = 'neynar' as const;

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
        throw new Error(`Neynar API error ${res.status}: ${body || res.statusText}`);
      }
      return res.json();
    },
    500,
    { source: PROVIDER, method }
  );
}

function findUserByUsername(users: FarcasterUser[] | undefined, username: string) {
  if (!users?.length) return null;

  const normalizedUsername = username.toLowerCase();
  const matchingUsernames = new Set([normalizedUsername, `${normalizedUsername}.eth`]);
  return users.find((user) => matchingUsernames.has(user.username.toLowerCase())) || users[0];
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
      castConversation: true,
      activeUsers: true,
      castByIdentifier: true,
      profileRepliesAndRecasts: true,
      profilePopular: true,
      trendingChannels: true,
      userChannels: true,
      castReactions: true,
      bestFriends: true,
    },

    async getUser({ fid, viewerFid, signal }) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(
        buildUrl('/api/users', { fids: String(fid), viewer_fid: viewerFid }),
        signal
      );
      if (!data.users?.[0]) throw new Error(`User ${fid} not found`);
      return data.users[0];
    },

    async getUserByUsername({ username, viewerFid, signal }) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(
        buildUrl('/api/users/search', { q: username, viewer_fid: viewerFid, limit: 10 }),
        signal
      );
      const match = findUserByUsername(data.users, username);
      if (!match) throw new Error(`User ${username} not found`);
      return match;
    },

    async searchUsers({ q, viewerFid, limit, signal }) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(
        buildUrl('/api/users/search', { q, viewer_fid: viewerFid, limit }),
        signal
      );
      return data.users || [];
    },

    async getBulkUsers({ fids, viewerFid, signal }) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(
        buildUrl('/api/users', { fids: fids.join(','), viewer_fid: viewerFid }),
        signal
      );
      return data.users || [];
    },

    async getFollowingFeed({ fid, limit = 15, cursor, signal }) {
      return fetchJson<FeedResponse>(buildUrl('/api/feeds/following', { fid, limit, cursor }), signal);
    },

    async getTrendingFeed({ limit = 10, cursor, signal }) {
      return fetchJson<FeedResponse>(buildUrl('/api/feeds/trending', { limit, cursor }), signal);
    },

    async getChannelFeed({ parentUrl, fid, limit = 15, cursor, signal }) {
      return fetchJson<FeedResponse>(
        buildUrl('/api/feeds/channel', { parent_url: parentUrl, fid, limit, cursor }),
        signal
      );
    },

    async getProfileCasts({ fid, limit = 25, cursor, signal }) {
      return fetchJson<FeedResponse>(buildUrl('/api/feeds/profile', { fid, type: 'casts', limit, cursor }), signal);
    },

    async getProfileLikes({ fid, limit = 25, cursor, signal }) {
      return fetchJson<FeedResponse>(buildUrl('/api/feeds/profile', { fid, type: 'likes', limit, cursor }), signal);
    },

    async getFidListFeed({ fids, viewerFid, limit = 15, cursor, signal }) {
      return fetchJson<FeedResponse>(
        buildUrl('/api/lists', { fids: fids.join(','), viewerFid, limit, cursor }),
        signal
      );
    },

    async searchCasts({ q, filters, limit, offset, signal }) {
      const params: Record<string, string | number | undefined> = { q, limit, offset };
      if (filters) Object.assign(params, filters);
      return fetchJson<SearchCastsResponse>(buildUrl('/api/search', params), signal);
    },

    async getCasts({ hashes, viewerFid, signal }) {
      const data = await fetchJson<{ result: { casts: FarcasterCast[] } }>(
        buildUrl('/api/casts', { casts: hashes.join(','), viewer_fid: viewerFid }),
        signal
      );
      return data.result?.casts || [];
    },

    async getChannel({ id, signal }) {
      const data = await fetchJson<{ channels: FarcasterChannel[] }>(buildUrl('/api/channels', { id }), signal);
      const channel = data.channels?.find((c) => c.id === id);
      if (!channel) throw new Error(`Channel ${id} not found`);
      return channel;
    },

    async searchChannels({ q, signal }) {
      const data = await fetchJson<{ channels: FarcasterChannel[] }>(buildUrl('/api/channels/search', { q }), signal);
      return data.channels || [];
    },

    async getAllChannels(opts) {
      const data = await fetchJson<{ channels: FarcasterChannel[] }>('/api/channels', opts?.signal);
      return data.channels || [];
    },

    async getNotifications({ fid, limit, cursor, type, signal }: GetNotificationsRequest) {
      return fetchJson<NotificationsResponse>(buildUrl('/api/notifications', { fid, limit, cursor, type }), signal);
    },

    async getConversation({ hash, viewerFid, replyDepth = 1, fold, sortType, signal }: GetConversationRequest) {
      const data = await fetchJson<{
        conversation?: {
          cast?: FarcasterCast & { direct_replies?: FarcasterCast[] };
          chronological_parent_casts?: FarcasterCast[];
        };
      }>(
        buildUrl('/api/casts/conversation', {
          identifier: hash,
          reply_depth: replyDepth,
          include_chronological_parent_casts: 'true',
          viewer_fid: viewerFid,
          fold,
          sort_type: sortType,
        }),
        signal
      );
      const focused = data.conversation?.cast;
      if (!focused) {
        throw new Error(`Conversation for ${hash} not found`);
      }
      const { direct_replies: replies = [], ...cast } = focused;
      return {
        parents: data.conversation?.chronological_parent_casts || [],
        cast: cast as FarcasterCast,
        replies,
      } satisfies ConversationResponse;
    },

    async getActiveUsers({ limit = 14, signal }: GetActiveUsersRequest) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(buildUrl('/api/users/active', { limit }), signal);
      return data.users || [];
    },

    async getCastByIdentifier({ identifier, type, viewerFid, signal }: GetCastByIdentifierRequest) {
      const data = await fetchJson<{ cast?: FarcasterCast }>(
        buildUrl('/api/casts/lookup', { identifier, type, viewer_fid: viewerFid }),
        signal
      );
      if (!data.cast) throw new Error(`Cast ${identifier} (${type}) not found`);
      return data.cast;
    },

    async getProfileRepliesAndRecasts({ fid, limit = 25, cursor, signal }) {
      return fetchJson<FeedResponse>(
        buildUrl('/api/feeds/profile', { fid, type: 'replies_and_recasts', limit, cursor }),
        signal
      );
    },

    async getProfilePopular({ fid, limit = 25, cursor, signal }) {
      return fetchJson<FeedResponse>(buildUrl('/api/feeds/profile', { fid, type: 'popular', limit, cursor }), signal);
    },

    async getTrendingChannels(request) {
      const data = await fetchJson<{ channels: FarcasterChannel[] }>(
        buildUrl('/api/channels/trending', { limit: request?.limit }),
        request?.signal
      );
      return data.channels || [];
    },

    async getUserChannels({ fid, limit, cursor, signal }) {
      const data = await fetchJson<{ channels: FarcasterChannel[] }>(
        buildUrl('/api/users/channels', { fid, limit, cursor }),
        signal
      );
      return data.channels || [];
    },

    async getCastReactions({ hash, types, limit, cursor, signal }) {
      return fetchJson<CastReactionsResponse>(buildUrl('/api/casts/reactions', { hash, types, limit, cursor }), signal);
    },

    async getBestFriends({ fid, limit, signal }) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(
        buildUrl('/api/users/best-friends', { fid, limit }),
        signal
      );
      return data.users || [];
    },
  };
}
