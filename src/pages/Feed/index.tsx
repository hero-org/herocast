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
import { Loading } from "@/common/components/Loading";
import EmptyStateWithAction from "@/common/components/EmptyStateWithAction";
import { UserPlusIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { useNewPostStore } from "@/stores/useNewPostStore";
import { SelectableListWithHotkeys } from "@/common/components/SelectableListWithHotkeys";
import { Key } from "ts-key-enum";

type FeedType = {
  [key: string]: CastType[]
}

export default function Feed() {
  const navigate = useNavigate();


  const [feeds, setFeeds] = useState<FeedType>({});
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [nextFeedOffset, setNextFeedOffset] = useState("");
  const [selectedCastIdx, setSelectedCastIdx] = useState(0);
  const [showCastThreadView, setShowCastThreadView] = useState(false);
  const {
    accounts,
    channels,
    selectedAccountIdx,
    selectedChannelIdx
  } = useAccountStore();

  const isHydrated = useAccountStore(state => state._hydrated);

  const {
    removePostDraft
  } = useNewPostStore();

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

  // const cast = feed[selectedCastIdx];
  // const postDrafts = useNewPostStore(state => state.drafts);
  // const draftIdx = postDrafts.findIndex(draft => draft.parentHash === cast?.hash);

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
    if (isLoadingFeed || isEmpty(feed) || showCastThreadView) return;

    if (selectedCastIdx >= feed.length - 5) {
      const cursor = feed[feed.length - 1].timestamp;
      // unbounce this call to getFeed
      getFeed({ fid: account.platformAccountId, parentUrl: selectedChannelParentUrl, cursor });
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
          setNextFeedOffset(data.next.cursor);
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
    <li key={item.hash}
      className="border-b border-gray-700 relative flex items-center space-x-4 py-2 max-w-full md:max-w-2xl xl:max-w-4xl">
      <CastRow
        cast={item as CastType}
        channels={channels}
        showChannel={selectedChannelIdx === null}
        isSelected={selectedCastIdx === idx}
        onSelect={() => onSelectCast(idx)}
      />
    </li>
  )

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
    <EmptyStateWithAction
      title="No accounts"
      description="Add an account to get started"
      onClick={() => navigate('/accounts')}
      submitText="Add account"
      icon={UserPlusIcon}
    />
  )

  return isHydrated && isEmpty(accounts) ? renderEmptyState() : (
    <div className="min-w-full mr-4">
      {showCastThreadView ? renderThread() : renderFeed()}
      {isLoadingFeed && <Loading />}
    </div >
  )
}
