import React, { useEffect, useRef, useState } from "react";
import { AccountObjectType, useAccountStore } from "@/stores/useAccountStore";
import { CastType, VITE_NEYNAR_API_KEY } from "@/common/constants/farcaster";
import { useHotkeys } from "react-hotkeys-hook";
import uniqBy from 'lodash.uniqby';
import get from 'lodash.get';
import { CastRow } from "@/common/components/CastRow";
import { Key } from 'ts-key-enum';
import { openWindow } from "@/common/helpers/navigation";
import { useInView } from 'react-intersection-observer';
import isEmpty from "lodash.isempty";

type FeedType = {
  [key: string]: CastType[]
}


export default function Feed() {
  const [feeds, setFeeds] = useState<FeedType>({});
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [nextFeedOffset, setNextFeedOffset] = useState("");
  const [selectedCastIdx, setSelectedCastIdx] = useState(0);
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

  // console.log('inView', inView, 'entry', entry);

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
    const cast = feed[idx];

    const url = `https://warpcast.com/${cast.author.username}/${cast.hash.slice(0, 8)}`;
    openWindow(url);
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
  })

  useHotkeys(['k', Key.ArrowUp], () => {
    if (selectedCastIdx === 0) {
      return;
    }
    setSelectedCastIdx(selectedCastIdx - 1);
  }, [selectedCastIdx], {
  })

  useHotkeys('o', () => {
    onExpandCast(selectedCastIdx);
  }, [selectedCastIdx], {
  })

  useHotkeys('shift+o', () => {
    onSelectCast(selectedCastIdx);
  }, [selectedCastIdx], {
  })


  const getFeed = async ({ fid, parentUrl, cursor }: { fid: string, parentUrl?: string, cursor?: string }) => {
    if (isLoadingFeed) {
      return;
    }
    setIsLoadingFeed(true);

    const limit = 15;
    let neynarEndpoint = `https://api.neynar.com/v2/farcaster/feed/?api_key=${VITE_NEYNAR_API_KEY}&limit=${limit}`;

    if (parentUrl) {
      neynarEndpoint += `&feed_type=filter&filter_type=parent_url&parent_url=${parentUrl}`;
    } else if (fid) {
      neynarEndpoint += `&fid=${fid}`;
    }

    if (cursor) {
      neynarEndpoint += `&cursor=${cursor}`;
    }
    await fetch(neynarEndpoint)
      .then((response) => response.json())
      .then((data) => {
        const feedKey = parentUrl || fid;
        const feed = feeds[feedKey] || [];
        setFeeds({
          ...feeds,
          [feedKey]: uniqBy(feed.concat(data.casts), 'hash')
        });
        setNextFeedOffset(data.next.cursor);
      }).catch((err) => {
        console.log('err', err);
      }).finally(() => setIsLoadingFeed(false));
  }

  useEffect(() => {
    if (account) {
      setSelectedCastIdx(0);
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

  return (
    <div
      className="mr-12"
    /* ref={listRef} */
    >
      <ul role="list" className="divide-y divide-gray-700">
        {feed.map((cast: CastType, idx: number) => {
          return (
            <li key={cast.hash} ref={(selectedCastIdx === idx - 3) ? scollToRef : null
            }
              className="relative flex items-center space-x-4 py-2 max-w-full lg:max-w-2xl" >
              <CastRow
                cast={cast}
                channels={channels}
                showChannel={selectedChannelIdx === null}
                isSelected={selectedCastIdx === idx}
                onSelect={() => selectedCastIdx === idx ? onSelectCast(idx) : setSelectedCastIdx(idx)}
              />
            </li>
          );
        })}
        <li ref={ref} className="" />
      </ul>
      {isLoadingFeed && (<span className="my-4 font-semibold text-gray-200">Loading...</span>)}
    </div >
  )
}
