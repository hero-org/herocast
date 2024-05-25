import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  AccountObjectType,
  CUSTOM_CHANNELS,
  useAccountStore,
} from "@/stores/useAccountStore";
import { useHotkeys } from "react-hotkeys-hook";
import get from "lodash.get";
import { CastRow } from "@/common/components/CastRow";
import isEmpty from "lodash.isempty";
import { CastThreadView } from "@/common/components/CastThreadView";
import { SelectableListWithHotkeys } from "@/common/components/SelectableListWithHotkeys";
import { Key } from "ts-key-enum";
import ReplyModal from "@/common/components/ReplyModal";
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
import WelcomeCards from "@/common/components/WelcomeCards";
import { useDataStore } from "@/stores/useDataStore";
import { Input } from "@/components/ui/input";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

type FeedsType = {
  [key: string]: CastWithInteractions[];
};

const DEFAULT_FEED_PAGE_SIZE = 10;
const neynarClient = new NeynarAPIClient(
  process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
);

export default function Feed() {
  const [feeds, setFeeds] = useState<FeedsType>({});
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [nextFeedCursor, setNextFeedCursor] = useState("");
  const [selectedCastIdx, setSelectedCastIdx] = useState(0);
  const [showCastThreadView, setShowCastThreadView] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [showEmbedsModal, setShowEmbedsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const { ref: buttonRef, inView } = useInView({
    threshold: 0,
    delay: 100,
  });

  const { accounts, selectedAccountIdx, selectedChannelUrl, hydratedAt } =
    useAccountStore();

  const { selectedCast, updateSelectedCast } = useDataStore();

  const account: AccountObjectType = accounts[selectedAccountIdx];

  const getFeedKey = ({
    selectedChannelUrl,
    account,
    searchQuery,
  }: {
    selectedChannelUrl: string | null;
    account: AccountObjectType;
    searchQuery: string;
  }) => {
    if (selectedChannelUrl) {
      return selectedChannelUrl;
    } else if (account && searchQuery) {
      return searchQuery;
    } else {
      return null;
    }
  };

  const feedKey = getFeedKey({ selectedChannelUrl, account, searchQuery });
  const feed = feedKey ? get(feeds, feedKey, []) : [];

  const onOpenLinkInCast = (idx: number) => {
    setShowEmbedsModal(true);
  };

  const onSelectCast = (idx: number) => {
    setSelectedCastIdx(idx);
    setShowCastThreadView(true);
  };

  useEffect(() => {
    if (!showCastThreadView) {
      if (selectedCastIdx === 0) {
        window.scrollTo(0, 0);
      } else if (selectedCastIdx === feed.length - 1) {
        window.scrollTo(0, document.body.scrollHeight);
      }
    }
  }, [selectedCastIdx, showCastThreadView]);

  useEffect(() => {
    updateSelectedCast(feed[selectedCastIdx]);
  }, [selectedCastIdx, selectedChannelUrl, feed]);

  useEffect(() => {
    if (
      isLoadingFeed ||
      isEmpty(feed) ||
      showCastThreadView ||
      feed.length < DEFAULT_FEED_PAGE_SIZE ||
      !inView
    )
      return;

    getFeed({
      username: searchQuery,
      parentUrl: selectedChannelUrl,
      cursor: nextFeedCursor,
    });
  }, [
    selectedCastIdx,
    feed,
    account,
    selectedChannelUrl,
    inView,
    isLoadingFeed,
    searchQuery,
  ]);

  useEffect(() => {
    const username = router.query.username;
    if (username) {
      setSearchQuery(username);
      setNextFeedCursor(""); // Reset cursor for new search
      setFeeds({}); // Clear previous feeds
      getFeed({ parentUrl: selectedChannelUrl, username });
    }
  }, [router.query.username, selectedChannelUrl]);
  useHotkeys(
    [Key.Escape, "§"],
    () => {
      setShowCastThreadView(false);
    },
    [showCastThreadView, showReplyModal, showEmbedsModal],
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
      enabled: showCastThreadView && !showReplyModal && !showEmbedsModal,
    }
  );

  useHotkeys(
    "r",
    () => {
      setShowReplyModal(true);
    },
    [showReplyModal],
    {
      enabled: !showReplyModal,
      enableOnFormTags: false,
      preventDefault: true,
    }
  );

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
    username,
    parentUrl,
    cursor,
  }: {
    username: string;
    parentUrl?: string;
    cursor?: string;
  }) => {
    if (isLoadingFeed) {
      return;
    }
    setIsLoadingFeed(true);

    try {
      let feedOptions = {
        cursor,
        limit: DEFAULT_FEED_PAGE_SIZE,
      };

      let newFeed;
      if (parentUrl === CUSTOM_CHANNELS.FOLLOWING) {
        const response = await neynarClient.lookupUserByUsername(username);
        const user = response?.result.user;
        if (user) {
          newFeed = await neynarClient.fetchUserFollowingFeed(
            user.fid,
            feedOptions
          );
        }
      } else {
        feedOptions = {
          ...feedOptions,
          filterType: getFilterType(parentUrl),
          parentUrl: getParentUrl(parentUrl),
          username,
        } as {
          cursor: string | undefined;
          limit: number;
          filterType: FilterType;
          parentUrl: string;
          username: string;
        };
        newFeed = await neynarClient.fetchFeed(
          getFeedType(parentUrl),
          feedOptions
        );
      }
      const feedKey = parentUrl || username;
      const feed = cursor ? feeds[feedKey] || [] : []; // Only use existing feed if cursor is provided

      setFeeds({
        ...feeds,
        [feedKey]: uniqBy(feed.concat(newFeed.casts), "hash"),
      });
      if (newFeed?.next?.cursor) {
        setNextFeedCursor(newFeed.next.cursor);
      }
    } catch (e) {
      console.error("Error fetching feed", e);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  useEffect(() => {
    setShowReplyModal(false);
    setShowCastThreadView(false);
    setSelectedCastIdx(0);
  }, [selectedChannelUrl]);

  const renderRow = (item: any, idx: number) => (
    <li
      key={item?.hash}
      className="border-b border-gray-700/40 relative flex items-center space-x-4 max-w-full"
    >
      <CastRow
        cast={item}
        isSelected={selectedCastIdx === idx}
        onSelect={() => onSelectCast(idx)}
        onReply={() => {
          updateSelectedCast(item);
          setShowReplyModal(true);
        }}
        showChannel
      />
    </li>
  );

  const getButtonText = (): string => {
    if (isLoadingFeed) {
      return "Loading...";
    } else if (feed.length === 0) {
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
          username: searchQuery,
          parentUrl: selectedChannelUrl,
          cursor: nextFeedCursor,
        })
      }
      variant="outline"
      className="ml-4 my-4"
    >
      {getButtonText()}
    </Button>
  );

  const renderFeed = () => (
    <SelectableListWithHotkeys
      data={feed}
      selectedIdx={selectedCastIdx}
      setSelectedIdx={setSelectedCastIdx}
      renderRow={(item: any, idx: number) => renderRow(item, idx)}
      onExpand={onOpenLinkInCast}
      onSelect={onSelectCast}
      isActive={!(showCastThreadView || showReplyModal || showEmbedsModal)}
    />
  );

  const renderThread = () => (
    <CastThreadView
      cast={feed[selectedCastIdx]}
      onBack={() => setShowCastThreadView(false)}
      setSelectedCast={updateSelectedCast}
      setShowReplyModal={setShowReplyModal}
    />
  );

  const renderReplyModal = () => (
    <ReplyModal
      open={showReplyModal}
      setOpen={() => setShowReplyModal(false)}
      parentCast={selectedCast}
    />
  );

  const renderEmbedsModal = () => {
    return (
      <EmbedsModal
        open={showEmbedsModal}
        setOpen={() => setShowEmbedsModal(false)}
        cast={selectedCast}
      />
    );
  };

  const renderWelcomeMessage = () =>
    feed.length === 0 && hydratedAt && !isLoadingFeed && <WelcomeCards />;

  const renderContent = () => (
    <>
      <div className="min-w-full">
        {isLoadingFeed && isEmpty(feed) && (
          <div className="ml-4">
            <Loading />
          </div>
        )}
        {showCastThreadView ? (
          renderThread()
        ) : (
          <>
            {renderFeed()}
            {renderWelcomeMessage()}
            {feed.length > 0 &&
              feed.length >= DEFAULT_FEED_PAGE_SIZE &&
              renderLoadMoreButton()}
          </>
        )}
      </div>
      {renderReplyModal()}
      {renderEmbedsModal()}
    </>
  );

  const handleSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      try {
        setIsLoadingFeed(true);
        const response = await neynarClient.lookupUserByUsername(searchQuery);
        const user = response?.result.user;
        if (user) {
          setSearchQuery(user.username);
          setNextFeedCursor(""); // Reset cursor for new search
          setFeeds({}); // Clear previous feeds
          router.push(`/new/feed?username=${user.username}`);
          await getFeed({
            parentUrl: selectedChannelUrl,
            username: user.username,
          });
        }
      } catch (error) {
        console.error("Error fetching user by username:", error);
      } finally {
        setIsLoadingFeed(false);
      }
    }
  };

  return (
    <>
      <div className="flex flex-col w-full max-w-4xl mx-auto p-4 md:p-6">
        <div className="w-full ">
          <label htmlFor="feed-search" className="sr-only">
            Search
          </label>
          <div className="relative text-foreground/80 focus-within:text-foreground/80">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <Input
              id="feed-search"
              className="block w-full rounded-md border-0 bg-white/20 py-2.5 pl-10 pr-3 text-foreground/80 placeholder:text-foreground focus:bg-white/30 focus:text-foreground focus:ring-0 focus:placeholder:text-gray-200 sm:text-sm sm:leading-6"
              placeholder="Enter a Farcaster username"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
            />
          </div>
        </div>
        {renderContent()}
      </div>
    </>
  );
}

function SearchIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
