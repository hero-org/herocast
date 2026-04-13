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

/** A cast with its nested replies (used in conversation responses). */
export interface CastWithReplies extends FarcasterCast {
  direct_replies: CastWithReplies[];
}

export interface ConversationResponse {
  conversation: {
    cast: CastWithReplies;
    chronological_parent_casts?: FarcasterCast[];
  };
}

/** Which optional capabilities a provider supports. */
export interface ProviderCapabilities {
  trendingFeed: boolean;
  profileCasts: boolean;
  profileLikes: boolean;
  fidListFeed: boolean;
  castLookup: boolean;
  castConversation: boolean;
  allChannels: boolean;
}

export interface FetchOptions {
  signal?: AbortSignal;
}

interface ViewerContextRequest extends FetchOptions {
  viewerFid?: number;
}

interface CursorRequest extends FetchOptions {
  cursor?: string;
  limit?: number;
}

export interface GetUserRequest extends ViewerContextRequest {
  fid: number;
}

export interface GetUserByUsernameRequest extends ViewerContextRequest {
  username: string;
}

export interface SearchUsersRequest extends ViewerContextRequest {
  q: string;
  limit?: number;
}

export interface GetBulkUsersRequest extends ViewerContextRequest {
  fids: number[];
}

export interface GetFollowingFeedRequest extends CursorRequest {
  fid: number;
}

export interface GetTrendingFeedRequest extends CursorRequest {}

export interface GetChannelFeedRequest extends CursorRequest {
  parentUrl: string;
  fid?: number;
}

export interface GetProfileFeedRequest extends CursorRequest {
  fid: number;
}

export interface GetFidListFeedRequest extends ViewerContextRequest, CursorRequest {
  fids: number[];
}

export interface SearchCastsRequest extends FetchOptions {
  q: string;
  filters?: Record<string, string>;
  limit?: number;
  offset?: number;
}

export interface GetCastsRequest extends ViewerContextRequest {
  hashes: string[];
}

export interface GetChannelRequest extends FetchOptions {
  id: string;
}

export interface SearchChannelsRequest extends FetchOptions {
  q: string;
}

export interface GetConversationRequest extends FetchOptions {
  identifier: string;
  type?: 'hash' | 'url';
  replyDepth?: number;
  includeParents?: boolean;
  viewerFid?: number;
}

export interface GetNotificationsRequest extends CursorRequest {
  fid: number;
  type?: string;
}

export class UnsupportedProviderFeatureError extends Error {
  constructor(
    public readonly provider: ProviderType,
    public readonly feature: string
  ) {
    super(`${provider}: ${feature} not supported`);
    this.name = 'UnsupportedProviderFeatureError';
  }
}

export interface FarcasterProvider {
  type: ProviderType;
  capabilities: ProviderCapabilities;

  // Users
  getUser(request: GetUserRequest): Promise<FarcasterUser>;
  getUserByUsername(request: GetUserByUsernameRequest): Promise<FarcasterUser>;
  searchUsers(request: SearchUsersRequest): Promise<FarcasterUser[]>;
  getBulkUsers(request: GetBulkUsersRequest): Promise<FarcasterUser[]>;

  // Feeds
  getFollowingFeed(request: GetFollowingFeedRequest): Promise<FeedResponse>;
  getTrendingFeed(request: GetTrendingFeedRequest): Promise<FeedResponse>;
  getChannelFeed(request: GetChannelFeedRequest): Promise<FeedResponse>;
  getProfileCasts(request: GetProfileFeedRequest): Promise<FeedResponse>;
  getProfileLikes(request: GetProfileFeedRequest): Promise<FeedResponse>;
  getFidListFeed(request: GetFidListFeedRequest): Promise<FeedResponse>;

  // Casts — searchCasts uses offset pagination (Neynar search API), not cursor
  searchCasts(request: SearchCastsRequest): Promise<SearchCastsResponse>;
  getCasts(request: GetCastsRequest): Promise<FarcasterCast[]>;

  // Conversations
  getConversation(request: GetConversationRequest): Promise<ConversationResponse>;

  // Channels
  getChannel(request: GetChannelRequest): Promise<FarcasterChannel>;
  searchChannels(request: SearchChannelsRequest): Promise<FarcasterChannel[]>;
  getAllChannels(opts?: FetchOptions): Promise<FarcasterChannel[]>;

  // Notifications
  getNotifications(request: GetNotificationsRequest): Promise<NotificationsResponse>;
}
