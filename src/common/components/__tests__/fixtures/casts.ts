/**
 * Deterministic FarcasterCast fixtures for the StandardCastRow regression test.
 *
 * These shapes match `FarcasterCast` from `@/common/types/farcaster` plus the
 * optional `inclusion_context` extension that CastRow uses.
 *
 * Hashes are realistic 0x-prefixed hex; FIDs and timestamps are stable so
 * snapshots don't drift.
 */

import type { FarcasterCast, FarcasterUser } from '@/common/types/farcaster';

// Pinned timestamp far enough in the past that formatDistanceToNowStrict yields
// a stable "x years" string for the foreseeable future.
const FIXED_TIMESTAMP = '2024-01-15T10:30:00.000Z';

const baseAuthor: FarcasterUser = {
  object: 'user',
  fid: 4242,
  username: 'alice',
  display_name: 'Alice Wonderland',
  pfp_url: 'https://example.com/alice.png',
  profile: { bio: { text: 'Hi from fixtures.' } },
  follower_count: 100,
  following_count: 50,
};

const recasterAuthor: FarcasterUser = {
  object: 'user',
  fid: 4242,
  username: 'bob',
  display_name: 'Bob Builder',
  pfp_url: 'https://example.com/bob.png',
  profile: { bio: { text: 'Builder.' } },
  follower_count: 10,
  following_count: 5,
};

type CastWithInclusion = FarcasterCast & {
  inclusion_context?: {
    is_following_recaster: boolean;
    is_following_author: boolean;
  };
};

const emptyReactions = {
  likes_count: 0,
  recasts_count: 0,
  likes: [],
  recasts: [],
};

export const textOnly: CastWithInclusion = {
  object: 'cast',
  hash: '0x0000000000000000000000000000000000000001',
  parent_hash: null,
  author: baseAuthor,
  text: 'Hello from herocast — this is a plain text cast with no embeds.',
  timestamp: FIXED_TIMESTAMP,
  embeds: [],
  reactions: emptyReactions,
  replies: { count: 0 },
};

export const withMentionAndChannel: CastWithInclusion = {
  object: 'cast',
  hash: '0x0000000000000000000000000000000000000002',
  parent_hash: null,
  parent_url: 'https://warpcast.com/~/channel/farcaster',
  author: baseAuthor,
  text: 'gm @dwr check out $DEGEN over in /farcaster channel',
  timestamp: FIXED_TIMESTAMP,
  embeds: [],
  reactions: emptyReactions,
  replies: { count: 0 },
};

export const withImageEmbed: CastWithInclusion = {
  object: 'cast',
  hash: '0x0000000000000000000000000000000000000003',
  parent_hash: null,
  author: baseAuthor,
  text: 'Look at this image.',
  timestamp: FIXED_TIMESTAMP,
  embeds: [{ url: 'https://example.com/image.png' }],
  reactions: emptyReactions,
  replies: { count: 0 },
};

export const withQuoteCast: CastWithInclusion = {
  object: 'cast',
  hash: '0x0000000000000000000000000000000000000004',
  parent_hash: null,
  author: baseAuthor,
  text: 'Quoting an earlier cast below.',
  timestamp: FIXED_TIMESTAMP,
  embeds: [
    {
      cast_id: {
        fid: 9999,
        hash: '0x0000000000000000000000000000000000000099',
      },
    },
  ],
  reactions: emptyReactions,
  replies: { count: 0 },
};

export const withRecast: CastWithInclusion = {
  object: 'cast',
  hash: '0x0000000000000000000000000000000000000005',
  parent_hash: null,
  author: baseAuthor,
  text: 'A cast that someone we follow recasted.',
  timestamp: FIXED_TIMESTAMP,
  embeds: [],
  reactions: {
    likes_count: 0,
    recasts_count: 1,
    likes: [],
    recasts: [{ fid: 7777, fname: 'recaster' }],
  },
  replies: { count: 0 },
  inclusion_context: {
    is_following_recaster: true,
    is_following_author: false,
  },
};

const longTextLine =
  'This is a very long line of cast text intended to overflow the line-clamp-6 container so the regression test exercises the truncation detection codepath. ';
export const withLongText: CastWithInclusion = {
  object: 'cast',
  hash: '0x0000000000000000000000000000000000000006',
  parent_hash: null,
  author: baseAuthor,
  text: longTextLine.repeat(12),
  timestamp: FIXED_TIMESTAMP,
  embeds: [],
  reactions: emptyReactions,
  replies: { count: 0 },
};

export const withReactions: CastWithInclusion = {
  object: 'cast',
  hash: '0x0000000000000000000000000000000000000007',
  parent_hash: null,
  author: baseAuthor,
  text: 'A cast with non-zero reactions.',
  timestamp: FIXED_TIMESTAMP,
  embeds: [],
  reactions: {
    likes_count: 12,
    recasts_count: 4,
    likes: [
      { fid: 1, fname: 'one' },
      { fid: 2, fname: 'two' },
    ],
    recasts: [{ fid: 3, fname: 'three' }],
  },
  replies: { count: 7 },
};

export const allFixtures = {
  textOnly,
  withMentionAndChannel,
  withImageEmbed,
  withQuoteCast,
  withRecast,
  withLongText,
  withReactions,
} as const;

export type FixtureName = keyof typeof allFixtures;

// Avoid unused-symbol warnings in consumers that only import a subset.
export const _recasterAuthor = recasterAuthor;
