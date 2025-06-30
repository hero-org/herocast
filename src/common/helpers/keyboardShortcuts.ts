import { formatKey } from '@/components/ui/keyboard-shortcut';

/**
 * Formats a keyboard shortcut string for display
 * Converts shortcut strings like "meta+k" to formatted arrays like ["⌘", "K"]
 */
export function formatShortcutKeys(shortcut: string): string[] {
  const platform =
    typeof window !== 'undefined' ? (navigator.platform.toLowerCase().includes('mac') ? 'mac' : 'other') : 'other';

  return shortcut.split('+').map((key) => formatKey(key.trim(), platform));
}

/**
 * Common keyboard shortcuts used throughout the app
 * Centralized for consistency and easy updates
 */
export const APP_SHORTCUTS = {
  // Global navigation
  COMMAND_PALETTE: 'meta+k',
  SEARCH: '/',
  NEW_CAST: 'c',

  // Navigation
  GO_TO_FEEDS: 'shift+f',
  GO_TO_CHANNELS: 'shift+c',
  GO_TO_NOTIFICATIONS: 'shift+n',
  GO_TO_PROFILE: 'meta+shift+p',
  GO_TO_ANALYTICS: 'meta+shift+a',
  GO_TO_SETTINGS: 'meta+shift+,',

  // Cast actions (when selected)
  REPLY: 'r',
  LIKE: 'l',
  RECAST: 'shift+r',

  // Account switching
  SWITCH_ACCOUNT: (index: number) => `ctrl+${index + 1}`,

  // Feed switching
  SWITCH_TO_FOLLOWING: 'shift+0',
  SWITCH_TO_TRENDING: 'shift+1',

  // Theme
  LIGHT_MODE: 'meta+shift+l',
  DARK_MODE: 'meta+shift+d',

  // Modal actions
  CLOSE: 'esc',
  SUBMIT: 'meta+enter',
} as const;

/**
 * Get a formatted shortcut display for tooltips
 */
export function getShortcutTooltip(shortcut: string, description?: string): string {
  const keys = formatShortcutKeys(shortcut);
  const keysDisplay = keys.join(' ');
  return description ? `${description} (${keysDisplay})` : keysDisplay;
}
