import React, { useEffect, useState } from "react";
import {
  AccountObjectType,
  CUSTOM_CHANNELS,
  hydrate,
  useAccountStore,
} from "@/stores/useAccountStore";
import { useHotkeys } from "react-hotkeys-hook";
import get from "lodash.get";
import { CastRow } from "@/common/components/CastRow";
import isEmpty from "lodash.isempty";
import { CastThreadView } from "@/common/components/CastThreadView";
import { SelectableListWithHotkeys } from "@/common/components/SelectableListWithHotkeys";
import { Key } from "ts-key-enum";
import NewCastModal from "@/common/components/NewCastModal";
import EmbedsModal from "@/common/components/EmbedsModal";
import { useInView } from "react-intersection-observer";
import { Button } from "@/components/ui/button";
import { FilterType, NeynarAPIClient } from "@neynar/nodejs-sdk";
import {
  CastWithInteractions,
  FeedType,
} from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { Loading } from "@/common/components/Loading";
import uniqBy from "lodash.uniqby";
import { useDataStore } from "@/stores/useDataStore";
import { CastModalView, useNavigationStore } from "@/stores/useNavigationStore";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  nextCursor: "",
};

const getFeedKey = ({
  selectedChannelUrl,
  account,
}: {
  selectedChannelUrl?: string;
  account: AccountObjectType;
}) => {
  if (selectedChannelUrl) {
    return selectedChannelUrl;
  } else if (account) {
    return account.platformAccountId!;
  }
  throw new Error("No feed key found");
};

const DEFAULT_FEED_PAGE_SIZE = 15;
const neynarClient = new NeynarAPIClient(
  process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
);

export default function Feeds() {
  const [feeds, setFeeds] = useState<FeedKeyToFeed>({});
  const [loadingMessage, setLoadingMessage] = useState("Loading feed");
  const [isRefreshingPage, setIsRefreshingPage] = useState(false);
  const [selectedCastIdx, setSelectedCastIdx] = useState(-1);
  const [showCastThreadView, setShowCastThreadView] = useState(false);
  const [showEmbedsModal, setShowEmbedsModal] = useState(false);
  const {
    isNewCastModalOpen,
    setCastModalView,
    openNewCastModal,
    closeNewCastModal,
  } = useNavigationStore();

  const { ref: buttonRef, inView } = useInView({
    threshold: 0,
    delay: 100,
  });
  const { accounts, selectedAccountIdx, selectedChannelUrl, hydratedAt } =
    useAccountStore();

  const { selectedCast, updateSelectedCast } = useDataStore();
  const account: AccountObjectType = accounts[selectedAccountIdx];

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
    updateFeed(feedKey, "isLoading", isLoading);
  };

  const setCastsForFeed = (feedKey: string, casts: CastWithInteractions[]) => {
    updateFeed(feedKey, "casts", casts);
  };

  const setNextFeedCursor = (cursor: string) => {
    updateFeed(
      getFeedKey({ selectedChannelUrl, account }),
      "nextCursor",
      cursor
    );
  };

  const feedKey = getFeedKey({ selectedChannelUrl, account });
  const feed = feedKey ? get(feeds, feedKey, EMPTY_FEED) : EMPTY_FEED;
  const { isLoading: isLoadingFeed, nextCursor, casts } = feed;

  const onOpenLinkInCast = (idx: number) => {
    setShowEmbedsModal(true);
  };

  const onSelectCast = (idx: number) => {
    setSelectedCastIdx(idx);
    setShowCastThreadView(true);
  };

  useEffect(() => {
    if (showCastThreadView) return;

    if (selectedCastIdx === 0) {
      window.scrollTo(0, 0);
    } else if (selectedCastIdx === casts.length - 1) {
      window.scrollTo(0, document.body.scrollHeight);
    }
  }, [selectedCastIdx, showCastThreadView]);

  useEffect(() => {
    if (selectedCastIdx === -1 || isEmpty(casts)) return;

    updateSelectedCast(casts[selectedCastIdx]);
  }, [selectedCastIdx, selectedChannelUrl, casts]);

  useEffect(() => {
    if (
      isLoadingFeed ||
      isEmpty(feed) ||
      showCastThreadView ||
      casts.length < DEFAULT_FEED_PAGE_SIZE ||
      !account?.platformAccountId ||
      !inView
    )
      return;

    getFeed({
      fid: account.platformAccountId!,
      parentUrl: selectedChannelUrl,
      cursor: nextCursor,
    });
  }, [
    selectedCastIdx,
    feed,
    feedKey,
    account,
    selectedChannelUrl,
    inView,
    isLoadingFeed,
  ]);

  const onReply = () => {
    setCastModalView(CastModalView.Reply);
    openNewCastModal();
  };

  const onQuote = () => {
    setCastModalView(CastModalView.Quote);
    openNewCastModal();
  };

  useHotkeys(
    [Key.Escape, "§"],
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

  useHotkeys("r", onReply, [openNewCastModal], {
    enabled: !isNewCastModalOpen,
    enableOnFormTags: false,
    preventDefault: true,
  });

  useHotkeys("q", onQuote, [openNewCastModal], {
    enabled: !isNewCastModalOpen,
    enableOnFormTags: false,
    preventDefault: true,
  });

  const getFeedType = (parentUrl: string | undefined) =>
    parentUrl === CUSTOM_CHANNELS.FOLLOWING
      ? FeedType.Following
      : FeedType.Filter;

  const getFilterType = (parentUrl: string | undefined) => {
    if (parentUrl === CUSTOM_CHANNELS.FOLLOWING) return undefined;
    if (parentUrl === CUSTOM_CHANNELS.TRENDING)
      return FilterType.GlobalTrending;
    return FilterType.ParentUrl;
  };

  const getParentUrl = (parentUrl: string | undefined) =>
    parentUrl === CUSTOM_CHANNELS.FOLLOWING ||
    parentUrl === CUSTOM_CHANNELS.TRENDING
      ? undefined
      : parentUrl;

  const getFeed = async ({
    fid,
    parentUrl,
    cursor,
  }: {
    fid: string;
    parentUrl?: string;
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
      if (parentUrl === CUSTOM_CHANNELS.FOLLOWING) {
        newFeed = await neynarClient.fetchUserFollowingFeed(
          Number(fid),
          feedOptions
        );
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
        newFeed = await neynarClient.fetchFeed(
          getFeedType(parentUrl),
          feedOptions
        );
        if (!newFeed?.casts || newFeed.casts.length === 0) {
          setLoadingMessage("Taking longer than expected, trying again...");
          newFeed = await neynarClient.fetchFeed(
            getFeedType(parentUrl),
            feedOptions
          );
        }
      }

      setCastsForFeed(feedKey, uniqBy([...casts, ...newFeed.casts], "hash"));
      if (newFeed?.next?.cursor) {
        setNextFeedCursor(newFeed.next.cursor);
      }
    } catch (e) {
      console.error("Error fetching feed", e);
    } finally {
      setLoadingMessage("Loading feed");
      setIsLoadingFeed(feedKey, false);
    }
  };

  useEffect(() => {
    if (account?.platformAccountId && !showCastThreadView) {
      const fid = account.platformAccountId!;
      getFeed({ parentUrl: selectedChannelUrl, fid });
    }
  }, [account, selectedChannelUrl, showCastThreadView]);

  useEffect(() => {
    closeNewCastModal();
    setShowCastThreadView(false);
    setSelectedCastIdx(-1);
  }, [selectedChannelUrl]);

  const renderRow = (item: any, idx: number) => (
    <li
      key={item?.hash}
      className="border-b border-foreground/20 relative flex items-center space-x-4 max-w-full"
    >
      <CastRow
        cast={item}
        isSelected={selectedCastIdx === idx}
        onSelect={() => onSelectCast(idx)}
        showChannel
      />
    </li>
  );

  const getButtonText = (): string => {
    if (isLoadingFeed) {
      return "Loading...";
    } else if (casts.length === 0) {
      return "Load feed";
    } else {
      return "Load more";
    }
  };

  const renderLoadMoreButton = () => (
    <Button
      ref={buttonRef}
      onClick={() =>
        getFeed({
          fid: account.platformAccountId!,
          parentUrl: selectedChannelUrl,
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
      setSelectedCast={updateSelectedCast}
      onReply={onReply}
      onQuote={onQuote}
    />
  );

  const renderNewCastModal = () => (
    <NewCastModal
      open={isNewCastModalOpen}
      setOpen={(isOpen) => (isOpen ? openNewCastModal() : closeNewCastModal())}
      linkedCast={selectedCast}
    />
  );

  const renderEmbedsModal = () => {
    return (
      <EmbedsModal
        open={showEmbedsModal}
        setOpen={() => setShowEmbedsModal(false)}
        cast={selectedCast!}
      />
    );
  };

  const renderWelcomeMessage = () =>
    casts.length === 0 &&
    hydratedAt &&
    !isLoadingFeed && (
      <Card className="max-w-sm col-span-1 m-4">
        <CardHeader>
          <CardTitle>Feed is empty</CardTitle>
          <CardDescription>
            Seems like there is nothing to see here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="max-w-lg">
            Start following people or channels to see their posts here. You can
            refresh the feed, if you think something is wrong.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            className="w-1/2"
            disabled={isRefreshingPage}
            onClick={async () => {
              setIsRefreshingPage(true);
              await hydrate();
              await getFeed({
                fid: account.platformAccountId!,
                parentUrl: selectedChannelUrl,
              });
              setIsRefreshingPage(false);
            }}
          >
            Refresh
          </Button>
        </CardFooter>
      </Card>
    );

  const renderContent = () => (
    <>
      <div className="ml-8 min-w-md md:min-w-[calc(100%-100px)] lg:min-w-[calc(100%-50px)]">
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
            {casts.length >= DEFAULT_FEED_PAGE_SIZE && renderLoadMoreButton()}
          </>
        )}
      </div>
      {renderNewCastModal()}
      {renderEmbedsModal()}
    </>
  );

  return renderContent();
}
