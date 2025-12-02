import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccountStore } from '@/stores/useAccountStore';
import {
  DirectCastConversation,
  DirectCastGroup,
  DirectCastMessage,
  DIRECT_CAST_API,
} from '@/common/constants/directCast';
import { DMTab } from '@/common/components/DirectMessages/DMEmptyState';
import { UUID } from 'crypto';
import { useDebouncedCallback } from '@/common/helpers/hooks';

interface UseDirectMessagesOptions {
  category?: 'default' | 'request' | 'archived';
  enabled?: boolean;
}

// Error types for better classification
enum ErrorType {
  RATE_LIMIT = 'RATE_LIMIT',
  AUTH = 'AUTH',
  NO_API_KEY = 'NO_API_KEY',
  NETWORK = 'NETWORK',
  UNKNOWN = 'UNKNOWN',
}

// Error codes returned by the API
const API_ERROR_CODES = {
  NO_API_KEY: 'NO_API_KEY',
  INVALID_API_KEY: 'INVALID_API_KEY',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
} as const;

interface RetryState {
  attempts: number;
  nextRetryTime: number | null;
  isRetrying: boolean;
}

// Helper to classify errors
function classifyError(error: any): { type: ErrorType; retryable: boolean; waitTime?: number; code?: string } {
  if (!error) return { type: ErrorType.UNKNOWN, retryable: false };

  // Check for API error codes (returned in response body)
  const errorCode = error.code || error.apiError?.code;

  if (errorCode === API_ERROR_CODES.NO_API_KEY) {
    return { type: ErrorType.NO_API_KEY, retryable: false, code: errorCode };
  }

  if (errorCode === API_ERROR_CODES.INVALID_API_KEY) {
    return { type: ErrorType.AUTH, retryable: false, code: errorCode };
  }

  if (errorCode === API_ERROR_CODES.RATE_LIMITED) {
    const waitTime = error.apiError?.retryAfter || 60000;
    return { type: ErrorType.RATE_LIMIT, retryable: true, waitTime, code: errorCode };
  }

  // Check for rate limit errors
  if (error.statusCode === 429 || error.message?.toLowerCase().includes('rate limit')) {
    // Try to extract wait time from headers or response
    const waitTime = error.apiError?.retryAfter || 60000; // Default to 60s if not specified
    return { type: ErrorType.RATE_LIMIT, retryable: true, waitTime };
  }

  // Check for auth errors
  if (
    error.statusCode === 401 ||
    error.statusCode === 403 ||
    error.message?.toLowerCase().includes('unauthorized') ||
    error.message?.toLowerCase().includes('forbidden')
  ) {
    return { type: ErrorType.AUTH, retryable: false };
  }

  // Check for network errors
  if (
    error.statusCode === 503 ||
    error.statusCode === 502 ||
    error.statusCode === 504 ||
    error.message?.toLowerCase().includes('timeout') ||
    error.message?.toLowerCase().includes('network')
  ) {
    return { type: ErrorType.NETWORK, retryable: true };
  }

  // Unknown errors might be retryable
  return { type: ErrorType.UNKNOWN, retryable: true };
}

// Calculate exponential backoff with jitter
function calculateBackoff(attempt: number, maxBackoff: number = 30000): number {
  const baseDelay = 1000; // 1 second
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxBackoff);
  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

export function useDirectMessages(options: UseDirectMessagesOptions = {}) {
  const { category = 'default', enabled = true } = options;
  const selectedAccount = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const updateAccountProperty = useAccountStore((state) => state.updateAccountProperty);

  const [conversations, setConversations] = useState<DirectCastConversation[]>([]);
  const [groups, setGroups] = useState<DirectCastGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [retryState, setRetryState] = useState<RetryState>({
    attempts: 0,
    nextRetryTime: null,
    isRetrying: false,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const maxRetries = 3;

  const fetchDMsInternal = useCallback(
    async (append = false, isRetry = false) => {
      if (!selectedAccount?.id || !selectedAccount?.farcasterApiKey || !enabled) return;

      // Don't retry if we're already at max attempts
      if (isRetry && retryState.attempts >= maxRetries) {
        setRetryState((prev) => ({ ...prev, isRetrying: false }));
        return;
      }

      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      setError(null);

      if (isRetry) {
        setRetryState((prev) => ({ ...prev, isRetrying: true }));
      }

      try {
        const params = new URLSearchParams({
          accountId: selectedAccount.id,
          ...(category && { category }),
          ...(append && cursor && { cursor }),
          limit: '25',
        });

        const response = await fetch(`/api/dms/conversations?${params}`, {
          signal: abortControllerRef.current.signal,
        });
        const data = await response.json();

        // Check for HTTP errors
        if (!response.ok) {
          const error = {
            message: data.error || 'Failed to fetch messages',
            statusCode: response.status,
            code: data.code,
            apiError: data,
          };
          throw error;
        }

        // Check for API error codes even on 200 responses
        if (data.code && (data.code === API_ERROR_CODES.NO_API_KEY || data.code === API_ERROR_CODES.INVALID_API_KEY)) {
          const error = {
            message: data.error || 'API key error',
            statusCode: 200,
            code: data.code,
            apiError: data,
          };
          throw error;
        }

        // Success - reset retry state
        setRetryState({ attempts: 0, nextRetryTime: null, isRetrying: false });

        if (append) {
          setConversations((prev) => [...prev, ...(data.conversations || [])]);
          setGroups((prev) => [...prev, ...(data.groups || [])]);
        } else {
          setConversations(data.conversations || []);
          setGroups(data.groups || []);
        }

        setCursor(data.nextCursor || null);
        setHasMore(!!data.nextCursor);
      } catch (err: any) {
        // Ignore abort errors
        if (err.name === 'AbortError') {
          setIsLoading(false);
          return;
        }

        console.error('Error fetching DMs:', err);

        const { type, retryable, waitTime, code } = classifyError(err);
        const errorMessage = err.message || 'Failed to fetch messages';

        setError(errorMessage);
        setErrorCode(code || err.code || null);

        if (type === ErrorType.NO_API_KEY) {
          setRetryState({ attempts: 0, nextRetryTime: null, isRetrying: false });
          return;
        }

        if (type === ErrorType.AUTH) {
          if (selectedAccount?.id) {
            updateAccountProperty(selectedAccount.id as UUID, 'farcasterApiKey', undefined);
          }
          setRetryState({ attempts: 0, nextRetryTime: null, isRetrying: false });
          return;
        }

        // Handle retryable errors
        if (retryable && retryState.attempts < maxRetries) {
          const nextAttempt = retryState.attempts + 1;
          let delay: number;

          if (type === ErrorType.RATE_LIMIT && waitTime) {
            // Use server-specified wait time for rate limits
            delay = waitTime;
          } else {
            // Use exponential backoff for other errors
            delay = calculateBackoff(nextAttempt);
          }

          const retryTime = Date.now() + delay;

          setRetryState({
            attempts: nextAttempt,
            nextRetryTime: retryTime,
            isRetrying: false,
          });

          // Schedule retry
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }

          retryTimeoutRef.current = setTimeout(() => {
            fetchDMsInternal(append, true);
          }, delay);
        } else {
          // Max retries reached or non-retryable error
          setRetryState({ attempts: 0, nextRetryTime: null, isRetrying: false });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      selectedAccount?.id,
      selectedAccount?.farcasterApiKey,
      category,
      cursor,
      enabled,
      retryState.attempts,
      updateAccountProperty,
    ]
  );

  // Direct fetch without debounce for instant loading
  const fetchDMs = useCallback(
    (append: boolean = false, isRetry: boolean = false) => {
      fetchDMsInternal(append, isRetry);
    },
    [fetchDMsInternal]
  );

  // Debounced loadMore with 500ms delay to prevent rapid pagination
  const loadMore = useDebouncedCallback(
    () => {
      if (!isLoading && hasMore && !retryState.isRetrying) {
        fetchDMsInternal(true);
      }
    },
    500,
    [fetchDMsInternal, isLoading, hasMore, retryState.isRetrying]
  );

  const refresh = useCallback(() => {
    // Cancel any pending retries
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    setRetryState({ attempts: 0, nextRetryTime: null, isRetrying: false });
    setCursor(null);
    fetchDMsInternal(false);
  }, [fetchDMsInternal]);

  // Manual retry function for users
  const retryAfterError = useCallback(() => {
    if (!isLoading) {
      // Reset retry attempts for manual retry
      setRetryState({ attempts: 0, nextRetryTime: null, isRetrying: false });
      fetchDMsInternal(false);
    }
  }, [fetchDMsInternal, isLoading]);

  // Initial fetch - use debounced version to handle rapid account switches
  useEffect(() => {
    if (enabled) {
      fetchDMs(false);
    }
  }, [selectedAccount?.id, selectedAccount?.farcasterApiKey, category, enabled]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    if (enabled && selectedAccount?.farcasterApiKey) {
      intervalRef.current = setInterval(() => {
        // Don't auto-refresh if we're in retry mode
        if (!retryState.isRetrying && retryState.attempts === 0) {
          fetchDMsInternal(false);
        }
      }, DIRECT_CAST_API.AUTO_REFRESH_INTERVAL);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [enabled, selectedAccount?.farcasterApiKey, fetchDMsInternal, retryState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    conversations,
    groups,
    isLoading,
    error,
    errorCode,
    hasMore,
    loadMore,
    refresh,
    retryAfterError,
    retryState,
  };
}

export function useDirectMessageThread(conversationId?: string, groupId?: string) {
  const selectedAccount = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const updateAccountProperty = useAccountStore((state) => state.updateAccountProperty);

  const [messages, setMessages] = useState<DirectCastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [retryState, setRetryState] = useState<RetryState>({
    attempts: 0,
    nextRetryTime: null,
    isRetrying: false,
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const maxRetries = 3;

  const fetchMessagesInternal = useCallback(
    async (append = false, isRetry = false) => {
      if (!selectedAccount?.id || !selectedAccount?.farcasterApiKey) return;
      if (!conversationId && !groupId) return;

      // Don't retry if we're already at max attempts
      if (isRetry && retryState.attempts >= maxRetries) {
        setRetryState((prev) => ({ ...prev, isRetrying: false }));
        return;
      }

      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      setError(null);

      if (isRetry) {
        setRetryState((prev) => ({ ...prev, isRetrying: true }));
      }

      try {
        const params = new URLSearchParams({
          accountId: selectedAccount.id,
          ...(conversationId && { conversationId }),
          ...(groupId && { groupId }),
          ...(append && cursor && { cursor }),
          limit: '50',
        });

        const response = await fetch(`/api/dms/messages?${params}`, {
          signal: abortControllerRef.current.signal,
        });
        const data = await response.json();

        if (!response.ok) {
          const error = {
            message: data.error || 'Failed to fetch messages',
            statusCode: response.status,
            apiError: data,
          };
          throw error;
        }

        // Success - reset retry state
        setRetryState({ attempts: 0, nextRetryTime: null, isRetrying: false });

        if (append) {
          setMessages((prev) => [...prev, ...(data.messages || [])]);
        } else {
          setMessages(data.messages || []);
        }

        setCursor(data.nextCursor || null);
        setHasMore(!!data.nextCursor);
      } catch (err: any) {
        // Ignore abort errors
        if (err.name === 'AbortError') {
          setIsLoading(false);
          return;
        }

        console.error('Error fetching messages:', err);

        const { type, retryable, waitTime } = classifyError(err);
        const errorMessage = err.message || 'Failed to fetch messages';

        setError(errorMessage);

        if (type === ErrorType.AUTH) {
          if (selectedAccount?.id) {
            updateAccountProperty(selectedAccount.id as UUID, 'farcasterApiKey', undefined);
          }
          setRetryState({ attempts: 0, nextRetryTime: null, isRetrying: false });
          return;
        }

        // Handle retryable errors
        if (retryable && retryState.attempts < maxRetries) {
          const nextAttempt = retryState.attempts + 1;
          let delay: number;

          if (type === ErrorType.RATE_LIMIT && waitTime) {
            // Use server-specified wait time for rate limits
            delay = waitTime;
          } else {
            // Use exponential backoff for other errors
            delay = calculateBackoff(nextAttempt);
          }

          const retryTime = Date.now() + delay;

          setRetryState({
            attempts: nextAttempt,
            nextRetryTime: retryTime,
            isRetrying: false,
          });

          // Schedule retry
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }

          retryTimeoutRef.current = setTimeout(() => {
            fetchMessagesInternal(append, true);
          }, delay);
        } else {
          // Max retries reached or non-retryable error
          setRetryState({ attempts: 0, nextRetryTime: null, isRetrying: false });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      selectedAccount?.id,
      selectedAccount?.farcasterApiKey,
      conversationId,
      groupId,
      cursor,
      retryState.attempts,
      updateAccountProperty,
    ]
  );

  // Direct fetch without debounce for instant loading
  const fetchMessages = useCallback(
    (append: boolean = false, isRetry: boolean = false) => {
      fetchMessagesInternal(append, isRetry);
    },
    [fetchMessagesInternal]
  );

  // Debounced loadMore with 500ms delay to prevent rapid pagination
  const loadMore = useDebouncedCallback(
    () => {
      if (!isLoading && hasMore && !retryState.isRetrying) {
        fetchMessagesInternal(true);
      }
    },
    500,
    [fetchMessagesInternal, isLoading, hasMore, retryState.isRetrying]
  );

  // Manual retry function for users
  const retryAfterError = useCallback(() => {
    if (!isLoading) {
      // Reset retry attempts for manual retry
      setRetryState({ attempts: 0, nextRetryTime: null, isRetrying: false });
      fetchMessagesInternal(false);
    }
  }, [fetchMessagesInternal, isLoading]);

  // Fetch messages when conversation/group changes - use debounced version
  useEffect(() => {
    // Clear messages immediately when switching conversations
    setMessages([]);

    if (conversationId || groupId) {
      // Cancel any pending retries when switching conversations
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      setRetryState({ attempts: 0, nextRetryTime: null, isRetrying: false });
      setCursor(null);
      fetchMessages(false);
    }

    // Cleanup function to remove any pending optimistic messages when switching conversations
    return () => {
      setMessages((prev) => prev.filter((msg) => !(msg as any)._optimistic || (msg as any)._status !== 'pending'));
    };
  }, [conversationId, groupId, selectedAccount?.id, selectedAccount?.farcasterApiKey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Refresh messages (non-append, non-retry)
  const refresh = useCallback(() => {
    setCursor(null);
    fetchMessages(false);
  }, [fetchMessages]);

  // Send message with optimistic updates
  const sendMessage = useCallback(
    async (text: string, options?: { conversationId?: string; groupId?: string; recipientFid?: number }) => {
      if (!selectedAccount?.id || !selectedAccount?.farcasterApiKey) {
        throw new Error('No account or API key available');
      }

      // Create optimistic message
      const optimisticMessage: DirectCastMessage = {
        messageId: `pending-${Date.now()}`,
        message: text,
        senderFid: Number(selectedAccount.platformAccountId),
        creationTimestamp: Math.floor(Date.now() / 1000),
        isDeleted: false,
        isProgrammatic: false,
        // Add metadata to identify as optimistic
        _optimistic: true,
        _status: 'pending',
      } as DirectCastMessage & { _optimistic: boolean; _status: 'pending' | 'sent' | 'failed' };

      // Store the current conversation/group ID to validate later
      const currentConversationId = options?.conversationId || conversationId;
      const currentGroupId = options?.groupId || groupId;

      // Only add optimistic message if we're still in the same conversation
      if (
        (currentConversationId && currentConversationId === conversationId) ||
        (currentGroupId && currentGroupId === groupId) ||
        options?.recipientFid
      ) {
        setMessages((prev) => [optimisticMessage, ...prev]);
      }

      try {
        const payload: any = { message: text };

        // Use provided IDs or fall back to current conversation/group
        if (options?.conversationId || conversationId) {
          payload.conversationId = options?.conversationId || conversationId;
        } else if (options?.groupId || groupId) {
          payload.groupId = options?.groupId || groupId;
        } else if (options?.recipientFid) {
          payload.recipientFid = options.recipientFid;
        } else {
          throw new Error('No conversation, group, or recipient specified');
        }

        const response = await fetch(`/api/dms/messages?accountId=${selectedAccount.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send message');
        }

        const result = await response.json();

        // Only update messages if we're still in the same conversation
        if (
          (currentConversationId && currentConversationId === conversationId) ||
          (currentGroupId && currentGroupId === groupId)
        ) {
          setMessages((prev) => {
            const filtered = prev.filter((msg) => msg.messageId !== optimisticMessage.messageId);
            // If we have a new message from the server, add it
            if (result.message) {
              return [result.message, ...filtered];
            }
            // Otherwise just remove the optimistic one and refresh will get the new message
            return filtered;
          });
        }

        // Refresh to ensure we have the latest messages
        // Small delay to allow server to process
        setTimeout(() => {
          refresh();
        }, 500);

        return result;
      } catch (error) {
        // Only mark as failed if we're still in the same conversation
        if (
          (currentConversationId && currentConversationId === conversationId) ||
          (currentGroupId && currentGroupId === groupId)
        ) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageId === optimisticMessage.messageId
                ? {
                    ...msg,
                    _status: 'failed' as any,
                    _error: error instanceof Error ? error.message : 'Failed to send',
                  }
                : msg
            )
          );
        }
        throw error;
      }
    },
    [selectedAccount, conversationId, groupId, refresh]
  );

  return {
    messages,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    retryAfterError,
    retryState,
    sendMessage,
  };
}
