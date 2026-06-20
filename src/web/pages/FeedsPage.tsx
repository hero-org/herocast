import isEmpty from 'lodash.isempty';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Key } from 'ts-key-enum';
import { CompactCastRow } from '@/common/components/CastRow/CompactCastRow';
import { CreateAccountPage } from '@/common/components/CreateAccountPage';
import { NewCastsPill } from '@/common/components/Feed/NewCastsPill';
import { PreviewPane } from '@/common/components/Feed/PreviewPane';
import { SplitPaneShell } from '@/common/components/Feed/SplitPaneShell';
import RecommendedProfilesCard from '@/common/components/RecommendedProfilesCard';
import { SelectableListWithHotkeys } from '@/common/components/SelectableListWithHotkeys';
import SkeletonCastRow from '@/common/components/SkeletonCastRow';
import TrendingChannelsCard from '@/common/components/TrendingChannelsCard';
import { AccountStatusType } from '@/common/constants/accounts';
import { createEmbedCastId, createParentCastId } from '@/common/constants/farcaster';
import { HotkeyScopes } from '@/common/constants/hotkeys';
import { ONE_MINUTE_IN_MS } from '@/common/constants/time';
import { getSupabaseClient } from '@/common/helpers/supabase/component';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import { useMediaQuery } from '@/common/hooks/useMediaQuery';
import type { FarcasterCast } from '@/common/types/farcaster';
import { isFidListContent, isSearchListContent } from '@/common/types/list.types';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { flattenChannelFeedPages, useChannelFeedInfinite } from '@/hooks/queries/useChannelFeed';
import { flattenFidListFeedPages, useFidListFeedInfinite } from '@/hooks/queries/useFidListFeed';
import { flattenFollowingFeedPages, useFollowingFeedInfinite } from '@/hooks/queries/useFollowingFeed';
import { flattenSearchListFeedPages, useSearchListFeedInfinite } from '@/hooks/queries/useSearchListFeed';
import { flattenTrendingFeedPages, useTrendingFeedInfinite } from '@/hooks/queries/useTrendingFeed';
import { type AccountObjectType, CUSTOM_CHANNELS, hydrateAccounts, useAccountStore } from '@/stores/useAccountStore';
import { useDraftStore } from '@/stores/useDraftStore';
import { useListStore } from '@/stores/useListStore';
import { CastModalView, useNavigationStore } from '@/stores/useNavigationStore';
import { endInteraction, hasInAppNavigated, recordMetric } from '@/stores/usePerformanceStore';
import { useRouter, useSearchParams } from '@/web/lib/navigation';

const getFeedKey = ({
  selectedChannelUrl,
  account,
  selectedListId,
}: {
  selectedChannelUrl?: string;
  account: AccountObjectType;
  selectedListId?: string;
}) => {
  if (selectedListId) {
    return selectedListId;
  } else if (selectedChannelUrl) {
    return selectedChannelUrl;
  } else if (account?.platformAccountId) {
    return account.platformAccountId;
  }
  return null;
};

const DEFAULT_FEED_PAGE_SIZE = 15;
const PREFETCH_THRESHOLD = 5; // Auto-fetch when this many items from end come into view

// SSR-safety (unit #6): the live Next page creates the browser supabase client at MODULE
// SCOPE (`const supabaseClient = createClient()`), which THROWS on workerd when env is
// absent (forkability bar) → worker-init crash → /feeds 500s even for SSR. Defer to the
// `getSupabaseClient()` lazy seam, called inside the one effect that uses it. (conventions.md)
export default function Feeds() {
  const [isRefreshingPage, setIsRefreshingPage] = useState(false);
  const [selectedCastIdx, setSelectedCastIdx] = useState(-1);
  // Which split-pane region currently owns keyboard focus on desktop. Tab
  // toggles between list / preview; Shift+ArrowLeft/Right switch directly;
  // Esc returns to the list. State is meaningless below `lg` (no preview pane
  // mounts) and is reset to `false` by media-query changes / feed switches.
  const [previewFocused, setPreviewFocused] = useState(false);
  // The cast hash the user has "seen" as the top of the list. Drives the
  // "N new casts" pill: any casts above this hash count as new arrivals.
  // Reset on feed switch, advanced on pill click and on scroll-to-top.
  const [acknowledgedFirstHash, setAcknowledgedFirstHash] = useState<string | null>(null);
  const lastUpdateTimeRef = useRef(Date.now());
  const visibilityTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Wrapper for the list pane — used to scope the pill scroll-to-top click
  // handler. Kept separate from `listScrollContainerRef` because the wrapper
  // also hosts the pill itself.
  const listWrapperRef = useRef<HTMLDivElement>(null);
  // Direct handle on the SelectableListWithHotkeys scroll element so the
  // pill auto-acknowledge listener attaches to a known element instead of a
  // fragile `querySelector('.overflow-y-auto')` against internal markup.
  const listScrollContainerRef = useRef<HTMLDivElement | null>(null);

  const { lists, selectedListId, setSelectedListId } = useListStore();
  const {
    isNewCastModalOpen,
    setCastModalView,
    openNewCastModal,
    closeNewCastModal,
    setCastModalDraftId,
    selectedCast,
    updateSelectedCast,
    updateSelectedProfileFid,
  } = useNavigationStore();
  const { addNewPostDraft } = useDraftStore();

  const { ref: buttonRef, inView } = useInView({
    threshold: 0,
    delay: 100,
  });
  const { accounts, selectedAccountIdx, selectedChannelUrl, isHydrated, setSelectedChannelUrl } = useAccountStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const account: AccountObjectType = accounts[selectedAccountIdx];

  // Legacy ?castHash=0x... URLs are migrated to the /conversation/[hash]
  // route, which renders the full thread (parent + cast + replies) — same
  // surface that the rest of the app links to. Computed synchronously so
  // the redirect effect runs before any feed queries get a chance to
  // render content.
  const legacyCastHashParam = searchParams.get('castHash');
  const shouldRedirectLegacyCastHash = Boolean(legacyCastHashParam && legacyCastHashParam.startsWith('0x'));

  useEffect(() => {
    if (shouldRedirectLegacyCastHash && legacyCastHashParam) {
      router.replace(`/conversation/${encodeURIComponent(legacyCastHashParam)}`);
    }
  }, [shouldRedirectLegacyCastHash, legacyCastHashParam, router]);

  // React Query hooks for different feed types - provides automatic caching & deduplication
  const isTrendingFeed = selectedChannelUrl === CUSTOM_CHANNELS.TRENDING;
  const isFollowingFeed = selectedChannelUrl === CUSTOM_CHANNELS.FOLLOWING;
  const isChannelFeed = Boolean(selectedChannelUrl) && !isTrendingFeed && !isFollowingFeed;

  // Determine list type for list feeds
  const selectedList = selectedListId ? lists.find((l) => l.id === selectedListId) : undefined;
  const isFidListFeed = selectedList?.type === 'fids';
  const isSearchListFeed = selectedList?.type === 'search';

  // Extract list contents for hooks using type guards
  const fidListContent =
    isFidListFeed && selectedList?.contents && isFidListContent(selectedList.contents)
      ? selectedList.contents
      : undefined;
  const searchListContent =
    isSearchListFeed && selectedList?.contents && isSearchListContent(selectedList.contents)
      ? selectedList.contents
      : undefined;

  const trendingQuery = useTrendingFeedInfinite({
    limit: 10,
    enabled: isTrendingFeed && !selectedListId,
  });

  const followingQuery = useFollowingFeedInfinite(account?.platformAccountId || '', {
    limit: DEFAULT_FEED_PAGE_SIZE,
    enabled: isFollowingFeed && !selectedListId && !!account?.platformAccountId,
  });

  const channelQuery = useChannelFeedInfinite(selectedChannelUrl || '', account?.platformAccountId || '', {
    limit: DEFAULT_FEED_PAGE_SIZE,
    enabled: isChannelFeed && !selectedListId && !!account?.platformAccountId && !!selectedChannelUrl,
  });

  const fidListQuery = useFidListFeedInfinite(
    selectedListId || '',
    fidListContent?.fids?.map(String) || [],
    account?.platformAccountId || '',
    { limit: DEFAULT_FEED_PAGE_SIZE, enabled: isFidListFeed && !!selectedListId && !!account?.platformAccountId }
  );

  const searchListQuery = useSearchListFeedInfinite(
    selectedListId || '',
    searchListContent?.term || '',
    searchListContent?.filters,
    account?.platformAccountId || '',
    { limit: DEFAULT_FEED_PAGE_SIZE, enabled: isSearchListFeed && !!selectedListId && !!account?.platformAccountId }
  );

  // Handle URL query parameter for channel switching
  useEffect(() => {
    const channel = searchParams.get('channel');
    if (channel && typeof channel === 'string') {
      // Check if it's a valid custom channel
      if (channel === 'following' || channel === 'trending') {
        console.log(`📍 Switching to ${channel} channel from URL query`);
        setSelectedChannelUrl(channel);
      }
    }
  }, [searchParams, setSelectedChannelUrl]);

  useEffect(() => {
    // if navigating away, reset the selected cast and profile
    return () => {
      updateSelectedCast();
      updateSelectedProfileFid();
      setSelectedListId();
    };
  }, []);

  const feedKey = getFeedKey({ selectedChannelUrl, account, selectedListId });

  // Extract data from appropriate React Query hook - ALL feeds now use React Query
  let casts: FarcasterCast[];
  let isLoadingFeed: boolean;
  let nextCursor: string;

  if (isTrendingFeed) {
    casts = flattenTrendingFeedPages(trendingQuery.data);
    isLoadingFeed = trendingQuery.isLoading;
    nextCursor = trendingQuery.hasNextPage ? 'has-more' : '';
  } else if (isFollowingFeed) {
    casts = flattenFollowingFeedPages(followingQuery.data);
    isLoadingFeed = followingQuery.isLoading;
    nextCursor = followingQuery.hasNextPage ? 'has-more' : '';
  } else if (isFidListFeed) {
    casts = flattenFidListFeedPages(fidListQuery.data);
    isLoadingFeed = fidListQuery.isLoading;
    nextCursor = fidListQuery.hasNextPage ? 'has-more' : '';
  } else if (isSearchListFeed) {
    casts = flattenSearchListFeedPages(searchListQuery.data);
    isLoadingFeed = searchListQuery.isLoading;
    nextCursor = searchListQuery.hasNextPage ? 'has-more' : '';
  } else {
    // Channel feed
    casts = flattenChannelFeedPages(channelQuery.data);
    isLoadingFeed = channelQuery.isLoading;
    nextCursor = channelQuery.hasNextPage ? 'has-more' : '';
  }

  // Perceived latency: once the selected feed's content is actually painted (not just a
  // loading skeleton), resolve a pending feed switch and record cold start. Cold start is
  // only recorded when feeds is the initial landing route (no prior in-app navigation), so
  // `performance.now()` reflects time since page load and SPA navigations into /feeds don't
  // masquerade as cold starts.
  const coldStartRecordedRef = useRef(false);
  const feedContentReady = !isLoadingFeed && casts.length > 0;
  useEffect(() => {
    if (!feedContentReady) return;
    endInteraction('switch-feed', 200, { feedKey });
    if (!coldStartRecordedRef.current && !hasInAppNavigated()) {
      coldStartRecordedRef.current = true;
      recordMetric('inp:cold-start', performance.now(), 200, { feedKey });
    }
  }, [feedContentReady, feedKey]);

  // Compute the count of "new" casts above the user's last acknowledged top.
  // `acknowledgedFirstHash` is null on the very first render (no pill yet),
  // and is reset to null on feed switch. When the acknowledged hash is no
  // longer present in the array (e.g. a full server-side refresh that drops
  // the previous head), treat as 0 — the conservative path avoids surprising
  // the user with a giant "N new casts" count after the feed got nuked.
  let newCastsCount = 0;
  if (acknowledgedFirstHash !== null && casts.length > 0 && casts[0]?.hash !== acknowledgedFirstHash) {
    const idx = casts.findIndex((c) => c.hash === acknowledgedFirstHash);
    newCastsCount = idx === -1 ? 0 : idx;
  }

  // On desktop the preview pane already shows the selected cast, so click /
  // Enter / `o` should just update selection. Below the lg breakpoint there
  // is no preview pane, so navigate to /conversation/[hash] — full thread
  // view, same surface command palette / inbox / workspace use.
  const isDesktop = useMediaQuery('(min-width: 1024px)', { defaultValue: false });

  const onSelectCast = useCallback(
    (idx: number) => {
      setSelectedCastIdx(idx);
      if (!isDesktop) {
        const cast = casts[idx];
        if (cast?.hash) {
          router.push(`/conversation/${cast.hash}`);
        }
      }
    },
    [isDesktop, casts, router]
  );

  useEffect(() => {
    // Scroll the main content container to top when feed changes
    const container = document.querySelector('.overflow-y-auto');
    if (container) {
      container.scrollTop = 0;
    }
  }, [feedKey]);

  // Reset the acknowledged hash whenever the user switches feeds — the next
  // non-empty render will adopt the new feed's top hash so the pill never
  // flashes on switch. Runs synchronously alongside the scroll-to-top above.
  useEffect(() => {
    setAcknowledgedFirstHash(null);
  }, [feedKey]);

  // Hash of the current top cast. We depend on this string (not the `casts`
  // array reference, which is a fresh array on every render) so the effects
  // and click callback below are stable across unrelated re-renders. Only
  // refetch / feed-switch transitions should re-bind the scroll listener.
  const topHash = casts[0]?.hash;

  // Initialize / re-initialize the acknowledged hash on the first non-empty
  // render after a feed switch (or initial mount), and reset it whenever the
  // currently-acknowledged hash is no longer present in `casts`. The latter
  // guard handles transient empty refetches and server-side prunes — without
  // it, the count math (above) would silently fall back to 0 (idx === -1)
  // but the acknowledged hash would stay pointed at a phantom cast forever.
  useEffect(() => {
    if (!topHash) return;
    if (acknowledgedFirstHash === null) {
      setAcknowledgedFirstHash(topHash);
      return;
    }
    if (!casts.some((c) => c?.hash === acknowledgedFirstHash)) {
      setAcknowledgedFirstHash(topHash);
    }
  }, [acknowledgedFirstHash, topHash, casts]);

  // Auto-dismiss the pill when the list pane is already scrolled to the top:
  // if the user is staring at the top of the feed when new casts arrive,
  // there's no point pestering them with a pill.
  useEffect(() => {
    const scrollContainer = listScrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (scrollContainer.scrollTop <= 0) {
        if (topHash && acknowledgedFirstHash !== topHash) {
          setAcknowledgedFirstHash(topHash);
        }
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    // Run once on mount/effect-rerun so we auto-acknowledge if the user is
    // already at the top when new content arrives (no scroll event fires in
    // that case).
    handleScroll();

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [topHash, acknowledgedFirstHash]);

  const handlePillClick = useCallback(() => {
    if (topHash) {
      setAcknowledgedFirstHash(topHash);
    }
    // Selecting index 0 triggers SelectableListWithHotkeys' scroll-to-selected
    // effect. We still force scrollTop=0 below to cover the edge case where
    // selection was already 0 (effect won't re-run on identical value).
    setSelectedCastIdx(0);
    const scrollContainer = listScrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  }, [topHash]);

  useEffect(() => {
    const shouldUpdateLastReadTimestamp =
      feedKey !== null && ![CUSTOM_CHANNELS.TRENDING, CUSTOM_CHANNELS.FOLLOWING].includes(feedKey as CUSTOM_CHANNELS);
    if (shouldUpdateLastReadTimestamp && selectedChannelUrl && account && account?.channels?.length > 0) {
      const channelId = account.channels.find((channel) => channel.url === selectedChannelUrl)?.id;
      if (!channelId) return;

      const supabaseClient = getSupabaseClient();
      supabaseClient
        .from('accounts_to_channel')
        .update({
          last_read: new Date().toISOString(),
        })
        .eq('account_id', account.id)
        .eq('channel_id', channelId);
    }
  }, [account, selectedChannelUrl]);

  useEffect(() => {
    if (selectedCastIdx === -1) {
      updateSelectedCast();
      updateSelectedProfileFid();
    } else if (!isEmpty(casts)) {
      updateSelectedCast(casts[selectedCastIdx]);
      // Clear selectedProfileFid when selecting a cast (sidebar will use cast author)
      updateSelectedProfileFid();
    }
  }, [selectedCastIdx, selectedChannelUrl, casts, updateSelectedCast, updateSelectedProfileFid]);

  useEffect(() => {
    if (account && inView && nextCursor) {
      if (isTrendingFeed && trendingQuery.hasNextPage && !trendingQuery.isFetchingNextPage) {
        trendingQuery.fetchNextPage();
      } else if (isFollowingFeed && followingQuery.hasNextPage && !followingQuery.isFetchingNextPage) {
        followingQuery.fetchNextPage();
      } else if (isFidListFeed && fidListQuery.hasNextPage && !fidListQuery.isFetchingNextPage) {
        fidListQuery.fetchNextPage();
      } else if (isSearchListFeed && searchListQuery.hasNextPage && !searchListQuery.isFetchingNextPage) {
        searchListQuery.fetchNextPage();
      } else if (isChannelFeed && channelQuery.hasNextPage && !channelQuery.isFetchingNextPage) {
        channelQuery.fetchNextPage();
      }
    }
  }, [
    inView,
    nextCursor,
    account,
    isTrendingFeed,
    isFollowingFeed,
    isFidListFeed,
    isSearchListFeed,
    isChannelFeed,
    trendingQuery,
    followingQuery,
    fidListQuery,
    searchListQuery,
    channelQuery,
  ]);

  const onReply = useCallback(() => {
    if (!selectedCast) return;

    setCastModalView(CastModalView.Reply);
    addNewPostDraft({
      parentCastId: createParentCastId(selectedCast.author.fid, selectedCast.hash, 'feeds.onReply'),
      onSuccess(draftId) {
        setCastModalDraftId(draftId);
        openNewCastModal();
      },
    });
  }, [selectedCast, setCastModalView, addNewPostDraft, setCastModalDraftId, openNewCastModal]);

  const onQuote = useCallback(() => {
    if (!selectedCast) return;

    setCastModalView(CastModalView.Quote);
    updateSelectedCast(selectedCast);
    addNewPostDraft({
      embeds: [
        {
          // Store hash as string for JSON serialization - will be converted to bytes in prepareCastBody
          castId: createEmbedCastId(selectedCast.author.fid, selectedCast.hash, 'feeds.onQuote'),
        },
      ],
      onSuccess(draftId) {
        setCastModalDraftId(draftId);
        openNewCastModal();
      },
    });
  }, [selectedCast, setCastModalView, updateSelectedCast, addNewPostDraft, setCastModalDraftId, openNewCastModal]);

  // Split-pane focus toggling. These hotkeys are dual-gated: each is scoped to
  // the FEED scope (active on `/feeds`) AND uses `enabled` to stop firing in
  // states where the toggle would be meaningless (modal open, no preview pane
  // mounted, etc.). `preventDefault: true` is required for Tab and Shift+arrow
  // so the browser's native focus-cycling / scroll behavior doesn't fire
  // alongside the callback.
  const splitPaneHotkeysActive = isDesktop && !isNewCastModalOpen;

  useAppHotkeys(
    'Tab',
    () => {
      setPreviewFocused((prev) => !prev);
    },
    {
      scopes: [HotkeyScopes.FEED],
      enabled: splitPaneHotkeysActive,
      preventDefault: true,
    },
    [splitPaneHotkeysActive]
  );

  useAppHotkeys(
    'shift+ArrowRight',
    () => {
      setPreviewFocused(true);
    },
    {
      scopes: [HotkeyScopes.FEED],
      enabled: splitPaneHotkeysActive && !previewFocused,
      preventDefault: true,
    },
    [splitPaneHotkeysActive, previewFocused]
  );

  useAppHotkeys(
    'shift+ArrowLeft',
    () => {
      setPreviewFocused(false);
    },
    {
      scopes: [HotkeyScopes.FEED],
      enabled: splitPaneHotkeysActive && previewFocused,
      preventDefault: true,
    },
    [splitPaneHotkeysActive, previewFocused]
  );

  // Esc returns focus to the list when preview pane has focus.
  useAppHotkeys(
    Key.Escape,
    () => {
      setPreviewFocused(false);
    },
    {
      scopes: [HotkeyScopes.FEED],
      enabled: splitPaneHotkeysActive && previewFocused,
    },
    [splitPaneHotkeysActive, previewFocused]
  );

  const refreshFeed = useCallback(() => {
    // All feeds now use React Query refetch
    if (isTrendingFeed) {
      trendingQuery.refetch();
    } else if (isFollowingFeed) {
      followingQuery.refetch();
    } else if (isFidListFeed) {
      fidListQuery.refetch();
    } else if (isSearchListFeed) {
      searchListQuery.refetch();
    } else if (isChannelFeed) {
      channelQuery.refetch();
    }
    lastUpdateTimeRef.current = Date.now();
  }, [
    isTrendingFeed,
    isFollowingFeed,
    isFidListFeed,
    isSearchListFeed,
    isChannelFeed,
    trendingQuery,
    followingQuery,
    fidListQuery,
    searchListQuery,
    channelQuery,
  ]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;
        if (timeSinceLastUpdate >= ONE_MINUTE_IN_MS) {
          if (process.env.NODE_ENV === 'development') {
            console.log(
              '[Feed] Visibility change: refreshing feed after',
              Math.round(timeSinceLastUpdate / 1000),
              'seconds'
            );
          }
          refreshFeed();
        } else {
          if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
          visibilityTimerRef.current = setTimeout(refreshFeed, ONE_MINUTE_IN_MS - timeSinceLastUpdate);
        }
      } else {
        if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    visibilityTimerRef.current = setTimeout(refreshFeed, ONE_MINUTE_IN_MS);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
    };
  }, [refreshFeed]);

  useEffect(() => {
    closeNewCastModal();
    setSelectedCastIdx(-1);
    setPreviewFocused(false);
  }, [selectedChannelUrl, selectedListId]);

  // Reset preview focus if the user shrinks below the lg breakpoint — there is
  // no preview pane mounted in mobile mode, so leaving `previewFocused: true`
  // would silently disable list j/k navigation.
  useEffect(() => {
    if (!isDesktop && previewFocused) {
      setPreviewFocused(false);
    }
  }, [isDesktop, previewFocused]);

  const renderRow = (item: any, idx: number) => {
    // Attach sentinel ref to 5th-from-last item for auto-pagination
    const isSentinel = idx === casts.length - PREFETCH_THRESHOLD;

    return (
      <li key={item?.hash} className="border-b border-border relative w-full" ref={isSentinel ? buttonRef : undefined}>
        <CompactCastRow
          cast={item}
          idx={idx}
          isSelected={selectedCastIdx === idx}
          onSelect={onSelectCast}
          showChannel={
            selectedChannelUrl === CUSTOM_CHANNELS.FOLLOWING || selectedChannelUrl === CUSTOM_CHANNELS.TRENDING
          }
        />
      </li>
    );
  };

  const getButtonText = (): string => {
    let isFetching: boolean;

    if (isTrendingFeed) {
      isFetching = trendingQuery.isFetchingNextPage || trendingQuery.isLoading;
    } else if (isFollowingFeed) {
      isFetching = followingQuery.isFetchingNextPage || followingQuery.isLoading;
    } else if (isFidListFeed) {
      isFetching = fidListQuery.isFetchingNextPage || fidListQuery.isLoading;
    } else if (isSearchListFeed) {
      isFetching = searchListQuery.isFetchingNextPage || searchListQuery.isLoading;
    } else {
      isFetching = channelQuery.isFetchingNextPage || channelQuery.isLoading;
    }

    if (isFetching) {
      return 'Loading...';
    } else if (casts.length === 0) {
      return 'Load feed';
    } else {
      return 'Load more';
    }
  };

  const handleLoadMore = () => {
    if (isTrendingFeed && trendingQuery.hasNextPage && !trendingQuery.isFetchingNextPage) {
      trendingQuery.fetchNextPage();
    } else if (isFollowingFeed && followingQuery.hasNextPage && !followingQuery.isFetchingNextPage) {
      followingQuery.fetchNextPage();
    } else if (isFidListFeed && fidListQuery.hasNextPage && !fidListQuery.isFetchingNextPage) {
      fidListQuery.fetchNextPage();
    } else if (isSearchListFeed && searchListQuery.hasNextPage && !searchListQuery.isFetchingNextPage) {
      searchListQuery.fetchNextPage();
    } else if (isChannelFeed && channelQuery.hasNextPage && !channelQuery.isFetchingNextPage) {
      channelQuery.fetchNextPage();
    }
  };

  const renderLoadMoreButton = () => (
    <div className="px-4 py-4">
      <Button ref={buttonRef} onClick={handleLoadMore} variant="outline">
        {getButtonText()}
      </Button>
    </div>
  );

  const renderFeed = () => (
    <SelectableListWithHotkeys
      data={casts}
      selectedIdx={selectedCastIdx}
      setSelectedIdx={setSelectedCastIdx}
      renderRow={(item: any, idx: number) => renderRow(item, idx)}
      onSelect={onSelectCast}
      // When preview-focus is active the list's j/k must NOT move selection —
      // the user is scrolling the preview pane (browser default) instead.
      isActive={!isNewCastModalOpen && !previewFocused}
      pinnedNavigation={true}
      containerHeight="100%"
      scopes={[HotkeyScopes.GLOBAL, HotkeyScopes.FEED]}
      footer={!isEmpty(casts) ? renderLoadMoreButton() : null}
      estimatedItemHeight={88}
      // Suppress the virtualizer's auto-scroll-to-top on feed refresh: the
      // NewCastsPill flow owns scrolling so the user keeps their place.
      disableAutoScrollOnFirstItemChange={true}
      // Get a stable handle on the scroll element so the pill auto-acknowledge
      // listener doesn't have to query DOM by class name.
      scrollContainerRef={listScrollContainerRef}
    />
  );

  const renderWelcomeMessage = () => {
    if (
      isHydrated &&
      !isLoadingFeed &&
      accounts.filter((acc) => acc.status === AccountStatusType.active).length === 0
    ) {
      return <CreateAccountPage />;
    }

    // Get list details if we're viewing a list
    const getListDetails = () => {
      if (!selectedListId) return null;

      const selectedList = lists.find((list) => list.id === selectedListId);
      if (!selectedList) return null;

      if (selectedList.type === 'fids' && isFidListContent(selectedList.contents)) {
        return `FID List: ${selectedList.name} (${selectedList.contents.fids?.length || 0} accounts)`;
      } else if (selectedList.type === 'search' && isSearchListContent(selectedList.contents)) {
        return `Search: "${selectedList.contents.term}"`;
      }
      return null;
    };

    const listDetails = getListDetails();

    return (
      casts.length === 0 &&
      isHydrated &&
      !isLoadingFeed && (
        <div className="w-full">
          <div className="w-full flex justify-center pt-12">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>Feed is empty</CardTitle>
                <CardDescription>
                  {listDetails ? `No results found for ${listDetails}` : 'Seems like there is nothing to see here.'}
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={isRefreshingPage}
                  onClick={async () => {
                    setIsRefreshingPage(true);
                    await hydrateAccounts();
                    refreshFeed();
                    setIsRefreshingPage(false);
                  }}
                >
                  Refresh
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => {
                    // Navigate to trending feed
                    useAccountStore.setState({ selectedChannelUrl: CUSTOM_CHANNELS.TRENDING });
                    setSelectedListId(undefined);
                  }}
                >
                  Go to Trending
                </Button>
              </CardFooter>
            </Card>
          </div>
          {/* Discovery prompts ("Follow more profiles…", trending channels) are onboarding
              guidance for the home/following feed — a thin following graph is why it's empty.
              On a specific channel, list, or search, an empty result means that source has no
              casts (or isn't indexed), not that the user follows too few people, so suppress
              them there to avoid the off-context "Follow more profiles" prompt. */}
          {isFollowingFeed && (
            <>
              <TrendingChannelsCard />
              <RecommendedProfilesCard />
            </>
          )}
        </div>
      )
    );
  };

  const previewCast = selectedCastIdx >= 0 ? casts[selectedCastIdx] : null;

  const renderContent = () => (
    <main className="w-full h-full">
      {isLoadingFeed && isEmpty(casts) && (
        <div className="w-full">
          {Array.from({ length: DEFAULT_FEED_PAGE_SIZE }).map((_, idx) => (
            <SkeletonCastRow key={`skeleton-${idx}`} />
          ))}
        </div>
      )}
      <SplitPaneShell
        list={
          // `relative` is required so NewCastsPill (absolute-positioned) anchors
          // to this wrapper rather than escaping to some ancestor. The ref lets
          // effects scope querySelector('.overflow-y-auto') to just the list.
          <div className="relative h-full w-full" ref={listWrapperRef}>
            <NewCastsPill count={newCastsCount} onClick={handlePillClick} />
            {renderFeed()}
            {renderWelcomeMessage()}
          </div>
        }
        preview={<PreviewPane cast={previewCast} previewFocused={previewFocused} />}
        listFocused={isDesktop && !previewFocused}
        previewFocused={isDesktop && previewFocused}
      />
    </main>
  );

  // While redirecting away to /conversation/[hash], render an empty
  // placeholder so the feed never flashes during the transition.
  if (shouldRedirectLegacyCastHash) {
    return <main className="w-full h-full" data-testid="feeds-redirecting-to-conversation" />;
  }

  return renderContent();
}
