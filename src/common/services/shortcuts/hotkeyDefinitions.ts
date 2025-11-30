import { HotkeyScopes } from '@/common/constants/hotkeys';
import {
  MagnifyingGlassCircleIcon,
  UserCircleIcon,
  ChartBarIcon,
  HeartIcon,
  ArrowPathRoundedSquareIcon,
  ChatBubbleLeftIcon,
} from '@heroicons/react/20/solid';

export interface HotkeyDefinition {
  id: string;
  keys: string | string[];
  name: string;
  description?: string;
  category: string;
  scopes: string[];
  icon?: any;
  enableOnFormTags?: boolean;
  enableOnContentEditable?: boolean;
  preventDefault?: boolean;
}

export const hotkeyCategories = {
  navigation: 'Navigation',
  feed: 'Feed Navigation',
  actions: 'Actions',
  editor: 'Editor',
  account: 'Account',
};

export const hotkeyDefinitions: HotkeyDefinition[] = [
  // Navigation
  {
    id: 'command-palette',
    keys: 'meta+k',
    name: 'Open Command Palette',
    category: hotkeyCategories.navigation,
    scopes: [HotkeyScopes.GLOBAL],
    enableOnFormTags: true,
    preventDefault: true,
  },
  {
    id: 'switch-feeds',
    keys: 'shift+f',
    name: 'Switch to Feeds',
    category: hotkeyCategories.navigation,
    scopes: [HotkeyScopes.GLOBAL],
  },
  {
    id: 'switch-search',
    keys: '/',
    name: 'Switch to Search',
    category: hotkeyCategories.navigation,
    scopes: [HotkeyScopes.GLOBAL],
    preventDefault: true,
  },
  {
    id: 'switch-channels',
    keys: 'shift+c',
    name: 'Switch to Channels',
    category: hotkeyCategories.navigation,
    scopes: [HotkeyScopes.GLOBAL],
  },
  {
    id: 'notifications',
    keys: 'shift+n',
    name: 'Notifications',
    category: hotkeyCategories.navigation,
    scopes: [HotkeyScopes.GLOBAL],
  },
  {
    id: 'settings',
    keys: 'meta+shift+,',
    name: 'Settings',
    category: hotkeyCategories.navigation,
    scopes: [HotkeyScopes.GLOBAL],
  },
  {
    id: 'toggle-sidebar',
    keys: ['meta+b', 'ctrl+b'],
    name: 'Toggle Sidebar',
    description: 'Show or hide the sidebar',
    category: hotkeyCategories.navigation,
    scopes: [HotkeyScopes.GLOBAL],
    preventDefault: true,
  },
  {
    id: 'your-profile',
    keys: 'meta+shift+p',
    name: 'Your Profile',
    category: hotkeyCategories.navigation,
    scopes: [HotkeyScopes.GLOBAL],
    icon: UserCircleIcon,
  },

  // Feed Navigation
  {
    id: 'navigate-down',
    keys: ['j', 'ArrowDown'],
    name: 'Navigate Down',
    description: 'Move to next item',
    category: hotkeyCategories.feed,
    scopes: [HotkeyScopes.FEED, HotkeyScopes.SEARCH, HotkeyScopes.PROFILE, HotkeyScopes.CONVERSATION],
  },
  {
    id: 'navigate-up',
    keys: ['k', 'ArrowUp'],
    name: 'Navigate Up',
    description: 'Move to previous item',
    category: hotkeyCategories.feed,
    scopes: [HotkeyScopes.FEED, HotkeyScopes.SEARCH, HotkeyScopes.PROFILE, HotkeyScopes.CONVERSATION],
  },
  {
    id: 'select-item',
    keys: ['o', 'Enter'],
    name: 'Open Thread',
    description: 'Open selected cast',
    category: hotkeyCategories.feed,
    scopes: [HotkeyScopes.FEED, HotkeyScopes.SEARCH, HotkeyScopes.PROFILE],
  },
  {
    id: 'expand-item',
    keys: 'shift+o',
    name: 'Open Link',
    description: 'Open first link in cast',
    category: hotkeyCategories.feed,
    scopes: [HotkeyScopes.FEED, HotkeyScopes.SEARCH, HotkeyScopes.PROFILE],
  },

  // Cast Actions
  {
    id: 'like-cast',
    keys: 'l',
    name: 'Like Cast',
    description: 'Like selected cast',
    category: hotkeyCategories.actions,
    scopes: [HotkeyScopes.CAST_SELECTED],
    icon: HeartIcon,
  },
  {
    id: 'recast',
    keys: 'shift+r',
    name: 'Recast',
    description: 'Recast selected cast',
    category: hotkeyCategories.actions,
    scopes: [HotkeyScopes.CAST_SELECTED],
    icon: ArrowPathRoundedSquareIcon,
  },
  {
    id: 'reply',
    keys: 'r',
    name: 'Reply',
    description: 'Reply to selected cast',
    category: hotkeyCategories.actions,
    scopes: [HotkeyScopes.CAST_SELECTED],
    icon: ChatBubbleLeftIcon,
  },
  {
    id: 'quote',
    keys: 'q',
    name: 'Quote',
    description: 'Quote selected cast',
    category: hotkeyCategories.actions,
    scopes: [HotkeyScopes.CAST_SELECTED],
    icon: ArrowPathRoundedSquareIcon,
  },
  {
    id: 'manage-lists',
    keys: 'm',
    name: 'Manage Lists',
    description: 'Add/remove author from lists',
    category: hotkeyCategories.actions,
    scopes: [HotkeyScopes.CAST_SELECTED],
    icon: UserCircleIcon,
  },

  // Post Actions
  {
    id: 'new-post',
    keys: 'c',
    name: 'New Post',
    category: hotkeyCategories.actions,
    scopes: [HotkeyScopes.GLOBAL],
  },
  {
    id: 'submit-post',
    keys: 'meta+enter',
    name: 'Submit Post',
    category: hotkeyCategories.editor,
    scopes: [HotkeyScopes.EDITOR],
    enableOnFormTags: true,
    enableOnContentEditable: true,
  },
  {
    id: 'close-modal',
    keys: 'esc',
    name: 'Close Modal',
    category: hotkeyCategories.navigation,
    scopes: [HotkeyScopes.MODAL],
  },

  // Account Switching
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `switch-account-${i + 1}`,
    keys: `ctrl+${i + 1}`,
    name: `Switch to Account ${i + 1}`,
    category: hotkeyCategories.account,
    scopes: [HotkeyScopes.GLOBAL],
  })),
  {
    id: 'switch-follow-feed',
    keys: 'shift+0',
    name: 'Switch to Follow Feed',
    category: hotkeyCategories.feed,
    scopes: [HotkeyScopes.FEED],
  },
  {
    id: 'switch-trending-feed',
    keys: 'shift+1',
    name: 'Switch to Trending Feed',
    category: hotkeyCategories.feed,
    scopes: [HotkeyScopes.FEED],
  },

  // Sidebar Navigation - Sequential Keys
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `go-to-search-${i + 1}`,
    keys: `g>s>${i + 1}`,
    name: `Go to Search ${i + 1}`,
    description: `Navigate to search item ${i + 1}`,
    category: hotkeyCategories.navigation,
    scopes: [HotkeyScopes.FEED],
    enableOnFormTags: false,
  })),
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `go-to-list-${i + 1}`,
    keys: `g>l>${i + 1}`,
    name: `Go to List ${i + 1}`,
    description: `Navigate to list item ${i + 1}`,
    category: hotkeyCategories.navigation,
    scopes: [HotkeyScopes.FEED],
    enableOnFormTags: false,
  })),
];

// Helper to get hotkeys by scope
export function getHotkeysByScope(scope: string): HotkeyDefinition[] {
  return hotkeyDefinitions.filter((h) => h.scopes.includes(scope));
}

// Helper to get hotkeys by category
export function getHotkeysByCategory(category: string): HotkeyDefinition[] {
  return hotkeyDefinitions.filter((h) => h.category === category);
}
