/**
 * Farcaster protocol types used throughout the app.
 *
 * These match the Neynar v2 API response shapes (which Hypersnap also returns).
 * Defined here so the app has no type-level dependency on @neynar/nodejs-sdk.
 */

// ── User ────────────────────────────────────────────────────────────────

export interface FarcasterUser {
  object: 'user';
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  profile: {
    bio: {
      text: string;
    };
  };
  follower_count: number;
  following_count: number;
  power_badge?: boolean;
  custody_address?: string;
  registered_at?: string;
  verifications?: string[];
  auth_addresses?: Array<{ address: string; app: { fid: number; username?: string } }>;
  verified_addresses?: {
    eth_addresses: string[];
    sol_addresses: string[];
    primary?: {
      eth_address?: string;
      sol_address?: string;
    };
  };
  verified_accounts?: unknown[];
  viewer_context?: {
    following?: boolean;
    followed_by?: boolean;
  };
}

// ── Cast ────────────────────────────────────────────────────────────────

export interface CastReactions {
  likes_count: number;
  recasts_count: number;
  likes: Array<{ fid: number; fname?: string }>;
  recasts: Array<{ fid: number; fname?: string }>;
}

export interface CastEmbed {
  url?: string;
  cast_id?: { fid: number; hash: string };
  metadata?: unknown;
}

export interface FarcasterCast {
  object: 'cast';
  hash: string;
  parent_hash?: string | null;
  parent_url?: string;
  parent_author?: { fid: number };
  author: FarcasterUser;
  text: string;
  timestamp: string;
  embeds: CastEmbed[];
  type?: string;
  reactions: CastReactions;
  replies: { count: number };
  mentioned_profiles?: FarcasterUser[];
  mentioned_profiles_ranges?: number[][];
  mentioned_channels?: FarcasterChannel[];
  mentioned_channels_ranges?: number[][];
  root_parent_url?: string;
  channel?: FarcasterChannel | null;
  frames?: unknown[];
  viewer_context?: {
    liked?: boolean;
    recasted?: boolean;
  };
}

// ── Channel ─────────────────────────────────────────────────────────────

export interface FarcasterChannel {
  object?: 'channel';
  id: string;
  name: string;
  url: string;
  image_url?: string;
  icon_url?: string;
  description?: string;
  parent_url?: string;
  created_at?: string | number;
  follower_count?: number;
  member_count?: number;
  lead?: FarcasterUser;
  moderator?: FarcasterUser;
}

// ── Notification ────────────────────────────────────────────────────────

export enum NotificationType {
  Reply = 'reply',
  Mention = 'mention',
  Likes = 'likes',
  Recasts = 'recasts',
  Follows = 'follows',
}

export interface FarcasterNotification {
  object: 'notification';
  type: NotificationType;
  cast?: FarcasterCast | null;
  reactions?: Array<{ object: string; user: FarcasterUser }>;
  follows?: Array<{ object: string; user: FarcasterUser }>;
  most_recent_timestamp?: string;
  // Hypersnap returns flat user + timestamp instead of reactions/follows arrays
  user?: FarcasterUser;
  timestamp?: string;
}
