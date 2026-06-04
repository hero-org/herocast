import { Home, Search, TrendingUp, Users } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { CUSTOM_CHANNELS, useAccountStore } from '@/stores/useAccountStore';
import { useListStore } from '@/stores/useListStore';
import { beginInteraction } from '@/stores/usePerformanceStore';
import type { SidebarFeed, SidebarFeedsModel } from './types';

/**
 * Following + Trending — static, never changes, so it lives at module scope to
 * keep the returned `customFeeds` array referentially stable across renders.
 */
const CUSTOM_FEEDS: SidebarFeed[] = [
  { id: CUSTOM_CHANNELS.FOLLOWING, name: 'Following', kind: 'custom', icon: Home, kbd: 'shift+0' },
  { id: CUSTOM_CHANNELS.TRENDING, name: 'Trending', kind: 'custom', icon: TrendingUp, kbd: 'shift+1' },
];

/**
 * Data + actions for the left-sidebar feeds disclosure (Direction 01). Aggregates
 * the active account's custom feeds, pinned channels and saved searches / user
 * lists into a presentation-only {@link SidebarFeedsModel}, and exposes a
 * `selectFeed` action that mirrors the canonical switch-feed semantics
 * (see `ChannelsOverview.onUpdateChannel` / `useGlobalHotkeys.navigateToList`).
 *
 * @param onNavigate Optional callback fired after a selection (e.g. close the
 *   mobile drawer).
 */
export function useSidebarFeeds(onNavigate?: () => void): SidebarFeedsModel {
  const accountChannels = useAccountStore((s) => s.accounts[s.selectedAccountIdx]?.channels);
  const selectedChannelUrl = useAccountStore((s) => s.selectedChannelUrl);
  const setSelectedChannelUrl = useAccountStore((s) => s.setSelectedChannelUrl);
  const accountIsHydrated = useAccountStore((s) => s.isHydrated);

  const lists = useListStore((s) => s.lists);
  const selectedListId = useListStore((s) => s.selectedListId);
  const setSelectedListId = useListStore((s) => s.setSelectedListId);
  const listIsHydrated = useListStore((s) => s.isHydrated);

  const router = useRouter();
  const pathname = usePathname();

  const channels = useMemo<SidebarFeed[]>(
    () =>
      (accountChannels ?? []).map((channel) => ({
        id: channel.url,
        name: channel.name,
        kind: 'channel',
        iconUrl: channel.icon_url,
      })),
    [accountChannels]
  );

  // Saved searches first, then user (FID) lists; auto-interaction lists excluded.
  const sidebarLists = useMemo<SidebarFeed[]>(() => {
    const searches = lists
      .filter((list) => list.type === 'search')
      .map<SidebarFeed>((list) => ({ id: list.id, name: list.name, kind: 'search', icon: Search }));
    const userLists = lists
      .filter((list) => list.type === 'fids')
      .map<SidebarFeed>((list) => ({ id: list.id, name: list.name, kind: 'userlist', icon: Users }));
    return [...searches, ...userLists];
  }, [lists]);

  // selectedListId wins; channels and custom feeds compare against selectedChannelUrl.
  const selectedId = selectedListId ?? selectedChannelUrl ?? null;

  const selectFeed = useCallback(
    (feed: SidebarFeed) => {
      const isChannelKind = feed.kind === 'custom' || feed.kind === 'channel';
      // Re-selecting the already-active feed must not re-stamp the perf
      // interaction (its content is already painted, so `endInteraction` would
      // never resolve and the next real switch would inherit a stale start).
      const isAlreadyActive = isChannelKind
        ? !selectedListId && selectedChannelUrl === feed.id
        : selectedListId === feed.id;

      if (!isAlreadyActive) {
        // Resolved when the new feed's content paints (feeds page content-ready effect)
        beginInteraction('switch-feed');
        if (isChannelKind) {
          setSelectedChannelUrl(feed.id);
          setSelectedListId(undefined);
        } else {
          setSelectedListId(feed.id);
          setSelectedChannelUrl(null);
        }
      }
      if (pathname !== '/feeds') {
        router.push('/feeds');
      }
      onNavigate?.();
    },
    [selectedChannelUrl, selectedListId, setSelectedChannelUrl, setSelectedListId, router, pathname, onNavigate]
  );

  return {
    customFeeds: CUSTOM_FEEDS,
    channels,
    lists: sidebarLists,
    selectedId,
    isHydrated: accountIsHydrated && listIsHydrated,
    selectFeed,
  };
}
