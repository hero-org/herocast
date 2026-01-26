import { DirectCastAPIError } from '../helpers/directCastApi';

export enum DMErrorType {
  INVALID_API_KEY = 'INVALID_API_KEY',
  RATE_LIMIT = 'RATE_LIMIT',
  NETWORK = 'NETWORK',
  NOT_FOUND = 'NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export interface DMErrorInfo {
  type: DMErrorType;
  message: string;
  action?: string;
  canRetry: boolean;
}

// Error type detection functions
export function isInvalidApiKeyError(error: unknown): boolean {
  if (error instanceof DirectCastAPIError) {
    return error.statusCode === 401 || error.statusCode === 403;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('invalid api key') ||
      message.includes('authentication failed')
    );
  }
  return false;
}

export function isRateLimitError(error: unknown): boolean {
  if (error instanceof DirectCastAPIError) {
    return error.statusCode === 429;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('rate limit') || message.includes('too many requests') || message.includes('throttled');
  }
  return false;
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('fetch failed') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')
    );
  }
  return false;
}

export function isNotFoundError(error: unknown): boolean {
  if (error instanceof DirectCastAPIError) {
    return error.statusCode === 404;
  }
  if (error instanceof Error) {
    return error.message.toLowerCase().includes('not found');
  }
  return false;
}

export function isServerError(error: unknown): boolean {
  if (error instanceof DirectCastAPIError) {
    return error.statusCode >= 500 && error.statusCode < 600;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('internal server error') || message.includes('server error');
  }
  return false;
}

// Get error type and user-friendly message
export function getErrorInfo(error: unknown): DMErrorInfo {
  if (isInvalidApiKeyError(error)) {
    return {
      type: DMErrorType.INVALID_API_KEY,
      message: 'Your DirectCast API key is invalid or has expired.',
      action: 'Please update your API key in Account Settings.',
      canRetry: false,
    };
  }

  if (isRateLimitError(error)) {
    return {
      type: DMErrorType.RATE_LIMIT,
      message: "You've hit the rate limit for DirectCast API.",
      action: 'Please wait a moment before trying again.',
      canRetry: true,
    };
  }

  if (isNetworkError(error)) {
    return {
      type: DMErrorType.NETWORK,
      message: 'Unable to connect to DirectCast servers.',
      action: 'Please check your internet connection and try again.',
      canRetry: true,
    };
  }

  if (isNotFoundError(error)) {
    return {
      type: DMErrorType.NOT_FOUND,
      message: 'The requested resource was not found.',
      action: 'The conversation or message may have been deleted.',
      canRetry: false,
    };
  }

  if (isServerError(error)) {
    return {
      type: DMErrorType.SERVER_ERROR,
      message: 'DirectCast is experiencing technical difficulties.',
      action: 'Please try again later.',
      canRetry: true,
    };
  }

  // Default/unknown error
  return {
    type: DMErrorType.UNKNOWN,
    message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    action: 'Please try again or contact support if the issue persists.',
    canRetry: true,
  };
}

// Retry logic utilities
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
};

export function calculateBackoffDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const delay = Math.min(config.baseDelay * config.backoffFactor ** (attempt - 1), config.maxDelay);
  // Add jitter to prevent thundering herd
  const jitter = delay * 0.1 * Math.random();
  return Math.floor(delay + jitter);
}

export function shouldRetry(error: unknown, attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
  if (attempt >= config.maxAttempts) {
    return false;
  }

  const errorInfo = getErrorInfo(error);
  return errorInfo.canRetry;
}

// Utility to format error for display
export function formatErrorMessage(error: unknown): string {
  const errorInfo = getErrorInfo(error);
  let message = errorInfo.message;

  if (errorInfo.action) {
    message += ` ${errorInfo.action}`;
  }

  return message;
}

// Retry wrapper for async functions
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: unknown) => void
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error, attempt, config)) {
        throw error;
      }

      if (attempt < config.maxAttempts) {
        const delay = calculateBackoffDelay(attempt, config);
        onRetry?.(attempt, error);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
