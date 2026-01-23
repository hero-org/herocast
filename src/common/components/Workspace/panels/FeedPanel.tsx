'use client';

import React, { useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useInView } from 'react-intersection-observer';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { useTrendingFeedInfinite, flattenTrendingFeedPages } from '@/hooks/queries/useTrendingFeed';
import { useFollowingFeedInfinite, flattenFollowingFeedPages } from '@/hooks/queries/useFollowingFeed';
import { useChannelFeedInfinite, flattenChannelFeedPages } from '@/hooks/queries/useChannelFeed';
import { useFidListFeedInfinite, flattenFidListFeedPages } from '@/hooks/queries/useFidListFeed';
import { useSearchListFeedInfinite, flattenSearchListFeedPages } from '@/hooks/queries/useSearchListFeed';
import { CastRow } from '@/common/components/CastRow';
import SkeletonCastRow from '@/common/components/SkeletonCastRow';
import { FeedPanelConfig } from '@/common/types/workspace.types';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ONE_MINUTE_IN_MS } from '@/common/constants/time';
import { useRouter } from 'next/navigation';
import isEmpty from 'lodash.isempty';
import { useAccountStore } from '@/stores/useAccountStore';
import { useListStore } from '@/stores/useListStore';
import { isFidListContent, isSearchListContent } from '@/common/types/list.types';

const DEFAULT_FEED_PAGE_SIZE = 10;
const PREFETCH_THRESHOLD = 3; // Load more when 3 items from end

export interface FeedPanelHandle {
  refresh: () => void;
}

interface FeedPanelProps {
  config: FeedPanelConfig;
  isCollapsed: boolean;
  panelId: string;
}

const FeedPanel = forwardRef<FeedPanelHandle, FeedPanelProps>(({ config, isCollapsed, panelId }, ref) => {
  const router = useRouter();
  const lastUpdateTimeRef = useRef(Date.now());
  const visibilityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Intersection observer for infinite scroll
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    delay: 100,
  });

  // Get viewer FID from account store
  const viewerFid = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.platformAccountId);

  // Get list store for list feeds
  const lists = useListStore((state) => state.lists);

  // Determine feed type flags
  const isTrendingFeed = config.feedType === 'trending';
  const isFollowingFeed = config.feedType === 'following';
  const isChannelFeed = config.feedType === 'channel';
  const isSearchListFeed = config.feedType === 'search-list';
  const isFidListFeed = config.feedType === 'fid-list';

  // Get list details for list feeds
  const selectedList = useMemo(() => {
    if (!config.listId) return undefined;
    return lists.find((l) => l.id === config.listId);
  }, [config.listId, lists]);

  // Extract list contents using type guards
  const fidListContent = useMemo(() => {
    if (isFidListFeed && selectedList?.contents && isFidListContent(selectedList.contents)) {
      return selectedList.contents;
    }
    return undefined;
  }, [isFidListFeed, selectedList]);

  const searchListContent = useMemo(() => {
    if (isSearchListFeed && selectedList?.contents && isSearchListContent(selectedList.contents)) {
      return selectedList.contents;
    }
    return undefined;
  }, [isSearchListFeed, selectedList]);

  // React Query hooks for different feed types - only enable the active one
  const trendingQuery = useTrendingFeedInfinite({
    limit: DEFAULT_FEED_PAGE_SIZE,
    enabled: isTrendingFeed && !isCollapsed,
  });

  const followingQuery = useFollowingFeedInfinite(viewerFid || '', {
    limit: DEFAULT_FEED_PAGE_SIZE,
    enabled: isFollowingFeed && !isCollapsed && !!viewerFid,
  });

  const channelQuery = useChannelFeedInfinite(config.channelUrl || '', viewerFid || '', {
    limit: DEFAULT_FEED_PAGE_SIZE,
    enabled: isChannelFeed && !isCollapsed && !!viewerFid && !!config.channelUrl,
  });

  const fidListQuery = useFidListFeedInfinite(
    config.listId || '',
    fidListContent?.fids?.map(String) || [],
    viewerFid || '',
    {
      limit: DEFAULT_FEED_PAGE_SIZE,
      enabled:
        isFidListFeed && !isCollapsed && !!viewerFid && !!config.listId && (fidListContent?.fids?.length ?? 0) > 0,
    }
  );

  const searchListQuery = useSearchListFeedInfinite(
    config.listId || '',
    searchListContent?.term || '',
    searchListContent?.filters,
    viewerFid || '',
    {
      limit: DEFAULT_FEED_PAGE_SIZE,
      enabled: isSearchListFeed && !isCollapsed && !!viewerFid && !!config.listId && !!searchListContent?.term,
    }
  );

  // Get active query based on feed type
  const activeQuery = useMemo(() => {
    if (isTrendingFeed) return trendingQuery;
    if (isFollowingFeed) return followingQuery;
    if (isChannelFeed) return channelQuery;
    if (isFidListFeed) return fidListQuery;
    if (isSearchListFeed) return searchListQuery;
    return trendingQuery; // Default fallback
  }, [
    isTrendingFeed,
    isFollowingFeed,
    isChannelFeed,
    isFidListFeed,
    isSearchListFeed,
    trendingQuery,
    followingQuery,
    channelQuery,
    fidListQuery,
    searchListQuery,
  ]);

  // Flatten paginated data based on feed type
  const casts = useMemo(() => {
    if (isTrendingFeed) return flattenTrendingFeedPages(trendingQuery.data);
    if (isFollowingFeed) return flattenFollowingFeedPages(followingQuery.data);
    if (isChannelFeed) return flattenChannelFeedPages(channelQuery.data);
    if (isFidListFeed) return flattenFidListFeedPages(fidListQuery.data);
    if (isSearchListFeed) return flattenSearchListFeedPages(searchListQuery.data);
    return [];
  }, [
    isTrendingFeed,
    isFollowingFeed,
    isChannelFeed,
    isFidListFeed,
    isSearchListFeed,
    trendingQuery.data,
    followingQuery.data,
    channelQuery.data,
    fidListQuery.data,
    searchListQuery.data,
  ]);

  const isLoading = activeQuery.isLoading;
  const hasNextPage = activeQuery.hasNextPage;
  const isFetchingNextPage = activeQuery.isFetchingNextPage;

  // Get stable function references to avoid re-render loops
  const refetch = activeQuery.refetch;
  const fetchNextPage = activeQuery.fetchNextPage;

  // Refresh feed function - uses active query refetch
  const refreshFeed = useCallback(() => {
    refetch();
    lastUpdateTimeRef.current = Date.now();
  }, [refetch]);

  // Expose refresh method to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      refresh: refreshFeed,
    }),
    [refreshFeed]
  );

  // Auto-load more when scrolling near end
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage && !isCollapsed) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, isCollapsed, fetchNextPage]);

  // Visibility-based refresh
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !isCollapsed) {
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

    // Initial timer for auto-refresh
    if (!isCollapsed) {
      visibilityTimerRef.current = setTimeout(refreshFeed, ONE_MINUTE_IN_MS);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
    };
  }, [refreshFeed, isCollapsed]);

  // Handle cast click - navigate to conversation
  const handleCastClick = useCallback(
    (cast: CastWithInteractions) => {
      router.push(`/conversation/${cast.hash}`);
    },
    [router]
  );

  // Render collapsed state
  if (isCollapsed) {
    return null;
  }

  // Render loading state
  if (isLoading && isEmpty(casts)) {
    return (
      <div className="flex flex-col min-h-0 h-full">
        <div className="flex-1 overflow-y-auto">
          {Array.from({ length: 5 }).map((_, idx) => (
            <SkeletonCastRow key={`skeleton-${panelId}-${idx}`} />
          ))}
        </div>
      </div>
    );
  }

  // Get empty state message based on feed type
  const getEmptyStateMessage = () => {
    // Check if user-specific feed requires a viewer FID
    if ((isFollowingFeed || isChannelFeed || isFidListFeed || isSearchListFeed) && !viewerFid) {
      return 'Select an account from the dropdown in the sidebar to view this feed.';
    }

    switch (config.feedType) {
      case 'following':
        return 'Your following feed is empty. Follow more accounts to see their casts here.';
      case 'channel':
        return config.channelName
          ? `No casts found in ${config.channelName}. Check back later.`
          : 'No casts found in this channel.';
      case 'search-list':
        return config.listName
          ? `No results found for "${config.listName}". Try adjusting your search.`
          : 'No search results found.';
      case 'fid-list':
        return config.listName
          ? `No casts found in "${config.listName}". The users in this list may not have posted recently.`
          : 'No casts found from the users in this list.';
      case 'trending':
      default:
        return 'The feed is empty. Click the refresh button or try again later.';
    }
  };

  // Get empty state title
  const getEmptyStateTitle = () => {
    if ((isFollowingFeed || isChannelFeed || isFidListFeed || isSearchListFeed) && !viewerFid) {
      return 'Account required';
    }
    return 'No casts found';
  };

  // Render empty state
  if (!isLoading && isEmpty(casts)) {
    return (
      <div className="flex flex-col min-h-0 h-full items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-base">{getEmptyStateTitle()}</CardTitle>
            <CardDescription>{getEmptyStateMessage()}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-full w-full overflow-hidden">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <ul className="divide-y divide-foreground/10">
          {casts.map((cast, idx) => {
            const isSentinel = idx === casts.length - PREFETCH_THRESHOLD;
            return (
              <li
                key={cast.hash}
                ref={isSentinel ? loadMoreRef : undefined}
                className="border-b border-foreground/20 relative w-full overflow-hidden"
              >
                <CastRow
                  cast={cast}
                  showChannel={isTrendingFeed || isFollowingFeed}
                  onSelect={() => handleCastClick(cast)}
                  onCastClick={() => handleCastClick(cast)}
                />
              </li>
            );
          })}
        </ul>

        {/* Loading indicator for pagination */}
        {isFetchingNextPage && (
          <div className="p-4">
            <SkeletonCastRow />
          </div>
        )}

        {/* End of feed indicator */}
        {!hasNextPage && casts.length > 0 && (
          <div className="p-4 text-center text-sm text-foreground/50">You have reached the end of the feed</div>
        )}
      </div>
    </div>
  );
});

FeedPanel.displayName = 'FeedPanel';

export default FeedPanel;
