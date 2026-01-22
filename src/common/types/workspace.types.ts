/**
 * Panel types - extensible for future panel varieties
 */
export type PanelType = 'feed' | 'inbox';

/**
 * Feed panel configuration
 * Supports all feed variants
 */
export interface FeedPanelConfig {
  feedType: 'trending' | 'following' | 'channel' | 'search-list' | 'fid-list';
  channelUrl?: string; // For channel feeds - the parent_url
  channelName?: string; // For channel feeds - display name
  channelImageUrl?: string; // For channel feeds - icon
  listId?: string; // For list feeds
  listName?: string; // For list feeds - display name
}

/**
 * Inbox panel configuration
 * Each panel shows a single notification tab
 */
export interface InboxPanelConfig {
  tab: 'replies' | 'mentions' | 'likes' | 'recasts' | 'follows';
}

/**
 * Union type for all panel configurations
 */
export type PanelConfigUnion = FeedPanelConfig | InboxPanelConfig;

/**
 * Panel configuration - the core unit of workspace layout
 */
export interface PanelConfig {
  id: string; // UUID
  type: PanelType;
  config: PanelConfigUnion;
  collapsed: boolean;
}

/**
 * Workspace layout - persisted configuration for multi-panel view
 */
export interface WorkspaceLayout {
  panels: PanelConfig[];
  panelSizes: number[]; // Percentages, must sum to 100
  updatedAt: string; // ISO timestamp for sync conflict resolution
}

/**
 * User preferences - extensible container for user settings
 */
export interface UserPreferences {
  workspace?: WorkspaceLayout;
  // Future: sidebarState, notificationPrefs, etc.
}
