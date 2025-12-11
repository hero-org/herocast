import type { FarcasterEmbed } from '@/common/types/embeds';
import { UUID } from 'crypto';

export type ParentCastIdType = {
  fid: number;
  hash: string; // Hex string with 0x prefix (e.g., "0x1234...") - stored as string for JSON serialization compatibility
};

// Embed cast ID type - uses string hash for JSON serialization compatibility
// Note: The FarcasterEmbed type from mod-protocol accepts both string and Uint8Array for hash
export type EmbedCastIdType = {
  fid: number;
  hash: string; // Hex string with 0x prefix
};

// Validation helper for cast hashes - use during development to catch issues
export function validateCastHash(hash: unknown, context: string): string {
  if (typeof hash !== 'string') {
    console.error(`[HASH_VALIDATION] ${context}: hash is not a string, got ${typeof hash}`, hash);
    throw new Error(`Invalid hash type in ${context}: expected string, got ${typeof hash}`);
  }

  if (!hash.startsWith('0x')) {
    console.error(`[HASH_VALIDATION] ${context}: hash missing 0x prefix`, hash);
    throw new Error(`Invalid hash format in ${context}: missing 0x prefix`);
  }

  // Farcaster hashes are 20 bytes = 40 hex chars + 2 for "0x" = 42 chars
  if (hash.length !== 42) {
    console.error(`[HASH_VALIDATION] ${context}: hash wrong length ${hash.length}, expected 42`, hash);
    throw new Error(`Invalid hash length in ${context}: expected 42 chars (0x + 40 hex), got ${hash.length}`);
  }

  // Verify it's valid hex
  if (!/^0x[0-9a-fA-F]{40}$/.test(hash)) {
    console.error(`[HASH_VALIDATION] ${context}: hash contains invalid characters`, hash);
    throw new Error(`Invalid hash format in ${context}: contains non-hex characters`);
  }

  console.log(`[HASH_VALIDATION] ${context}: hash valid ✓`, hash.slice(0, 10) + '...');
  return hash;
}

// Helper to create a valid parent cast ID with validation
export function createParentCastId(fid: number | string, hash: string, context: string): ParentCastIdType {
  const validatedHash = validateCastHash(hash, context);
  const numericFid = typeof fid === 'string' ? parseInt(fid, 10) : fid;

  if (isNaN(numericFid) || numericFid <= 0) {
    console.error(`[HASH_VALIDATION] ${context}: invalid fid`, fid);
    throw new Error(`Invalid fid in ${context}: ${fid}`);
  }

  return {
    fid: numericFid,
    hash: validatedHash,
  };
}

// Helper to create a valid embed cast ID with validation
export function createEmbedCastId(fid: number | string, hash: string, context: string): EmbedCastIdType {
  const validatedHash = validateCastHash(hash, context);
  const numericFid = typeof fid === 'string' ? parseInt(fid, 10) : fid;

  if (isNaN(numericFid) || numericFid <= 0) {
    console.error(`[HASH_VALIDATION] ${context}: invalid fid`, fid);
    throw new Error(`Invalid fid in ${context}: ${fid}`);
  }

  return {
    fid: numericFid,
    hash: validatedHash,
  };
}

export enum DraftStatus {
  writing = 'writing',
  scheduled = 'scheduled',
  publishing = 'publishing',
  published = 'published',
  removed = 'removed',
  failed = 'failed',
}

export type DraftType = {
  id: UUID;
  text: string;
  status: DraftStatus;
  createdAt: number;
  mentionsToFids?: { [key: string]: string };
  embeds?: FarcasterEmbed[];
  parentUrl?: string;
  parentCastId?: ParentCastIdType;
  accountId?: UUID;
  timestamp?: string;
  hash?: string;
};

// drafttype without createdAt
export type DraftTemplateType = Omit<DraftType, 'createdAt'>;

export type AuthorType = {
  fid: string;
  username: string;
  display_name?: string;
  displayName?: string;
  pfp_url?: string;
  pfp: {
    url: string;
  };
};

export type EmbedType = {
  url: string;
};

export enum CastReactionType {
  likes = 'likes',
  recasts = 'recasts',
  replies = 'replies',
  quote = 'quote',
  links = 'links',
}

export type CastReactionsType = {
  CastReactionType?: { fid: number }[];
  recasts?: { fid: number }[];
  likes?: { fid: number }[];
  count?: number;
  fids?: number[];
};

export type CastType = {
  author: AuthorType;
  hash: string;
  parent_author: AuthorType | { fid?: string } | null;
  parentHash: string | null;
  parent_hash: string | null;
  parent_url: string | null;
  reactions: CastReactionsType;
  text: string;
  thread_hash: string | null;
  timestamp: string;
  embeds: EmbedType[];
  replies?: { count: number };
  recasts?: { fids: number[]; count: number };
};
