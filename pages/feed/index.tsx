import React, { useEffect, useState } from "react";
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
import { useNavigationStore } from "@/stores/useNavigationStore";
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
  const [showEmbedsModal, setShowEmbedsModal] = useState(false);
  const { isReplyModalOpen, openReplyModal, closeReplyModal } =
    useNavigationStore();

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
  }: {
    selectedChannelUrl: string | null;
    account: AccountObjectType;
  }) => {
    if (selectedChannelUrl) {
      return selectedChannelUrl;
    } else if (account) {
      return account.platformAccountId;
    } else {
      return null;
    }
  };

  const feedKey = getFeedKey({ selectedChannelUrl, account });
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
      !account?.platformAccountId ||
      !inView
    )
      return;

    getFeed({
      fid: account.platformAccountId!,
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
  ]);

  useHotkeys(
    [Key.Escape, "§"],
    () => {
      setShowCastThreadView(false);
    },
    [showCastThreadView, isReplyModalOpen, showEmbedsModal],
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
      enabled: showCastThreadView && !isReplyModalOpen && !showEmbedsModal,
    }
  );

  useHotkeys(
    "r",
    () => {
      openReplyModal();
    },
    [openReplyModal],
    {
      enabled: !isReplyModalOpen,
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
    setIsLoadingFeed(true);

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
      }
      const feedKey = parentUrl || fid;
      const feed = feeds[feedKey] || [];

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
    if (account?.platformAccountId && !showCastThreadView) {
      const fid = account.platformAccountId!;
      getFeed({ parentUrl: selectedChannelUrl, fid });
    }
  }, [account, selectedChannelUrl, showCastThreadView]);

  useEffect(() => {
    closeReplyModal();
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
          openReplyModal();
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
          fid: account.platformAccountId,
          parentUrl: selectedChannelUrl,
          cursor: nextFeedCursor,
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
      data={feed}
      selectedIdx={selectedCastIdx}
      setSelectedIdx={setSelectedCastIdx}
      renderRow={(item: any, idx: number) => renderRow(item, idx)}
      onExpand={onOpenLinkInCast}
      onSelect={onSelectCast}
      isActive={!(showCastThreadView || isReplyModalOpen || showEmbedsModal)}
    />
  );

  const renderThread = () => (
    <CastThreadView
      cast={feed[selectedCastIdx]}
      fid={account.platformAccountId}
      onBack={() => setShowCastThreadView(false)}
      setSelectedCast={updateSelectedCast}
      setShowReplyModal={(show: boolean) =>
        show ? openReplyModal() : closeReplyModal()
      }
    />
  );

  const renderReplyModal = () => (
    <ReplyModal
      open={isReplyModalOpen}
      setOpen={() => closeReplyModal()}
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

  return renderContent();
}
