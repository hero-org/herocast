/**
 * Types for the Farcaster Signing Service Edge Function
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type { HubProvider } from './hubs.ts';

// ============================================================================
// Request Types
// ============================================================================

/**
 * Base embed types for casts
 */
export interface UrlEmbed {
  url: string;
}

export interface CastIdEmbed {
  castId: {
    fid: number;
    hash: string;
  };
}

export type Embed = UrlEmbed | CastIdEmbed;

/**
 * Request to create a new cast
 */
export interface CastRequest {
  type: 'cast';
  text: string;
  embeds?: Embed[];
  mentions?: number[];
  mentionsPositions?: number[];
  parentCastId?: {
    fid: number;
    hash: string;
  };
  parentUrl?: string;
}

/**
 * Reaction types supported by Farcaster
 */
export type ReactionType = 'like' | 'recast';

/**
 * Request to add or remove a reaction
 */
export interface ReactionRequest {
  type: 'reaction';
  reactionType: ReactionType;
  targetCastId: {
    fid: number;
    hash: string;
  };
  remove?: boolean;
}

/**
 * Request to follow or unfollow a user
 */
export interface FollowRequest {
  type: 'follow';
  targetFid: number;
  remove?: boolean;
}

/**
 * Request to delete a cast
 */
export interface DeleteCastRequest {
  type: 'delete_cast';
  targetHash: string;
}

/**
 * Union type for all supported signing requests
 */
export type SigningRequest = CastRequest | ReactionRequest | FollowRequest | DeleteCastRequest;

// ============================================================================
// Response Types
// ============================================================================

/**
 * Successful signing response
 */
export interface SuccessResponse {
  success: true;
  hash: string;
  timestamp?: number;
}

/**
 * Error codes for signing service failures.
 *
 * Single source of truth: `ErrorCode` is derived from this const so the two
 * can never drift (a drift between the const and a hand-maintained union
 * previously caused a `deno check` failure at accounts.ts ACCOUNT_PENDING).
 * `errors.ts` re-exports `ErrorCodes` for backward compatibility.
 */
export const ErrorCodes = {
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  MISSING_AUTH_HEADER: 'MISSING_AUTH_HEADER',
  INVALID_TOKEN: 'INVALID_TOKEN',
  EXPIRED_TOKEN: 'EXPIRED_TOKEN',

  // Request validation errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  INVALID_ACCOUNT_ID: 'INVALID_ACCOUNT_ID',

  // Account errors
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  ACCOUNT_PENDING: 'ACCOUNT_PENDING',

  // Signing errors
  INVALID_FID: 'SIGNING_FAILED',
  SIGNING_FAILED: 'SIGNING_FAILED',

  // Hub errors
  HUB_SUBMISSION_FAILED: 'HUB_SUBMISSION_FAILED',
  HUB_UNKNOWN_STATE: 'HUB_UNKNOWN_STATE',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',

  // Internal errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // Idempotency
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',

  // Channel errors
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Error response from signing service
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Union type for all signing responses
 */
export type SigningResponse = SuccessResponse | ErrorResponse;

// ============================================================================
// Database Types
// ============================================================================

/**
 * Account type from decrypted_accounts view
 * Matches the structure in the Supabase database
 */
export interface Account {
  id: string;
  created_at: string;
  platform: string;
  public_key: string;
  name: string | null;
  data: Record<string, unknown> | null;
  user_id: string;
  status: string;
  platform_account_id: string | null;
  decrypted_private_key: string;
}

/**
 * Audit log entry for signing operations
 */
export interface AuditLogEntry {
  id?: string;
  account_id: string;
  user_id: string;
  action: string;
  success: boolean;
  error_code?: ErrorCode | null;
  created_at?: string;
}

/**
 * Idempotency cache entry
 */
export interface IdempotencyEntry {
  idempotency_key: string;
  account_id: string;
  response_hash: string | null;
  response_error: string | null;
  created_at?: string;
}

// ============================================================================
// Request Context
// ============================================================================

/**
 * Result of successful authentication
 *
 * `userId` is always defined — the signer only accepts user JWTs (real users or
 * cron-minted short-lived JWTs whose `sub` claim is a validated owner user id).
 */
export interface AuthResult {
  userId: string;
  supabaseClient: SupabaseClient;
  /**
   * Origin of the request, extracted from the JWT `source` claim. Used to tag
   * audit rows. Optional for backward compatibility with older callers during
   * the transition; `authenticateRequest` now always populates it.
   */
  source?: string;
}

/**
 * Account data needed for signing operations
 */
export interface SigningAccount {
  fid: number;
  privateKey: string;
  userId: string;
}

/**
 * Authenticated request context
 */
export interface RequestContext {
  userId: string;
  accountId: string;
  account: Account;
  idempotencyKey?: string;
}
