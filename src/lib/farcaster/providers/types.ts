import type { FarcasterCast, FarcasterChannel, FarcasterNotification, FarcasterUser } from '@/common/types/farcaster';

export type ProviderType = 'neynar' | 'hypersnap';

export interface FeedResponse {
  casts: FarcasterCast[];
  next?: { cursor?: string };
}

export interface SearchCastResult {
  hash: string;
  fid: number;
  text: string;
  timestamp: string;
}

export interface SearchCastsResponse {
  results: SearchCastResult[];
  next?: { cursor?: string };
}

export interface NotificationsResponse {
  notifications: FarcasterNotification[];
  next?: { cursor?: string };
}

/** Which optional capabilities a provider supports. */
export interface ProviderCapabilities {
  trendingFeed: boolean;
  profileCasts: boolean;
  profileLikes: boolean;
  fidListFeed: boolean;
  castLookup: boolean;
  allChannels: boolean;
}

export interface FetchOptions {
  signal?: AbortSignal;
}

export interface FarcasterProvider {
  type: ProviderType;
  capabilities: ProviderCapabilities;

  // Users
  getUser(fid: number, opts?: FetchOptions): Promise<FarcasterUser>;
  getUserByUsername(username: string, opts?: FetchOptions): Promise<FarcasterUser>;
  searchUsers(q: string, viewerFid?: number, limit?: number, opts?: FetchOptions): Promise<FarcasterUser[]>;
  getBulkUsers(fids: number[], viewerFid?: number, opts?: FetchOptions): Promise<FarcasterUser[]>;

  // Feeds
  getFollowingFeed(fid: number, limit?: number, cursor?: string, opts?: FetchOptions): Promise<FeedResponse>;
  getTrendingFeed(limit?: number, cursor?: string, opts?: FetchOptions): Promise<FeedResponse>;
  getChannelFeed(
    parentUrl: string,
    fid?: number,
    limit?: number,
    cursor?: string,
    opts?: FetchOptions
  ): Promise<FeedResponse>;
  getProfileCasts(fid: number, limit?: number, cursor?: string, opts?: FetchOptions): Promise<FeedResponse>;
  getProfileLikes(fid: number, limit?: number, cursor?: string, opts?: FetchOptions): Promise<FeedResponse>;
  getFidListFeed(
    fids: number[],
    viewerFid?: number,
    limit?: number,
    cursor?: string,
    opts?: FetchOptions
  ): Promise<FeedResponse>;

  // Casts — searchCasts uses offset pagination (Neynar search API), not cursor
  searchCasts(
    q: string,
    filters?: Record<string, string>,
    limit?: number,
    offset?: number,
    opts?: FetchOptions
  ): Promise<SearchCastsResponse>;
  getCasts(hashes: string[], viewerFid?: number, opts?: FetchOptions): Promise<FarcasterCast[]>;

  // Channels
  getChannel(id: string, opts?: FetchOptions): Promise<FarcasterChannel>;
  searchChannels(q: string, opts?: FetchOptions): Promise<FarcasterChannel[]>;
  getAllChannels(opts?: FetchOptions): Promise<FarcasterChannel[]>;

  // Notifications
  getNotifications(
    fid: number,
    limit?: number,
    cursor?: string,
    type?: string,
    opts?: FetchOptions
  ): Promise<NotificationsResponse>;
}
