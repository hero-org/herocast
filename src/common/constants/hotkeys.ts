// Hotkey scope constants for react-hotkeys-hook
export const HotkeyScopes = {
  // Always active
  GLOBAL: 'global',

  // Page-specific scopes
  FEED: 'feed',
  SEARCH: 'search',
  PROFILE: 'profile',
  CONVERSATION: 'conversation',
  SETTINGS: 'settings',
  ANALYTICS: 'analytics',
  INBOX: 'inbox',
  DMS: 'dms',

  // Component-specific scopes
  EDITOR: 'editor',
  MODAL: 'modal',
  COMMAND_PALETTE: 'command-palette',

  // State-specific scopes
  CAST_SELECTED: 'cast-selected',
} as const;

export type HotkeyScope = (typeof HotkeyScopes)[keyof typeof HotkeyScopes];

// Scope configurations for different pages
export const PageScopes: Record<string, HotkeyScope[]> = {
  feeds: [HotkeyScopes.GLOBAL, HotkeyScopes.FEED],
  search: [HotkeyScopes.GLOBAL, HotkeyScopes.SEARCH],
  profile: [HotkeyScopes.GLOBAL, HotkeyScopes.PROFILE],
  conversation: [HotkeyScopes.GLOBAL, HotkeyScopes.CONVERSATION],
  settings: [HotkeyScopes.GLOBAL, HotkeyScopes.SETTINGS],
  analytics: [HotkeyScopes.GLOBAL, HotkeyScopes.ANALYTICS],
  post: [HotkeyScopes.GLOBAL, HotkeyScopes.EDITOR],
  inbox: [HotkeyScopes.GLOBAL, HotkeyScopes.INBOX],
  dms: [HotkeyScopes.GLOBAL, HotkeyScopes.DMS],
};

// Helper to get scopes for current page
export function getScopesForPage(pathname: string): HotkeyScope[] {
  const page = pathname.split('/')[1] || 'feeds';
  return PageScopes[page] || [HotkeyScopes.GLOBAL];
}
