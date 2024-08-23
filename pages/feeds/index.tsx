import React, { useEffect, useState, useCallback } from 'react';
import { AccountObjectType, CUSTOM_CHANNELS, hydrateAccounts, useAccountStore } from '@/stores/useAccountStore';
import { useHotkeys } from 'react-hotkeys-hook';
import get from 'lodash.get';
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
import uniqBy from 'lodash.uniqby';
import { useDataStore } from '@/stores/useDataStore';
import { CastModalView, useNavigationStore } from '@/stores/useNavigationStore';

import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useDraftStore } from '@/stores/useDraftStore';
import CreateAccountPage from 'pages/welcome/new';
import { AccountStatusType } from '@/common/constants/accounts';
import { createClient } from '@/common/helpers/supabase/component';
import includes from 'lodash.includes';
import { useListStore } from '@/stores/useListStore';
import { getCastsFromSearch, Interval, SearchFilters } from '@/common/helpers/search';

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
  } else if (account) {
    return account.platformAccountId!;
  }
  throw new Error('No feed key found');
};

const DEFAULT_FEED_PAGE_SIZE = 15;
const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);

const supabaseClient = createClient();

export default function Feeds() {
  const [feeds, setFeeds] = useState<FeedKeyToFeed>({});
  const [loadingMessage, setLoadingMessage] = useState('Loading feed');
  const [isRefreshingPage, setIsRefreshingPage] = useState(false);
  const [selectedCastIdx, setSelectedCastIdx] = useState(-1);
  const [showCastThreadView, setShowCastThreadView] = useState(false);
  const [showEmbedsModal, setShowEmbedsModal] = useState(false);

  const { lists, selectedListId, setSelectedListId } = useListStore();
  const { isNewCastModalOpen, setCastModalView, openNewCastModal, closeNewCastModal, setCastModalDraftId } =
    useNavigationStore();
  const { addNewPostDraft } = useDraftStore();

  const { ref: buttonRef, inView } = useInView({
    threshold: 0,
    delay: 100,
  });
  const { accounts, selectedAccountIdx, selectedChannelUrl, isHydrated } = useAccountStore();

  const { selectedCast, updateSelectedCast } = useDataStore();
  const account: AccountObjectType = accounts[selectedAccountIdx];

  useEffect(() => {
    // if navigating away, reset the selected cast
    return () => {
      updateSelectedCast();
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
    updateFeed(feedKey, 'nextCursor', cursor);
  };

  const feedKey = getFeedKey({ selectedChannelUrl, account, selectedListId });
  const feed = feedKey ? get(feeds, feedKey, EMPTY_FEED) : EMPTY_FEED;
  const { isLoading: isLoadingFeed, nextCursor, casts } = feed;

  const onOpenLinkInCast = useCallback(() => {
    setShowEmbedsModal(true);
  }, []);

  const onSelectCast = useCallback((idx: number) => {
    setSelectedCastIdx(idx);
    setShowCastThreadView(true);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
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
    if (showCastThreadView) return;

    if (selectedCastIdx === 0) {
      window.scrollTo(0, 0);
    } else if (selectedCastIdx === casts.length - 1) {
      window.scrollTo(0, document.body.scrollHeight);
    }
  }, [selectedCastIdx, showCastThreadView, casts.length]);

  useEffect(() => {
    if (selectedCastIdx === -1) {
      updateSelectedCast();
    } else if (!isEmpty(casts)) {
      updateSelectedCast(casts[selectedCastIdx]);
    }
  }, [selectedCastIdx, selectedChannelUrl, casts, updateSelectedCast]);

  const onReply = useCallback(() => {
    if (!selectedCast) return;

    setCastModalView(CastModalView.Reply);
    addNewPostDraft({
      parentCastId: {
        hash: selectedCast.hash,
        fid: selectedCast.author.fid.toString(),
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
            hash: selectedCast.hash,
            fid: selectedCast.author.fid.toString(),
          },
        },
      ],
      onSuccess(draftId) {
        setCastModalDraftId(draftId);
        openNewCastModal();
      },
    });
  }, [selectedCast, setCastModalView, updateSelectedCast, addNewPostDraft, setCastModalDraftId, openNewCastModal]);

  useHotkeys(
    [Key.Escape, '§'],
    () => {
      setShowCastThreadView(false);
    },
    [showCastThreadView, isNewCastModalOpen, showEmbedsModal],
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
      enabled: showCastThreadView && !isNewCastModalOpen && !showEmbedsModal,
    }
  );

  useHotkeys('r', onReply, [openNewCastModal, selectedCast], {
    enabled: !isNewCastModalOpen,
    enableOnFormTags: false,
    preventDefault: true,
  });

  useHotkeys('q', onQuote, [openNewCastModal, selectedCast], {
    enabled: !isNewCastModalOpen,
    enableOnFormTags: false,
    preventDefault: true,
  });

  const getFeedType = (parentUrl: string | undefined) =>
    parentUrl === CUSTOM_CHANNELS.FOLLOWING ? FeedType.Following : FeedType.Filter;

  const getFilterType = (parentUrl: string | undefined) => {
    if (parentUrl === CUSTOM_CHANNELS.FOLLOWING) return undefined;
    if (parentUrl === CUSTOM_CHANNELS.TRENDING) return FilterType.GlobalTrending;
    return FilterType.ParentUrl;
  };

  const getParentUrl = (parentUrl: string | undefined) =>
    parentUrl === CUSTOM_CHANNELS.FOLLOWING || parentUrl === CUSTOM_CHANNELS.TRENDING ? undefined : parentUrl;

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
    if (isLoadingFeed) {
      return;
    }

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

        newFeed = await getCastsFromSearch({
          term,
          filters,
          viewerFid: fid,
          limit: DEFAULT_FEED_PAGE_SIZE,
          offset: Number(cursor) || 0,
        });
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

      const castsInFeed = uniqBy([...casts, ...newFeed.casts], 'hash');
      setCastsForFeed(feedKey, castsInFeed);
      if (newFeed?.next?.cursor) {
        setNextFeedCursor(newFeed.next.cursor);
      } else {
        setNextFeedCursor(castsInFeed.length.toString());
      }
    } catch (e) {
      console.error('Error fetching feed', e);
    } finally {
      setLoadingMessage('Loading feed');
      setIsLoadingFeed(feedKey, false);
    }
  };

  useEffect(() => {
    if (account?.platformAccountId && !showCastThreadView) {
      const fid = account.platformAccountId!;
      getFeed({ parentUrl: selectedChannelUrl, fid, selectedListId });
    }
  }, [account, selectedChannelUrl, showCastThreadView, selectedListId]);

  useEffect(() => {
    closeNewCastModal();
    setShowCastThreadView(false);
    setSelectedCastIdx(-1);
  }, [selectedChannelUrl, selectedListId]);

  const renderRow = (item: any, idx: number) => (
    <li key={item?.hash} className="border-b border-foreground/20 relative flex items-center space-x-4 max-w-full">
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

  const getButtonText = (): string => {
    if (isLoadingFeed) {
      return 'Loading...';
    } else if (casts.length === 0) {
      return 'Load feed';
    } else {
      return 'Load more';
    }
  };

  const renderLoadMoreButton = () => (
    <Button
      ref={buttonRef}
      onClick={() =>
        getFeed({
          fid: account.platformAccountId!,
          parentUrl: selectedChannelUrl,
          selectedListId,
          cursor: nextCursor,
        })
      }
      variant="outline"
      className="ml-4 my-4 "
    >
      {getButtonText()}
    </Button>
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
    return (
      casts.length === 0 &&
      isHydrated &&
      !isLoadingFeed && (
        <Card className="max-w-sm col-span-1 m-4">
          <CardHeader>
            <CardTitle>Feed is empty</CardTitle>
            <CardDescription>Seems like there is nothing to see here.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              className="w-1/2"
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
          </CardFooter>
        </Card>
      )
    );
  };

  const renderContent = () => (
    <main className="min-w-md md:min-w-[calc(100%-100px)] lg:min-w-[calc(100%-50px)]">
      {isLoadingFeed && isEmpty(casts) && (
        <div className="ml-4">
          <Loading loadingMessage={loadingMessage} />
        </div>
      )}
      {showCastThreadView ? (
        renderThread()
      ) : (
        <>
          {renderFeed()}
          {renderWelcomeMessage()}
          {!isEmpty(casts) && renderLoadMoreButton()}
        </>
      )}
      {renderEmbedsModal()}
    </main>
  );

  return renderContent();
}
