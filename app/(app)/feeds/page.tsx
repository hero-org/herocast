'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AccountObjectType, CUSTOM_CHANNELS, hydrateAccounts, useAccountStore } from '@/stores/useAccountStore';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import { useRouter } from 'next/router';
import get from 'lodash.get';
import { ONE_MINUTE_IN_MS } from '@/common/constants/time';
import { CastRow } from '@/common/components/CastRow';
import isEmpty from 'lodash.isempty';
import { CastThreadView } from '@/common/components/CastThreadView';
import { SelectableListWithHotkeys } from '@/common/components/SelectableListWithHotkeys';
import { Key } from 'ts-key-enum';
import EmbedsModal from '@/common/components/EmbedsModal';
import { useInView } from 'react-intersection-observer';
import { Button } from '@/components/ui/button';
import { FilterType, NeynarAPIClient } from '@neynar/nodejs-sdk';
import { CastWithInteractions, FeedType } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { Loading } from '@/common/components/Loading';
import SkeletonCastRow from '@/common/components/SkeletonCastRow';
import uniqBy from 'lodash.uniqby';
import { useDataStore } from '@/stores/useDataStore';
import { CastModalView, useNavigationStore } from '@/stores/useNavigationStore';
import { HotkeyScopes } from '@/common/constants/hotkeys';

import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useDraftStore } from '@/stores/useDraftStore';
import { CreateAccountPage } from '@/common/components/CreateAccountPage';
import { AccountStatusType } from '@/common/constants/accounts';
import { createClient } from '@/common/helpers/supabase/component';
import includes from 'lodash.includes';
import { useListStore, isFidList } from '@/stores/useListStore';
import { searchService } from '@/services/searchService';
import { Interval } from '@/common/types/types';
import { SearchFilters } from '@/common/types/list.types';
import { orderBy } from 'lodash';
import { FidListContent, isFidListContent } from '@/common/types/list.types';
import { startTiming, endTiming } from '@/stores/usePerformanceStore';
import { useTrendingFeedInfinite, flattenTrendingFeedPages } from '@/hooks/queries/useTrendingFeed';
import { useFollowingFeedInfinite, flattenFollowingFeedPages } from '@/hooks/queries/useFollowingFeed';
import { useChannelFeedInfinite, flattenChannelFeedPages } from '@/hooks/queries/useChannelFeed';

type Feed = {
  casts: CastWithInteractions[];
  isLoading: boolean;
  nextCursor: string;
};

type FeedKeyToFeed = {
  [key: string]: Feed;
};

const EMPTY_FEED: Feed = {
  casts: [],
  isLoading: false,
  nextCursor: '',
};

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
const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);

const supabaseClient = createClient();

export default function Feeds() {
  const [feeds, setFeeds] = useState<FeedKeyToFeed>({});
  const [loadingMessage, setLoadingMessage] = useState('Loading feed');
  const [isRefreshingPage, setIsRefreshingPage] = useState(false);
  const [selectedCastIdx, setSelectedCastIdx] = useState(-1);
  const [showCastThreadView, setShowCastThreadView] = useState(false);
  const [showEmbedsModal, setShowEmbedsModal] = useState(false);
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

  const { selectedCast, updateSelectedCast, updateSelectedProfileFid } = useDataStore();
  const account: AccountObjectType = accounts[selectedAccountIdx];

  // React Query hooks for different feed types - provides automatic caching & deduplication
  const isTrendingFeed = selectedChannelUrl === CUSTOM_CHANNELS.TRENDING;
  const isFollowingFeed = selectedChannelUrl === CUSTOM_CHANNELS.FOLLOWING;
  const isChannelFeed = Boolean(selectedChannelUrl) && !isTrendingFeed && !isFollowingFeed;

  const trendingQuery = useTrendingFeedInfinite({
    limit: 10,
    enabled: isTrendingFeed && !selectedListId,
  });

  const followingQuery = useFollowingFeedInfinite(account?.platformAccountId || '', {
    limit: DEFAULT_FEED_PAGE_SIZE,
    enabled: isFollowingFeed && !selectedListId && !!account?.platformAccountId,
  });

  const channelQuery = useChannelFeedInfinite(
    selectedChannelUrl || '',
    account?.platformAccountId || '',
    {
      limit: DEFAULT_FEED_PAGE_SIZE,
      enabled: isChannelFeed && !selectedListId && !!account?.platformAccountId && !!selectedChannelUrl,
    }
  );

  // Handle URL query parameter for channel switching
  useEffect(() => {
    const { channel } = router.query;
    if (channel && typeof channel === 'string') {
      // Check if it's a valid custom channel
      if (channel === 'following' || channel === 'trending') {
        console.log(`📍 Switching to ${channel} channel from URL query`);
        setSelectedChannelUrl(channel);
      }
    }
  }, [router.query.channel, setSelectedChannelUrl]);

  useEffect(() => {
    // if navigating away, reset the selected cast and profile
    return () => {
      updateSelectedCast();
      updateSelectedProfileFid();
      setSelectedListId();
    };
  }, []);

  const updateFeed = (feedKey: string, key: keyof Feed, value: any) => {
    setFeeds((prev) => ({
      ...prev,
      [feedKey]: {
        ...get(prev, feedKey, EMPTY_FEED),
        [key]: value,
      },
    }));
  };

  const setIsLoadingFeed = (feedKey: string, isLoading: boolean) => {
    updateFeed(feedKey, 'isLoading', isLoading);
  };

  const setCastsForFeed = (feedKey: string, casts: CastWithInteractions[]) => {
    updateFeed(feedKey, 'casts', casts);
  };

  const setNextFeedCursor = (cursor: string) => {
    if (feedKey) {
      updateFeed(feedKey, 'nextCursor', cursor);
    }
  };

  const feedKey = getFeedKey({ selectedChannelUrl, account, selectedListId });
  const feed = feedKey ? get(feeds, feedKey, EMPTY_FEED) : EMPTY_FEED;

  // Determine which data source to use based on feed type
  const shouldUseReactQuery = !selectedListId && (isTrendingFeed || isFollowingFeed || isChannelFeed);

  // Extract data from appropriate React Query hook or local state
  let casts: CastWithInteractions[];
  let isLoadingFeed: boolean;
  let nextCursor: string;

  if (shouldUseReactQuery) {
    if (isTrendingFeed) {
      casts = flattenTrendingFeedPages(trendingQuery.data);
      isLoadingFeed = trendingQuery.isLoading;
      nextCursor = trendingQuery.hasNextPage ? 'has-more' : '';
    } else if (isFollowingFeed) {
      casts = flattenFollowingFeedPages(followingQuery.data);
      isLoadingFeed = followingQuery.isLoading;
      nextCursor = followingQuery.hasNextPage ? 'has-more' : '';
    } else {
      // Channel feed
      casts = flattenChannelFeedPages(channelQuery.data);
      isLoadingFeed = channelQuery.isLoading;
      nextCursor = channelQuery.hasNextPage ? 'has-more' : '';
    }
  } else {
    // List feeds use local state
    casts = feed.casts;
    isLoadingFeed = feed.isLoading;
    nextCursor = feed.nextCursor;
  }

  const onOpenLinkInCast = useCallback(() => {
    setShowEmbedsModal(true);
  }, []);

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
    const shouldUpdateLastReadTimestamp = !includes([CUSTOM_CHANNELS.TRENDING, CUSTOM_CHANNELS.FOLLOWING], feedKey);
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
      if (shouldUseReactQuery) {
        // For React Query feeds, use fetchNextPage
        if (isTrendingFeed && trendingQuery.hasNextPage && !trendingQuery.isFetchingNextPage) {
          trendingQuery.fetchNextPage();
        } else if (isFollowingFeed && followingQuery.hasNextPage && !followingQuery.isFetchingNextPage) {
          followingQuery.fetchNextPage();
        } else if (isChannelFeed && channelQuery.hasNextPage && !channelQuery.isFetchingNextPage) {
          channelQuery.fetchNextPage();
        }
      } else {
        // For list feeds, use the existing getFeed function
        getFeed({ fid: account.platformAccountId!, parentUrl: selectedChannelUrl, selectedListId, cursor: nextCursor });
      }
    }
  }, [inView, nextCursor, account, selectedChannelUrl, selectedListId, shouldUseReactQuery, isTrendingFeed, isFollowingFeed, isChannelFeed, trendingQuery, followingQuery, channelQuery]);

  const onReply = useCallback(() => {
    if (!selectedCast) return;

    setCastModalView(CastModalView.Reply);
    addNewPostDraft({
      parentCastId: {
        hash: new TextEncoder().encode(selectedCast.hash),
        fid: selectedCast.author.fid,
      },
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
          castId: {
            hash: new TextEncoder().encode(selectedCast.hash),
            fid: selectedCast.author.fid,
          },
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
      enabled: showCastThreadView && !isNewCastModalOpen && !showEmbedsModal,
    },
    [showCastThreadView, isNewCastModalOpen, showEmbedsModal, setShowCastThreadView]
  );

  const getFeedType = (parentUrl: string | undefined) =>
    parentUrl === CUSTOM_CHANNELS.FOLLOWING ? FeedType.Following : FeedType.Filter;

  const getFilterType = (parentUrl: string | undefined) => {
    if (parentUrl === CUSTOM_CHANNELS.FOLLOWING) return undefined;
    if (parentUrl === CUSTOM_CHANNELS.TRENDING) return FilterType.GlobalTrending;
    return FilterType.ParentUrl;
  };

  const getParentUrl = (parentUrl: string | undefined) =>
    parentUrl === CUSTOM_CHANNELS.FOLLOWING || parentUrl === CUSTOM_CHANNELS.TRENDING ? undefined : parentUrl;

  const refreshFeed = useCallback(() => {
    // For React Query feeds, use refetch
    if (shouldUseReactQuery) {
      if (isTrendingFeed) {
        trendingQuery.refetch();
      } else if (isFollowingFeed) {
        followingQuery.refetch();
      } else if (isChannelFeed) {
        channelQuery.refetch();
      }
      lastUpdateTimeRef.current = Date.now();
      return;
    }

    // For list feeds, use legacy getFeed
    if (account?.platformAccountId && !showCastThreadView && feedKey) {
      const fid = account.platformAccountId!;
      getFeed({ parentUrl: selectedChannelUrl, fid, selectedListId });
      lastUpdateTimeRef.current = Date.now();
    }
  }, [account, selectedChannelUrl, showCastThreadView, selectedListId, feedKey, shouldUseReactQuery, isTrendingFeed, isFollowingFeed, isChannelFeed, trendingQuery, followingQuery, channelQuery]);

  const getFeed = async ({
    fid,
    parentUrl,
    selectedListId,
    cursor,
  }: {
    fid: string;
    parentUrl?: string;
    selectedListId?: string;
    cursor?: string;
  }) => {
    if (isLoadingFeed || !feedKey) {
      return;
    }

    const timingId = startTiming(`feed-load-${cursor ? 'more' : 'initial'}`);
    setIsLoadingFeed(feedKey, true);
    try {
      let feedOptions = {
        cursor,
        limit: DEFAULT_FEED_PAGE_SIZE,
      };

      let newFeed;
      if (selectedListId) {
        const selectedList = lists.find((list) => list.id === selectedListId);
        if (!selectedList) {
          throw new Error('Selected list not found');
        }

        // Handle FID lists differently from search lists
        if (selectedList.type === 'fids') {
          const fidListContent = selectedList.contents as unknown as FidListContent;
          const listFids = fidListContent.fids || [];

          if (listFids.length === 0) {
            newFeed = { casts: [], next: undefined };
          } else {
            // Pass FIDs directly to avoid Supabase auth issues
            const fidsParam = listFids.join(',');
            const response = await fetch(
              `/api/lists?fids=${encodeURIComponent(fidsParam)}&viewerFid=${fid}&limit=${DEFAULT_FEED_PAGE_SIZE}${cursor ? `&cursor=${cursor}` : ''}`
            );
            if (!response.ok) {
              throw new Error('Failed to fetch feed from list');
            }

            const data = await response.json();
            newFeed = {
              casts: data.casts,
              next: data.next?.cursor ? { cursor: data.next.cursor } : undefined,
            };
          }
        } else {
          // Handle search lists as before
          const { term } = selectedList.contents as { term: string };
          let { filters } = selectedList.contents as { filters: SearchFilters };
          if (!filters) {
            filters = {
              onlyPowerBadge: false,
              hideReplies: true,
            };
          }
          filters.interval = cursor ? Interval.d14 : Interval.d7;
          filters.hideReplies = true;

          const searchResults = await searchService.searchWithCasts({
            searchTerm: term,
            filters,
            viewerFid: fid,
            limit: DEFAULT_FEED_PAGE_SIZE,
            offset: Number(cursor) || 0,
          });
          newFeed = searchResults;
        }
      } else if (parentUrl === CUSTOM_CHANNELS.FOLLOWING) {
        newFeed = await neynarClient.fetchUserFollowingFeed(Number(fid), feedOptions);
      } else if (parentUrl === CUSTOM_CHANNELS.TRENDING) {
        newFeed = await neynarClient.fetchTrendingFeed({
          ...feedOptions,
          limit: 10,
        });
      } else {
        feedOptions = {
          ...feedOptions,
          filterType: getFilterType(parentUrl),
          parentUrl: getParentUrl(parentUrl),
          fid: Number(fid),
        } as {
          cursor: string | undefined;
          limit: number;
          filterType: FilterType;
          parentUrl: string;
          fid: number;
        };

        newFeed = await neynarClient.fetchFeed(getFeedType(parentUrl), feedOptions);
        if (!newFeed?.casts || newFeed.casts.length === 0) {
          setLoadingMessage('Taking longer than expected, trying again...');
          newFeed = await neynarClient.fetchFeed(getFeedType(parentUrl), feedOptions);
        }
      }

      const allCasts = cursor ? uniqBy([...casts, ...newFeed.casts], 'hash') : newFeed.casts;
      const castsInFeed = orderBy(allCasts, (cast) => new Date(cast.timestamp), 'desc');
      setCastsForFeed(feedKey, castsInFeed);
      if (newFeed?.next?.cursor) {
        setNextFeedCursor(newFeed.next.cursor);
      } else {
        setNextFeedCursor('');
      }
    } catch (e) {
      console.error('Error fetching feed', e);
    } finally {
      setLoadingMessage('Loading feed');
      setIsLoadingFeed(feedKey, false);
      endTiming(timingId, cursor ? 1000 : 2000); // Different thresholds for initial vs pagination
    }
  };

  useEffect(() => {
    // Skip manual fetching for React Query feeds - they handle it automatically
    if (shouldUseReactQuery) {
      lastUpdateTimeRef.current = Date.now();
      return;
    }

    // For list feeds, use legacy getFeed
    if (account?.platformAccountId && !showCastThreadView && feedKey) {
      const fid = account.platformAccountId!;
      getFeed({ parentUrl: selectedChannelUrl, fid, selectedListId });
      lastUpdateTimeRef.current = Date.now();
    }
  }, [account, selectedChannelUrl, showCastThreadView, selectedListId, feedKey, shouldUseReactQuery]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;
        if (timeSinceLastUpdate >= ONE_MINUTE_IN_MS) {
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
        className="border-b border-foreground/20 relative w-full px-4"
        ref={isSentinel ? buttonRef : undefined}
      >
        <CastRow
          cast={item}
          isSelected={selectedCastIdx === idx}
          onSelect={() => onSelectCast(idx)}
          onEmbedClick={onOpenLinkInCast}
          showChannel={
            selectedChannelUrl === CUSTOM_CHANNELS.FOLLOWING || selectedChannelUrl === CUSTOM_CHANNELS.TRENDING
          }
        />
      </li>
    );
  };

  const getButtonText = (): string => {
    let isFetching: boolean;

    if (shouldUseReactQuery) {
      if (isTrendingFeed) {
        isFetching = trendingQuery.isFetchingNextPage || trendingQuery.isLoading;
      } else if (isFollowingFeed) {
        isFetching = followingQuery.isFetchingNextPage || followingQuery.isLoading;
      } else {
        isFetching = channelQuery.isFetchingNextPage || channelQuery.isLoading;
      }
    } else {
      isFetching = isLoadingFeed;
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
    if (shouldUseReactQuery) {
      // Use React Query for trending, following, and channel feeds
      if (isTrendingFeed && trendingQuery.hasNextPage && !trendingQuery.isFetchingNextPage) {
        trendingQuery.fetchNextPage();
      } else if (isFollowingFeed && followingQuery.hasNextPage && !followingQuery.isFetchingNextPage) {
        followingQuery.fetchNextPage();
      } else if (isChannelFeed && channelQuery.hasNextPage && !channelQuery.isFetchingNextPage) {
        channelQuery.fetchNextPage();
      }
    } else {
      // Use legacy fetch for list feeds
      getFeed({
        fid: account.platformAccountId!,
        parentUrl: selectedChannelUrl,
        selectedListId,
        cursor: nextCursor,
      });
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
      onExpand={onOpenLinkInCast}
      onSelect={onSelectCast}
      isActive={!(showCastThreadView || isNewCastModalOpen || showEmbedsModal)}
      pinnedNavigation={true}
      containerHeight="100%"
      scopes={[HotkeyScopes.GLOBAL, HotkeyScopes.FEED]}
      footer={!isEmpty(casts) ? renderLoadMoreButton() : null}
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

  const renderEmbedsModal = () => {
    return <EmbedsModal open={showEmbedsModal} setOpen={() => setShowEmbedsModal(false)} cast={selectedCast!} />;
  };

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

      if (selectedList.type === 'fids') {
        const fidListContent = selectedList.contents as FidListContent;
        return `FID List: ${selectedList.name} (${fidListContent.fids?.length || 0} accounts)`;
      } else {
        const { term } = selectedList.contents as { term: string };
        return `Search: "${term}"`;
      }
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
                  await getFeed({
                    fid: account.platformAccountId!,
                    parentUrl: selectedChannelUrl,
                    selectedListId,
                  });
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
      {renderEmbedsModal()}
    </main>
  );

  return renderContent();
}
