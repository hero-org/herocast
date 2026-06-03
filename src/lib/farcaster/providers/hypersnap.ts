import type { FarcasterCast, FarcasterChannel, FarcasterUser } from '@/common/types/farcaster';
import { measureAsync } from '@/stores/usePerformanceStore';
import type {
  CastReaction,
  CastReactionsResponse,
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

// Hypersnap's /feed/following interleaves replies with root casts (only ~15-20% are root
// casts), so after dropping replies a raw fetch surfaces few top-level casts. We over-fetch
// modestly to thicken each fetch. The feed is a continuous infinite scroll that keeps
// fetching while the bottom sentinel stays in view, so a small multiplier is enough — the
// scroll loop tops up the rest. Capped at the upstream max limit of 100.
const FOLLOWING_FEED_OVERFETCH = 3;
const FOLLOWING_FEED_MAX_LIMIT = 100;

// Hypersnap's filter feed accepts at most 100 FIDs per request; slice larger lists.
const FID_LIST_MAX_FIDS = 100;

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
      // Unlike Neynar's following feed (root-only), Hypersnap returns replies inline and
      // ignores reply-filter params (with_replies, include_replies, filter_type, ...), so
      // we filter client-side to match the native contract. Over-fetch to compensate, then
      // return every root cast in the window (no truncation) so the cursor advances by the
      // full upstream window and pagination never skips casts.
      const fetchLimit = Math.min(FOLLOWING_FEED_MAX_LIMIT, limit * FOLLOWING_FEED_OVERFETCH);
      const data = await fetchJson<FeedResponse>(
        buildUrl('feed/following', { fid, limit: fetchLimit, cursor }),
        signal
      );
      return { ...data, casts: (data.casts ?? []).filter((cast) => !cast.parent_hash) };
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

    async getFidListFeed({ fids, limit = 15, cursor, signal }) {
      // Hypersnap's filter feed caps the FID set at 100; slice larger lists to the first 100.
      const cappedFids = fids.slice(0, FID_LIST_MAX_FIDS);
      return fetchJson<FeedResponse>(
        buildUrl('feed', {
          feed_type: 'filter',
          filter_type: 'fids',
          fids: cappedFids.join(','),
          limit,
          cursor,
        }),
        signal
      );
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

    async getConversation({ hash, replyDepth, signal }) {
      // Hypersnap exposes /cast/conversation but only returns direct_replies — it does
      // NOT populate chronological_parent_casts. Walk parent_hash manually via /cast.
      // Tracked in #715.
      const data = await fetchJson<{
        conversation?: { cast?: FarcasterCast & { direct_replies?: FarcasterCast[] } };
      }>(buildUrl('cast/conversation', { identifier: hash, type: 'hash', reply_depth: replyDepth ?? 2 }), signal);
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

    async getActiveUsers({ limit = 14, viewerFid, signal }) {
      // Hypersnap's discovery is per-viewer via `following/suggested`. Without a viewer FID
      // there's nothing to personalize on, so return empty — RecommendedProfilesCard then
      // renders curated defaults rather than falling through to a blocked Neynar.
      if (!viewerFid) return [];
      const data = await fetchJson<{ users: FarcasterUser[] }>(
        buildUrl('following/suggested', { fid: viewerFid, limit }),
        signal
      );
      return data.users ?? [];
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

    async getProfileRepliesAndRecasts({ fid, limit = 25, cursor, signal }) {
      return fetchJson<FeedResponse>(buildUrl('feed/user/replies_and_recasts', { fid, limit, cursor }), signal);
    },

    async getProfilePopular({ fid, limit = 25, signal }) {
      // Hypersnap's popular feed returns a fixed top-cast set with no pagination cursor.
      const data = await fetchJson<{ casts: FarcasterCast[] }>(buildUrl('feed/user/popular', { fid, limit }), signal);
      return { casts: data.casts ?? [], next: { cursor: undefined } };
    },

    async getTrendingChannels(request) {
      const data = await fetchJson<{ channels: FarcasterChannel[] }>(
        buildUrl('channel/trending', { limit: request?.limit }),
        request?.signal
      );
      return data.channels ?? [];
    },

    async getUserChannels({ fid, limit, cursor, signal }) {
      const data = await fetchJson<{ channels: FarcasterChannel[] }>(
        buildUrl('user/channels', { fid, limit, cursor }),
        signal
      );
      return data.channels ?? [];
    },

    async getCastReactions({ hash, types = 'likes,recasts', limit, cursor, signal }) {
      // Entries arrive pre-hydrated with reaction_type/reaction_timestamp/user, matching CastReaction.
      const data = await fetchJson<{ reactions: CastReaction[]; next?: { cursor?: string } }>(
        buildUrl('reaction/cast', { hash, types, limit, cursor }),
        signal
      );
      return { reactions: data.reactions ?? [], next: data.next } satisfies CastReactionsResponse;
    },

    async getBestFriends({ fid, limit, signal }) {
      const data = await fetchJson<{ users: FarcasterUser[] }>(buildUrl('user/best_friends', { fid, limit }), signal);
      return data.users ?? [];
    },
  };
}
