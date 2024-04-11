import React, { useEffect, useState } from "react";
import {
  AccountObjectType,
  CUSTOM_CHANNELS,
  useAccountStore,
} from "../../src/stores/useAccountStore";
import { CastType } from "../../src/common/constants/farcaster";
import { useHotkeys } from "react-hotkeys-hook";
import get from "lodash.get";
import { CastRow } from "../../src/common/components/CastRow";
import isEmpty from "lodash.isempty";
import { CastThreadView } from "../../src/common/components/CastThreadView";
import { DEFAULT_FEED_PAGE_SIZE } from "../../src/common/helpers/neynar";
import { SelectableListWithHotkeys } from "../../src/common/components/SelectableListWithHotkeys";
import { Key } from "ts-key-enum";
import ReplyModal from "../../src/common/components/ReplyModal";
import EmbedsModal from "../../src/common/components/EmbedsModal";
import { useInView } from "react-intersection-observer";
import { useRouter } from "next/router";
import { Button } from "../../src/components/ui/button";
import { FilterType, NeynarAPIClient } from "@neynar/nodejs-sdk";
import {
  CastWithInteractions,
  FeedType,
} from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { Loading } from "../../src/common/components/Loading";
import uniqBy from "lodash.uniqby";
import BigOptionSelector from "@/common/components/BigOptionSelector";

type FeedsType = {
  [key: string]: CastWithInteractions[];
};

const neynarClient = new NeynarAPIClient(
  process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
);

export default function Feed() {
  const router = useRouter();

  const [feeds, setFeeds] = useState<FeedsType>({});
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [nextFeedCursor, setNextFeedCursor] = useState("");
  const [selectedFeedIdx, setSelectedFeedIdx] = useState(0);
  const [showCastThreadView, setShowCastThreadView] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [showEmbedsModal, setShowEmbedsModal] = useState(false);
  const [selectedCast, setSelectedCast] =
    useState<CastWithInteractions | null>();

  const { ref: buttonRef, inView } = useInView({
    threshold: 0,
    delay: 100,
  });

  const {
    accounts,
    selectedAccountIdx,
    selectedChannelUrl,
    setSelectedChannelUrl,
    hydratedAt,
  } = useAccountStore();

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
    // const cast = feed[idx];
    // if (cast?.embeds?.length === 0) return;

    setShowEmbedsModal(true);
  };

  const onSelectCast = (idx: number) => {
    setSelectedFeedIdx(idx);
    setShowCastThreadView(true);
  };

  useEffect(() => {
    if (!showCastThreadView) {
      setSelectedCast(feed[selectedFeedIdx]);

      if (selectedFeedIdx === 0) {
        window.scrollTo(0, 0);
      } else if (selectedFeedIdx === feed.length - 1) {
        window.scrollTo(0, document.body.scrollHeight);
      }
    }
  }, [selectedFeedIdx, showCastThreadView]);

  useEffect(() => {
    if (
      isLoadingFeed ||
      isEmpty(feed) ||
      showCastThreadView ||
      feed.length < DEFAULT_FEED_PAGE_SIZE ||
      !account?.platformAccountId
    )
      return;

    if (inView) {
      getFeed({
        fid: account.platformAccountId!,
        parentUrl: selectedChannelUrl,
        cursor: nextFeedCursor,
      });
    }
  }, [
    selectedFeedIdx,
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

    const feedOptions = {
      filterType: getFilterType(parentUrl),
      parentUrl,
      cursor,
      fid: Number(fid),
      limit: DEFAULT_FEED_PAGE_SIZE,
    };
    const newFeed = await neynarClient.fetchFeed(
      getFeedType(parentUrl),
      feedOptions
    );
    const feedKey = parentUrl || fid;
    const feed = feeds[feedKey] || [];

    setFeeds({
      ...feeds,
      [feedKey]: uniqBy(feed.concat(newFeed.casts), "hash"),
    });
    if (newFeed?.next?.cursor) {
      setNextFeedCursor(newFeed.next.cursor);
    }
    setIsLoadingFeed(false);
  };

  useEffect(() => {
    if (account?.platformAccountId && !showCastThreadView) {
      const fid = account.platformAccountId!;
      getFeed({ parentUrl: selectedChannelUrl, fid });
    }
  }, [account, selectedChannelUrl, showCastThreadView]);

  useEffect(() => {
    setShowReplyModal(false);
    setShowCastThreadView(false);
    setSelectedFeedIdx(0);
  }, [selectedChannelUrl]);

  const renderRow = (item: any, idx: number) => (
    <li
      key={item?.hash}
      className="border-b border-gray-700/40 relative flex items-center space-x-4 max-w-full md:max-w-2xl"
    >
      <CastRow
        cast={item as CastType}
        isSelected={selectedFeedIdx === idx}
        onSelect={() => onSelectCast(idx)}
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
      selectedIdx={selectedFeedIdx}
      setSelectedIdx={setSelectedFeedIdx}
      renderRow={(item: any, idx: number) => renderRow(item, idx)}
      onExpand={onOpenLinkInCast}
      onSelect={onSelectCast}
      isActive={!(showCastThreadView || showReplyModal || showEmbedsModal)}
    />
  );

  const renderThread = () => (
    <CastThreadView
      cast={feed[selectedFeedIdx]}
      fid={account.platformAccountId}
      onBack={() => setShowCastThreadView(false)}
      setSelectedCast={setSelectedCast}
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
    feed.length === 0 &&
    hydratedAt &&
    !isLoadingFeed && (
      <div className="m-8 flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <BigOptionSelector
          options={[
            account &&
              !account.platformAccountId && {
                title: "Continue to connect to herocast",
                description:
                  "Finish connecting your Farcaster account with your web3 wallet or by scanning a QR code.",
                buttonText: "Continue",
                onClick: () => router.push("/accounts"),
              },
            {
              title: "I have a Farcaster account",
              description:
                "I signed up for Farcaster before and want to connect my account to herocast.",
              buttonText: "Connect my account",
              onClick: () => router.push("/accounts"),
            },
            {
              title: "I am new to Farcaster",
              description:
                "I want to create a new account on Farcaster with herocast.",
              buttonText: "Create new account",
              onClick: () => router.push("/farcaster-signup"),
            },
            {
              title: "Browse trending feed",
              description:
                "No need to signup if you just want to checkout herocast",
              buttonText: "Trending Feed →",
              onClick: () => {
                getFeed({ parentUrl: CUSTOM_CHANNELS.TRENDING, fid: "1" });
                setSelectedChannelUrl(CUSTOM_CHANNELS.TRENDING)
              }
            },
          ]}
        />
      </div>
    );

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
