'use client';

import type { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import isEmpty from 'lodash.isempty';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Key } from 'ts-key-enum';
import { CastRow } from '@/common/components/CastRow';
import { CastThreadView } from '@/common/components/CastThreadView';
import { CreateAccountPage } from '@/common/components/CreateAccountPage';
import { SelectableListWithHotkeys } from '@/common/components/SelectableListWithHotkeys';
import SkeletonCastRow from '@/common/components/SkeletonCastRow';
import { AccountStatusType } from '@/common/constants/accounts';
import { createEmbedCastId, createParentCastId } from '@/common/constants/farcaster';
import { HotkeyScopes } from '@/common/constants/hotkeys';
import { ONE_MINUTE_IN_MS } from '@/common/constants/time';
import { createClient } from '@/common/helpers/supabase/component';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import { isFidListContent, isSearchListContent } from '@/common/types/list.types';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { flattenChannelFeedPages, useChannelFeedInfinite } from '@/hooks/queries/useChannelFeed';
import { flattenFidListFeedPages, useFidListFeedInfinite } from '@/hooks/queries/useFidListFeed';
import { flattenFollowingFeedPages, useFollowingFeedInfinite } from '@/hooks/queries/useFollowingFeed';
import { flattenSearchListFeedPages, useSearchListFeedInfinite } from '@/hooks/queries/useSearchListFeed';
import { flattenTrendingFeedPages, useTrendingFeedInfinite } from '@/hooks/queries/useTrendingFeed';
import { type AccountObjectType, CUSTOM_CHANNELS, hydrateAccounts, useAccountStore } from '@/stores/useAccountStore';
import { useDataStore } from '@/stores/useDataStore';
import { useDraftStore } from '@/stores/useDraftStore';
import { useListStore } from '@/stores/useListStore';
import { CastModalView, useNavigationStore } from '@/stores/useNavigationStore';

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

const supabaseClient = createClient();

export default function Feeds() {
  const [isRefreshingPage, setIsRefreshingPage] = useState(false);
  const [selectedCastIdx, setSelectedCastIdx] = useState(-1);
  const [showCastThreadView, setShowCastThreadView] = useState(false);
  const lastUpdateTimeRef = useRef(Date.now());
  const visibilityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { lists, selectedListId, setSelectedListId } = useListStore();
  const { isNewCastModalOpen, setCastModalView, openNewCastModal, closeNewCastModal, setCastModalDraftId } =
    useNavigationStore();
  const { addNewPostDraft } = useDraftStore();

  const { ref: buttonRef, inView } = useInView({
    threshold: 0,
    delay: 100,
  });
  const { accounts, selectedAccountIdx, selectedChannelUrl, isHydrated, setSelectedChannelUrl } = useAccountStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { selectedCast, updateSelectedCast, updateSelectedProfileFid } = useDataStore();
  const account: AccountObjectType = accounts[selectedAccountIdx];

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
  let casts: CastWithInteractions[];
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

  const onSelectCast = useCallback((idx: number) => {
    setSelectedCastIdx(idx);
    setShowCastThreadView(true);
  }, []);

  useEffect(() => {
    // Scroll the main content container to top when feed changes
    const container = document.querySelector('.overflow-y-auto');
    if (container) {
      container.scrollTop = 0;
    }
  }, [feedKey]);

  useEffect(() => {
    const shouldUpdateLastReadTimestamp =
      feedKey !== null && ![CUSTOM_CHANNELS.TRENDING, CUSTOM_CHANNELS.FOLLOWING].includes(feedKey as CUSTOM_CHANNELS);
    if (shouldUpdateLastReadTimestamp && selectedChannelUrl && account && account?.channels?.length > 0) {
      const channelId = account.channels.find((channel) => channel.url === selectedChannelUrl)?.id;
      if (!channelId) return;

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

  // Escape handler to close thread view (only when no modal is open)
  useAppHotkeys(
    [Key.Escape, '§'],
    () => {
      setShowCastThreadView(false);
    },
    {
      scopes: [HotkeyScopes.FEED],
      enableOnFormTags: true,
      enableOnContentEditable: true,
      enabled: showCastThreadView && !isNewCastModalOpen,
    },
    [showCastThreadView, isNewCastModalOpen, setShowCastThreadView]
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
    setShowCastThreadView(false);
    setSelectedCastIdx(-1);
  }, [selectedChannelUrl, selectedListId]);

  const renderRow = (item: any, idx: number) => {
    // Attach sentinel ref to 5th-from-last item for auto-pagination
    const isSentinel = idx === casts.length - PREFETCH_THRESHOLD;

    return (
      <li
        key={item?.hash}
        className="border-b border-foreground/20 relative w-full pr-4"
        ref={isSentinel ? buttonRef : undefined}
      >
        <CastRow
          cast={item}
          isSelected={selectedCastIdx === idx}
          onSelect={() => onSelectCast(idx)}
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
      isActive={!(showCastThreadView || isNewCastModalOpen)}
      pinnedNavigation={true}
      containerHeight="100%"
      scopes={[HotkeyScopes.GLOBAL, HotkeyScopes.FEED]}
      footer={!isEmpty(casts) ? renderLoadMoreButton() : null}
      estimatedItemHeight={400}
    />
  );

  const renderThread = () => (
    <CastThreadView
      cast={casts[selectedCastIdx]}
      onBack={() => setShowCastThreadView(false)}
      onReply={onReply}
      onQuote={onQuote}
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
      )
    );
  };

  const renderContent = () => (
    <main className="w-full h-full">
      {isLoadingFeed && isEmpty(casts) && (
        <div className="w-full">
          {Array.from({ length: DEFAULT_FEED_PAGE_SIZE }).map((_, idx) => (
            <SkeletonCastRow key={`skeleton-${idx}`} />
          ))}
        </div>
      )}
      {showCastThreadView ? (
        renderThread()
      ) : (
        <div className="h-full w-full">
          {renderFeed()}
          {renderWelcomeMessage()}
        </div>
      )}
    </main>
  );

  return renderContent();
}
