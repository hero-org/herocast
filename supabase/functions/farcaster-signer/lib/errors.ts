/**
 * Error handling for the Farcaster Signing Service
 */

import type { ErrorCode, ErrorResponse } from './types.ts';

// ============================================================================
// CORS Headers
// ============================================================================

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key, x-account-id',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
};

// ============================================================================
// Error Codes
// ============================================================================

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

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',

  // Internal errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // Idempotency
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',

  // Channel errors
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
} as const;

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for the Farcaster Signing Service
 */
export class SignerServiceError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, statusCode: number = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = 'SignerServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON(): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * Authentication error (401)
 */
export class UnauthorizedError extends SignerServiceError {
  constructor(message: string = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
  }
}

/**
 * Invalid request error (400)
 */
export class InvalidRequestError extends SignerServiceError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_REQUEST', message, 400, details);
  }
}

/**
 * Account not found error (404)
 */
export class AccountNotFoundError extends SignerServiceError {
  constructor(accountId?: string) {
    super('ACCOUNT_NOT_FOUND', accountId ? `Account ${accountId} not found` : 'Account not found', 404);
  }
}

/**
 * Signing operation failed error (500)
 */
export class SigningFailedError extends SignerServiceError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('SIGNING_FAILED', message, 500, details);
  }
}

/**
 * Hub submission failed error (502)
 */
export class HubSubmissionFailedError extends SignerServiceError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('HUB_SUBMISSION_FAILED', message, 502, details);
  }
}

/**
 * Rate limited error (429)
 */
export class RateLimitedError extends SignerServiceError {
  constructor(message: string = 'Rate limit exceeded') {
    super('RATE_LIMITED', message, 429);
  }
}

/**
 * Internal server error (500)
 */
export class InternalError extends SignerServiceError {
  constructor(message: string = 'Internal server error') {
    super('INTERNAL_ERROR', message, 500);
  }
}

/**
 * Idempotency conflict error (409)
 */
export class IdempotencyConflictError extends SignerServiceError {
  constructor(message: string = 'Request already processed with different parameters') {
    super('IDEMPOTENCY_CONFLICT', message, 409);
  }
}

/**
 * Channel not found error (400)
 */
export class ChannelNotFoundError extends SignerServiceError {
  constructor(channelId: string) {
    super('CHANNEL_NOT_FOUND' as ErrorCode, `Channel not found: ${channelId}`, 400);
  }
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>
): Response {
  const body: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an error response from a SignerServiceError
 */
export function errorToResponse(error: SignerServiceError): Response {
  return new Response(JSON.stringify(error.toJSON()), {
    status: error.statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Handle unknown errors and convert to appropriate response
 */
export function handleError(error: unknown): Response {
  console.error('Error in signing service:', error);

  if (error instanceof SignerServiceError) {
    return errorToResponse(error);
  }

  // Handle ValidationError from validate.ts (returns 400)
  if (error instanceof Error && error.name === 'ValidationError') {
    const code = (error as { code?: string }).code || 'INVALID_MESSAGE';
    return createErrorResponse(code as ErrorCode, error.message, 400);
  }

  // Handle generic errors
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  return createErrorResponse('INTERNAL_ERROR', message, 500);
}
