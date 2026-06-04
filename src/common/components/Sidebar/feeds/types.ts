import type { LucideIcon } from 'lucide-react';

/**
 * Shared contract for the left-sidebar "feeds disclosure" — the collapsible
 * Channels / Lists groups that surface a user's pinned channels, saved
 * searches and user lists directly in the rail (Direction 01 "Disclosure").
 *
 * `useSidebarFeeds` (data + actions) produces these shapes; the row/section
 * components consume them. Keep this file dependency-light so both sides can
 * build against it independently.
 */

/** What kind of feed a sidebar row points at. */
export type SidebarFeedKind = 'custom' | 'channel' | 'search' | 'userlist';

/** The two collapsible groups in the disclosure. */
export type SidebarFeedGroup = 'channels' | 'lists';

/**
 * A single selectable feed in the sidebar (a custom feed, a pinned channel, a
 * saved search, or a user/FID list). Presentation-only — no store types leak
 * through here.
 */
export type SidebarFeed = {
  /**
   * Stable id, used for selection compare + React keys. Mirrors store identity:
   *  - custom            → CUSTOM_CHANNELS value ('following' | 'trending')
   *  - channel           → channel.url
   *  - search / userlist → list.id (uuid)
   */
  id: string;
  /** Display label (channel/list name, or 'Following' / 'Trending'). */
  name: string;
  kind: SidebarFeedKind;
  /** Leading icon for non-channel feeds. Channels use `iconUrl` or a violet # glyph. */
  icon?: LucideIcon;
  /** Channel avatar URL (channels only); falls back to the violet # glyph. */
  iconUrl?: string;
  /** Keyboard hint shown on the row, e.g. 'shift+0' (custom feeds only). */
  kbd?: string;
};

/** Return shape of `useSidebarFeeds`. */
export type SidebarFeedsModel = {
  /** Following + Trending — always shown, in this order. */
  customFeeds: SidebarFeed[];
  /** Pinned channels for the active account (store order preserved). */
  channels: SidebarFeed[];
  /** Saved searches + user (FID) lists. Excludes auto-interaction lists. */
  lists: SidebarFeed[];
  /** Id of the currently active feed (or null) for the selected-row highlight. */
  selectedId: string | null;
  /** True once the account + list stores have hydrated (for empty-state gating). */
  isHydrated: boolean;
  /**
   * Switch to a feed: updates the stores, routes to /feeds if needed, fires the
   * `switch-feed` perf interaction, and closes the mobile drawer (onNavigate).
   */
  selectFeed: (feed: SidebarFeed) => void;
};
