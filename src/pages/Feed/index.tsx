import React, { useEffect, useState } from "react";
import { AccountObjectType, useAccountStore } from "@/stores/useAccountStore";
import { CastType } from "@/common/constants/farcaster";
import { useHotkeys } from "react-hotkeys-hook";
import uniqBy from 'lodash.uniqby';
import get from 'lodash.get';
import { CastRow } from "@/common/components/CastRow";
import { openWindow } from "@/common/helpers/navigation";
import isEmpty from "lodash.isempty";
import { CastThreadView } from "@/common/components/CastThreadView";
import { getNeynarFeedEndpoint } from "@/common/helpers/neynar";
import { ChevronRightIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { SelectableListWithHotkeys } from "@/common/components/SelectableListWithHotkeys";
import { Key } from "ts-key-enum";

type FeedType = {
  [key: string]: CastType[]
}

export default function Feed() {
  const navigate = useNavigate();


  const [feeds, setFeeds] = useState<FeedType>({});
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [nextFeedCursor, setNextFeedCursor] = useState("");
  const [selectedCastIdx, setSelectedCastIdx] = useState(0);
  const [showCastThreadView, setShowCastThreadView] = useState(false);
  const {
    accounts,
    channels,
    selectedAccountIdx,
    selectedChannelIdx,
    hydrated
  } = useAccountStore();

  // const isHydrated = useAccountStore(state => state._hydrated);


  const selectedChannelParentUrl = channels && selectedChannelIdx !== null ? channels[selectedChannelIdx].parent_url : undefined;
  const account: AccountObjectType = accounts[selectedAccountIdx];
  const getFeedKey = ({ selectedChannelParentUrl, account }: { selectedChannelParentUrl: string | undefined, account: AccountObjectType }) => {
    if (selectedChannelParentUrl) {
      return selectedChannelParentUrl;
    } else if (account) {
      return account.platformAccountId;
    } else {
      return null;
    }
  };

  const feedKey = getFeedKey({ selectedChannelParentUrl, account });
  const feed = feedKey ? get(feeds, feedKey, []) : [];

  const onOpenLinkInCast = (idx: number) => {
    const cast = feed[idx];
    if (cast?.embeds?.length === 0) return;

    const url = cast.embeds[0].url;
    openWindow(url);
  }

  const onSelectCast = (idx: number) => {
    setSelectedCastIdx(idx);
    setShowCastThreadView(true);
  }

  useEffect(() => {
    // console.log('feed', feed.length, 'isEmpty(feed)', isEmpty(feed), 'isLoadingFeed', isLoadingFeed, 'selectedCastIdx', selectedCastIdx)
    if (isLoadingFeed || isEmpty(feed) || showCastThreadView) return;

    if (selectedCastIdx >= feed.length - 5) {
      // const cursor = // feed[feed.length - 1]?.timestamp;
      // unbounce this call to getFeed
      getFeed({ fid: account.platformAccountId, parentUrl: selectedChannelParentUrl, cursor: nextFeedCursor });
    }
  }, [selectedCastIdx, feed, account, selectedChannelParentUrl])

  useHotkeys([Key.Escape, '§'], () => {
    setShowCastThreadView(false);
  }, [selectedCastIdx], {
    enableOnFormTags: true,
  })

  // useEffect(() => {
  //   if (!showCastThreadView && draftIdx) {
  //     if (draftIdx !== -1 && postDrafts[draftIdx].text == "") {
  //       removePostDraft(draftIdx);
  //     }
  //   }
  // }, [showCastThreadView, draftIdx]);

  const getFeed = async ({ fid, parentUrl, cursor }: { fid: string, parentUrl?: string, cursor?: string }) => {
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
          [feedKey]: uniqBy(feed.concat(data.casts), 'hash')
        });
        if (data.next) {
          setNextFeedCursor(data.next.cursor);
        }
      }).catch((err) => {
        console.log('err', err);
      }).finally(() => setIsLoadingFeed(false));
  }

  useEffect(() => {
    if (account && !showCastThreadView) {
      setSelectedCastIdx(0);
      setShowCastThreadView(false);

      const fid = account.platformAccountId;
      getFeed({ parentUrl: selectedChannelParentUrl, fid });
    }
  }, [account, selectedChannelParentUrl]);

  const renderRow = (item: any, idx: number) => (
    <li key={item?.hash}
      className="border-b border-gray-700/40 relative flex items-center space-x-4 max-w-full md:max-w-2xl xl:max-w-3xl">
      <CastRow
        cast={item as CastType}
        channels={channels}
        showChannel={selectedChannelIdx === null}
        isSelected={selectedCastIdx === idx}
        onSelect={() => onSelectCast(idx)}
      />
    </li>
  )

  const getButtonText = (): string => {
    if (isLoadingFeed) {
      return "Loading..."
    } else if (feed.length === 0) {
      return "Load feed"
    } else {
      return "Load more"
    }
  };

  const renderLoadMoreButton = () => (
    <button
      onClick={() => getFeed({ fid: account.platformAccountId, parentUrl: selectedChannelParentUrl, cursor: nextFeedCursor })}
      className="mt-4 text-gray-100 bg-gray-600 hover:bg-gray-500 inline-flex h-[35px] items-center justify-center rounded-sm px-[15px] font-medium leading-none outline-none focus:bg-gray-500"
    >
      {getButtonText()}
    </button>
  );

  const renderFeed = () => (
    <SelectableListWithHotkeys
      data={feed}
      selectedIdx={selectedCastIdx}
      setSelectedIdx={setSelectedCastIdx}
      renderRow={(item: any, idx: number) => renderRow(item, idx)}
      onExpand={onOpenLinkInCast}
      onSelect={onSelectCast}
    />
  )

  const renderThread = () => (
    <CastThreadView
      cast={feed[selectedCastIdx]}
      fid={account.platformAccountId}
      onBack={() => setShowCastThreadView(false)}
    />
  )


  const renderEmptyState = () => (
    <>
      <div className="max-w-7xl px-6 pb-24 sm:pb-32 lg:flex lg:px-8">
        <div className="mx-auto max-w-2xl flex-shrink-0 lg:mx-0 lg:max-w-xl">
          <div className="mt-12">
            <a href="https://paragraph.xyz/@hellno/herocast-log-nr2" target="_blank" rel="noreferrer"
              className="inline-flex space-x-6">
              <span className="rounded-full bg-green-700/10 px-3 py-1 text-sm font-semibold leading-6 text-green-400 ring-1 ring-inset ring-green-700/20">
                What&apos;s new
              </span>
              <span className="inline-flex items-center space-x-2 text-sm font-medium leading-6 text-gray-300">
                <span>Just shipped an update for you</span>
                <ChevronRightIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
              </span>
            </a>
          </div>
          <h1 className="mt-10 text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Welcome to herocast
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-300">
            herocast is a desktop Farcaster client for power users aka superhuman for Farcaster. <br /><br />
            It has support for multiple accounts and can switch channels faster than you can say &apos;Memes&apos;. It supports{' '}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              Cmd + K
            </kbd> (command palette) to control everything.
            You can navigate with <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              j
            </kbd> and <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              k
            </kbd>through all lists, <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              l
            </kbd> to like (lowercase L) and <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              r
            </kbd> to recast. Switch channels on Feed page with <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              Shift + 1 to 9
            </kbd>. Open external links in a cast with <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              Shift + o
            </kbd>.
          </p>
          <div className="mt-10 flex items-center gap-x-6">
            <button
              onClick={() => navigate('/accounts')}
              className="flex rounded-sm bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
            >
              Get started <UserPlusIcon className="ml-2 h-5 w-5 text-gray-100" aria-hidden="true" />
            </button>
            <a href="https://paragraph.xyz/@hellno/herocast-log-nr2" target="_blank" rel="noreferrer"
              className="rounded-sm px-3.5 py-2 text-sm font-semibold leading-6 text-white outline outline-gray-500">
              Learn more <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </>
  )


  return hydrated && isEmpty(accounts) ? renderEmptyState() : (
    <div className="min-w-full mr-4">
      {showCastThreadView ?
        renderThread()
        : <>
          {renderFeed()}
          {renderLoadMoreButton()}
        </>
      }
    </div >
  )
}
