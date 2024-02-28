import React, { useEffect, useState } from "react";
import {
  AccountObjectType,
  useAccountStore,
} from "../../src/stores/useAccountStore";
import { CastType } from "../../src/common/constants/farcaster";
import { useHotkeys } from "react-hotkeys-hook";
import uniqBy from "lodash.uniqby";
import get from "lodash.get";
import { CastRow } from "../../src/common/components/CastRow";
import isEmpty from "lodash.isempty";
import { CastThreadView } from "../../src/common/components/CastThreadView";
import {
  DEFAULT_FEED_PAGE_SIZE,
  getNeynarFeedEndpoint,
} from "../../src/common/helpers/neynar";
import { SelectableListWithHotkeys } from "../../src/common/components/SelectableListWithHotkeys";
import RecommendedProfilesCard from "../../src/common/components/RecommendedProfilesCard";
import { Key } from "ts-key-enum";
import ReplyModal from "../../src/common/components/ReplyModal";
import EmbedsModal from "../../src/common/components/EmbedsModal";
import { useInView } from "react-intersection-observer";
import { renderEmbedForUrl } from "../../src/common/components/Embeds";
import { useRouter } from "next/router";
import { Button } from "../../src/components/ui/button";

type FeedType = {
  [key: string]: CastType[];
};

export default function Feed() {
  const router = useRouter();

  const [feeds, setFeeds] = useState<FeedType>({});
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [nextFeedCursor, setNextFeedCursor] = useState("");
  const [selectedFeedIdx, setSelectedFeedIdx] = useState(0);
  const [showCastThreadView, setShowCastThreadView] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [showEmbedsModal, setShowEmbedsModal] = useState(false);
  const [selectedCast, setSelectedCast] = useState<CastType | null>(null);

  const { ref: buttonRef, inView } = useInView({
    threshold: 0,
    delay: 100,
  });

  const { accounts, selectedAccountIdx, selectedChannelUrl, hydrated } =
    useAccountStore();

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
    if (!showCastThreadView) setSelectedCast(feed[selectedFeedIdx]);
  }, [selectedFeedIdx, showCastThreadView]);

  useEffect(() => {
    if (
      isLoadingFeed ||
      isEmpty(feed) ||
      showCastThreadView ||
      feed.length < DEFAULT_FEED_PAGE_SIZE
    )
      return;

    if (inView || selectedFeedIdx >= feed.length - 5) {
      getFeed({
        fid: account.platformAccountId,
        parentUrl: selectedChannelUrl,
        cursor: nextFeedCursor,
      });
    }
  }, [selectedFeedIdx, feed, account, selectedChannelUrl, inView]);

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

    const neynarEndpoint = getNeynarFeedEndpoint({ fid, parentUrl, cursor });
    await fetch(neynarEndpoint)
      .then((response) => response.json())
      .then((data) => {
        const feedKey = parentUrl || fid;
        const feed = feeds[feedKey] || [];
        setFeeds({
          ...feeds,
          [feedKey]: uniqBy(feed.concat(data.casts), "hash"),
        });
        if (data.next) {
          setNextFeedCursor(data.next.cursor);
        }
      })
      .catch((err) => {
        console.log("err", err);
      })
      .finally(() => setIsLoadingFeed(false));
  };

  useEffect(() => {
    if (account && !showCastThreadView) {
      setShowReplyModal(false);
      setSelectedFeedIdx(0);
      setShowCastThreadView(false);

      const fid = account.platformAccountId;
      getFeed({ parentUrl: selectedChannelUrl, fid });
    }
  }, [account, selectedChannelUrl]);

  const renderRow = (item: any, idx: number) => (
    <li
      key={item?.hash}
      className="border-b border-gray-700/40 relative flex items-center space-x-4 max-w-full md:max-w-2xl"
    >
      <CastRow
        cast={item as CastType}
        showChannel={!selectedChannelUrl}
        isSelected={selectedFeedIdx === idx}
        onSelect={() => onSelectCast(idx)}
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

  const renderRecommendedProfiles = () =>
    feed.length === 0 &&
    hydrated &&
    !isLoadingFeed && <RecommendedProfilesCard />;

  const renderChannelEmbed = () =>
    selectedChannelUrl ? (
      <div className="mx-2 mt-4 mb-4">
        {renderEmbedForUrl({ url: selectedChannelUrl })}
      </div>
    ) : null;

  const renderContent = () => (
    <>
      <div className="min-w-full">
        <div>{renderChannelEmbed()}</div>
        {showCastThreadView ? (
          renderThread()
        ) : (
          <>
            {renderFeed()}
            {renderRecommendedProfiles()}
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

  if (hydrated && isEmpty(accounts)) {
    router.push("/welcome");
  }

  return renderContent();
}
