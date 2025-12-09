// Direct Cast API Constants

export const DIRECT_CAST_API = {
  BASE_URL: 'https://api.farcaster.xyz',

  // API Endpoints
  ENDPOINTS: {
    // Conversations
    CREATE_CONVERSATION: '/fc/conversation',
    GET_CONVERSATION: '/fc/conversation',
    UPDATE_CONVERSATION: '/fc/conversation',
    LIST_CONVERSATIONS: '/fc/conversation-list',

    // Groups
    CREATE_GROUP: '/fc/group',
    GET_GROUP: '/fc/group',
    UPDATE_GROUP: '/fc/group',
    LIST_GROUPS: '/fc/group-list',
    GROUP_INVITES: '/fc/group-invites',
    GROUP_MEMBERS: '/fc/group-members',

    // Messages
    SEND_MESSAGE: '/fc/message',
    GET_MESSAGE: '/fc/message',
    DELETE_MESSAGE: '/fc/message',
    LIST_MESSAGES: '/fc/message-list',
    MARK_MENTIONS_READ: '/fc/mark-mentions-as-read',
  },

  // Rate Limits
  RATE_LIMITS: {
    // Message limits
    MESSAGES_PER_DAY: 5000,
    MESSAGES_PER_CONVERSATION_PER_MINUTE: 30,
    MESSAGE_DELETIONS_PER_DAY: 1000,

    // Conversation limits
    NEW_CONVERSATIONS_PER_DAY: 5000,

    // Group limits
    CREATE_GROUP_PER_DAY: 10,
    MAX_ADMINS_PER_GROUP: 10,
    MAX_MEMBERS_PER_GROUP: 1000,
    GROUP_INVITES_PER_DAY: 100,
    GROUP_MEMBER_REMOVALS_PER_DAY: 100,
  },

  // Message settings
  MESSAGE: {
    MAX_LENGTH: 1024,
    SUPPORTED_TTL_DAYS: [1, 7, 30, 365] as const,
    DEFAULT_TTL_DAYS: 30,
  },

  // Group settings
  GROUP: {
    MAX_NAME_LENGTH: 32,
    MAX_DESCRIPTION_LENGTH: 128,
  },

  // Pagination
  PAGINATION: {
    DEFAULT_LIMIT: 25,
    MAX_LIMIT: 100,
  },

  // Categories
  CATEGORIES: {
    DEFAULT: 'default',
    REQUEST: 'request',
    ARCHIVED: 'archived',
  } as const,

  // Roles
  ROLES: {
    MEMBER: 'member',
    ADMIN: 'admin',
  } as const,

  // Auto-refresh interval (2 minutes)
  AUTO_REFRESH_INTERVAL: 2 * 60 * 1000,
} as const;

// Type exports
export type ConversationCategory = (typeof DIRECT_CAST_API.CATEGORIES)[keyof typeof DIRECT_CAST_API.CATEGORIES];
export type GroupRole = (typeof DIRECT_CAST_API.ROLES)[keyof typeof DIRECT_CAST_API.ROLES];
export type MessageTTLDays = (typeof DIRECT_CAST_API.MESSAGE.SUPPORTED_TTL_DAYS)[number];

// API Response Types
export interface DirectCastMessage {
  conversationId?: string;
  groupId?: string;
  messageId: string;
  senderFid: number;
  message: string;
  creationTimestamp: number;
  isDeleted: boolean;
  isProgrammatic: boolean;
  inReplyToMessageId?: string;
  mentions?: Array<{
    fid: number;
    textIndex: number;
    length: number;
  }>;
}

export interface DirectCastConversation {
  conversationId: string;
  participantFids: number[];
  settings: {
    messageTTLDays: MessageTTLDays;
  };
  creationTimestamp: number;
  lastModifiedTimestamp: number;
  lastMessage?: DirectCastMessage;
}

export interface DirectCastGroup {
  groupId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  inviteLinkUrl?: string;
  adminFids: number[];
  memberCount: number;
  settings: {
    messageTTLDays: MessageTTLDays;
    membersCanInvite: boolean;
  };
  creationTimestamp: number;
  lastModifiedTimestamp: number;
  lastMessage?: DirectCastMessage;
}

export interface DirectCastPaginatedResponse<T> {
  result: T;
  next?: {
    cursor: string;
  };
}

export interface DirectCastError {
  error: string;
  message?: string;
}
