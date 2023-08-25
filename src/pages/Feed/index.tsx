import React, { useEffect, useRef, useState } from "react";
import { AccountObjectType, useAccountStore } from "@/stores/useAccountStore";
import { CastType } from "@/common/constants/farcaster";
import { useHotkeys } from "react-hotkeys-hook";
import uniqBy from 'lodash.uniqby';
import get from 'lodash.get';
import { CastRow } from "@/common/components/CastRow";
import { Key } from 'ts-key-enum';
import { openWindow } from "@/common/helpers/navigation";
import { useInView } from 'react-intersection-observer';
import isEmpty from "lodash.isempty";
import { CastThreadView } from "@/common/components/CastThreadView";
import { getNeynarFeedEndpoint } from "@/common/helpers/neynar";
import { Loading } from "@/common/components/Loading";
import EmptyStateWithAction from "@/common/components/EmptyStateWithAction";
import { UserPlusIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

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
  const { ref, inView } = useInView({
    /* Optional options */
    threshold: 0,
    delay: 100,
  });

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

  const onSelectCast = (idx: number) => {
    const cast = feed[idx];
    if (cast?.embeds?.length === 0) return;

    const url = cast.embeds[0].url;
    openWindow(url);
  }

  const onExpandCast = (idx: number) => {
    setSelectedCastIdx(idx);
    setShowCastThreadView(true);
  }

  useHotkeys(['j', Key.ArrowDown], () => {
    if (selectedCastIdx >= feed.length - 5) {
      const cursor = feed[feed.length - 1].timestamp;
      // unbounce this call to getFeed
      getFeed({ fid: account.platformAccountId, parentUrl: selectedChannelParentUrl, cursor });
    }

    if (selectedCastIdx < feed.length - 1) {
      setSelectedCastIdx(selectedCastIdx + 1);
    }
  }, [selectedCastIdx, account, feed, nextFeedOffset, selectedChannelParentUrl], {
    enabled: !isLoadingFeed && !isEmpty(feed) && !showCastThreadView
  })

  useHotkeys(['k', Key.ArrowUp], () => {
    if (selectedCastIdx === 0) {
      return;
    }
    setSelectedCastIdx(selectedCastIdx - 1);
  }, [selectedCastIdx], {
    enabled: !isLoadingFeed && !isEmpty(feed) && !showCastThreadView
  })

  useHotkeys(['o', Key.Enter], () => {
    onExpandCast(selectedCastIdx);
  }, [selectedCastIdx], {
  })

  useHotkeys('shift+o', () => {
    onSelectCast(selectedCastIdx);
  }, [selectedCastIdx], {
  })

  useHotkeys('esc', () => {
    setShowCastThreadView(false);
  }, [selectedCastIdx], {
  })

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
    if (account) {
      setSelectedCastIdx(0);
      setShowCastThreadView(false);

      const fid = account.platformAccountId;
      getFeed({ parentUrl: selectedChannelParentUrl, fid });
    }
  }, [account, selectedChannelParentUrl]);

  useEffect(() => {
    if (inView && !isEmpty(feed)) {
      const cursor = feed[feed.length - 1].timestamp;
      getFeed({ fid: account.platformAccountId, parentUrl: selectedChannelParentUrl, cursor });
    }
  }, [inView]);

  const scollToRef = useRef();
  // scroll to selected cast when selectedCastIdx changes
  useEffect(() => {
    if (scollToRef.current) {
      // @ts-ignore
      scollToRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [selectedCastIdx]);


  const renderFeed = () => (
    <ul role="list" className="divide-y divide-gray-700">
      {feed.map((cast: CastType, idx: number) => (
        <li key={cast.hash} ref={(selectedCastIdx === idx - 3) ? scollToRef : null}
          className="relative flex items-center space-x-4 py-2 max-w-full md:max-w-2xl xl:max-w-4xl">
          <CastRow
            cast={cast}
            channels={channels}
            showChannel={selectedChannelIdx === null}
            isSelected={selectedCastIdx === idx}
            onSelect={() => onExpandCast(idx)}
          />
        </li>
      ))}
      <li ref={ref} className="" />
    </ul>
  );

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

  return isEmpty(feed) ? renderEmptyState() : (
    <div className="min-w-full mr-4">
      {showCastThreadView ? renderThread() : renderFeed()}
      {isLoadingFeed && <Loading />}
    </div >
  )
}
