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
import { ChevronRightIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { SelectableListWithHotkeys } from "../../src/common/components/SelectableListWithHotkeys";
import { Key } from "ts-key-enum";
import ReplyModal from "../../src/common/components/ReplyModal";
import EmbedsModal from "../../src/common/components/EmbedsModal";
import { useInView } from "react-intersection-observer";
import { renderEmbedForUrl } from "../../src/common/components/Embeds";
import { useRouter } from "next/router";

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
    <button
      ref={buttonRef}
      onClick={() =>
        getFeed({
          fid: account.platformAccountId,
          parentUrl: selectedChannelUrl,
          cursor: nextFeedCursor,
        })
      }
      className="ml-4 my-4 text-foreground/80 bg-gray-600 hover:bg-gray-500 inline-flex h-[35px] items-center justify-center rounded-sm px-[15px] font-medium leading-none outline-none focus:bg-gray-500"
    >
      {getButtonText()}
    </button>
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

  const renderEmptyState = () => (
    <>
      <div className="max-w-7xl px-6 pb-24 sm:pb-32 lg:flex lg:px-8">
        <div className="mx-auto max-w-2xl flex-shrink-0 lg:mx-0 lg:max-w-xl">
          <div className="mt-12">
            <a
              href="https://paragraph.xyz/@hellno/herocast-log-nr2"
              target="_blank"
              rel="noreferrer"
              className="inline-flex space-x-6"
            >
              <span className="rounded-full bg-green-700/10 px-3 py-1 text-sm font-semibold leading-6 text-green-400 ring-1 ring-inset ring-green-700/20">
                What&apos;s new
              </span>
              <span className="inline-flex items-center space-x-2 text-sm font-medium leading-6 text-foreground/80">
                <span>Just shipped an update for you</span>
                <ChevronRightIcon
                  className="h-5 w-5 text-foreground/80"
                  aria-hidden="true"
                />
              </span>
            </a>
          </div>
          <h1 className="mt-10 text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Welcome to herocast
          </h1>
          <p className="mt-6 text-lg leading-8 text-foreground/80">
            herocast is a desktop Farcaster client for power users aka
            superhuman for Farcaster. <br />
            <br />
            It has support for multiple accounts and can switch channels faster
            than you can say &apos;Memes&apos;. It supports{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-foreground/80 border-gray-600">
              Cmd + K
            </kbd>{" "}
            (command palette) to control everything. You can navigate with{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-foreground/80 border-gray-600">
              j
            </kbd>{" "}
            and{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-foreground/80 border-gray-600">
              k
            </kbd>
            through all lists,{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-foreground/80 border-gray-600">
              l
            </kbd>{" "}
            to like (lowercase L) and{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-foreground/80 border-gray-600">
              r
            </kbd>{" "}
            to recast. Switch channels on Feed page with{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-foreground/80 border-gray-600">
              Shift + 1 to 9
            </kbd>
            . Open external links in a cast with{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-foreground/80 border-gray-600">
              Shift + o
            </kbd>
            .
          </p>
          <div className="mt-10 flex items-center gap-x-6">
            <button
              onClick={() => router.push("/accounts")}
              className="flex rounded-sm bg-green-700 px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-green-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
            >
              Get started{" "}
              <UserPlusIcon
                className="ml-2 h-5 w-5 text-foreground/80"
                aria-hidden="true"
              />
            </button>
            <a
              href="https://paragraph.xyz/@hellno/herocast-log-nr2"
              target="_blank"
              rel="noreferrer"
              className="rounded-sm px-3.5 py-2 text-sm font-semibold leading-6 text-foreground outline outline-gray-500"
            >
              Learn more <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </>
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

  const renderChannelEmbed = () =>
    selectedChannelUrl ? (
      <div className="mx-2 mt-4 mb-4">
        {renderEmbedForUrl({ url: selectedChannelUrl })}
      </div>
    ) : null;

  return hydrated && isEmpty(accounts) ? (
    renderEmptyState()
  ) : (
    <>
      <div className="min-w-full">
        <div>{renderChannelEmbed()}</div>
        {showCastThreadView ? (
          renderThread()
        ) : (
          <>
            {renderFeed()}
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
}
