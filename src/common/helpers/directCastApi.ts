import { DIRECT_CAST_API, type DirectCastError } from '../constants/directCast';

export class DirectCastAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public apiError?: DirectCastError
  ) {
    super(message);
    this.name = 'DirectCastAPIError';
  }
}

interface DirectCastAPIOptions {
  apiKey: string;
  timeout?: number;
}

export class DirectCastAPI {
  private apiKey: string;
  private timeout: number;
  private baseUrl: string;

  constructor(options: DirectCastAPIOptions) {
    this.apiKey = options.apiKey;
    this.timeout = options.timeout || 19000; // 19 seconds default
    this.baseUrl = DIRECT_CAST_API.BASE_URL;
  }

  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    options?: {
      body?: any;
      query?: Record<string, string | number | boolean>;
      idempotencyKey?: string;
    }
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = new URL(`${this.baseUrl}${endpoint}`);

      // Add query parameters
      if (options?.query) {
        Object.entries(options.query).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
          }
        });
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      };

      if (options?.idempotencyKey) {
        headers['idempotency-key'] = options.idempotencyKey;
      }

      console.log('[DirectCast API Debug] Making request:', {
        url: url.toString(),
        method,
        hasApiKey: !!this.apiKey,
        apiKeyLength: this.apiKey?.length,
        apiKeyPrefix: this.apiKey?.substring(0, 10) + '...',
      });

      const response = await fetch(url.toString(), {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        console.error('[DirectCast API Debug] API error response:', {
          status: response.status,
          statusText: response.statusText,
          data: data,
          headers: Object.fromEntries(response.headers.entries()),
        });
        throw new DirectCastAPIError(
          data.error || data.message || `API request failed with status ${response.status}`,
          response.status,
          data
        );
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof DirectCastAPIError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new DirectCastAPIError('Request timeout', 503);
        }
        throw new DirectCastAPIError(error.message);
      }

      throw new DirectCastAPIError('Unknown error occurred');
    }
  }

  // Conversation methods
  async getConversationList(params?: {
    category?: 'default' | 'request' | 'archived';
    cursor?: string;
    limit?: number;
  }) {
    return this.makeRequest<any>('GET', DIRECT_CAST_API.ENDPOINTS.LIST_CONVERSATIONS, {
      query: params as any,
    });
  }

  async getConversation(conversationId: string) {
    return this.makeRequest<any>('GET', DIRECT_CAST_API.ENDPOINTS.GET_CONVERSATION, {
      query: { conversationId },
    });
  }

  async createConversation(
    recipientFid: number,
    settings?: {
      messageTTLDays?: 1 | 7 | 30 | 365;
    }
  ) {
    return this.makeRequest<any>('PUT', DIRECT_CAST_API.ENDPOINTS.CREATE_CONVERSATION, {
      body: { recipientFid, settings },
    });
  }

  // Group methods
  async getGroupList(params?: { category?: 'default' | 'request' | 'archived'; cursor?: string; limit?: number }) {
    return this.makeRequest<any>('GET', DIRECT_CAST_API.ENDPOINTS.LIST_GROUPS, {
      query: params as any,
    });
  }

  async getGroup(groupId: string) {
    return this.makeRequest<any>('GET', DIRECT_CAST_API.ENDPOINTS.GET_GROUP, {
      query: { groupId },
    });
  }

  // Message methods
  async getMessageList(params: {
    conversationId?: string;
    groupId?: string;
    unreadMentionsOnly?: boolean;
    cursor?: string;
    limit?: number;
  }) {
    if (!params.conversationId && !params.groupId && !params.unreadMentionsOnly) {
      throw new DirectCastAPIError('Either conversationId, groupId, or unreadMentionsOnly must be provided');
    }

    return this.makeRequest<any>('GET', DIRECT_CAST_API.ENDPOINTS.LIST_MESSAGES, {
      query: params as any,
    });
  }

  async sendMessage(params: {
    conversationId?: string;
    groupId?: string;
    recipientFid?: number;
    message: string;
    inReplyToMessageId?: string;
    idempotencyKey?: string;
  }) {
    const { idempotencyKey, ...body } = params;

    if (!body.conversationId && !body.groupId && !body.recipientFid) {
      throw new DirectCastAPIError('Either conversationId, groupId, or recipientFid must be provided');
    }

    if (body.message.length > DIRECT_CAST_API.MESSAGE.MAX_LENGTH) {
      throw new DirectCastAPIError(
        `Message exceeds maximum length of ${DIRECT_CAST_API.MESSAGE.MAX_LENGTH} characters`
      );
    }

    return this.makeRequest<any>('PUT', DIRECT_CAST_API.ENDPOINTS.SEND_MESSAGE, {
      body,
      idempotencyKey,
    });
  }

  async deleteMessage(params: { conversationId?: string; groupId?: string; messageId: string }) {
    if (!params.conversationId && !params.groupId) {
      throw new DirectCastAPIError('Either conversationId or groupId must be provided');
    }

    return this.makeRequest<any>('DELETE', DIRECT_CAST_API.ENDPOINTS.DELETE_MESSAGE, {
      body: params,
    });
  }

  async markMentionsAsRead() {
    return this.makeRequest<any>('POST', DIRECT_CAST_API.ENDPOINTS.MARK_MENTIONS_READ);
  }
}
