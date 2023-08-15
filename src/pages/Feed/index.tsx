import React, { useEffect, useRef, useState } from "react";
import { classNames } from "@/common/helpers/css";
import { AccountObjectType, useAccountStore } from "@/stores/useAccountStore";
import { CastType, VITE_NEYNAR_API_KEY } from "@/common/constants/farcaster";
import { ChannelType } from "@/common/constants/channels";
import { useHotkeys } from "react-hotkeys-hook";
import uniqBy from 'lodash.uniqby';
import isEmpty from "lodash.isempty";
import { open } from '@tauri-apps/api/shell';
import { ArrowUturnUpIcon } from "@heroicons/react/20/solid";

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

  const selectedChannelParentUrl = selectedChannelIdx ? channels[selectedChannelIdx].parent_url : undefined;

  const account: AccountObjectType = accounts[selectedAccountIdx];
  const feedKey = selectedChannelParentUrl || (account && account.platformAccountId);
  const feed = feeds[feedKey] || [];

  const onSelectCast = (idx: number) => {
    const cast = feed[idx];
    const url = cast?.embeds[0].url;
    if (url) open(url);
  }

  const onExpandCast = (idx: number) => {
    const cast = feed[idx];
  }


  useHotkeys('j', () => {
    if (selectedCastIdx >= feed.length - 4) {

      const cursor = feed[feed.length - 1].timestamp;
      // unbounce this call to getFeed
      getFeed({ fid: account.platformAccountId, parentUrl: selectedChannelParentUrl, cursor });
    }

    if (selectedCastIdx === feed.length - 1) {
      return;
    }
    setSelectedCastIdx(selectedCastIdx + 1);

  }, [selectedCastIdx, account, feed, nextFeedOffset, selectedChannelParentUrl], {
  })

  useHotkeys('k', () => {
    if (selectedCastIdx === 0) {
      return;
    }
    setSelectedCastIdx(selectedCastIdx - 1);
  }, [selectedCastIdx], {
  })


  useHotkeys('o', () => {
    onSelectCast(selectedCastIdx);
  }, [selectedCastIdx], {
  })

  // useHotkeys('shift+o', () => {
  //   onExpandCast(selectedCastIdx);
  // }, [selectedCastIdx], {
  // })

  const getFeed = async ({ fid, parentUrl, cursor }: { fid: string, parentUrl?: string, cursor?: string }) => {
    if (isLoadingFeed) {
      return;
    }
    console.log('getFeed', { fid, parentUrl, cursor });
    setIsLoadingFeed(true);
    const apiKey = VITE_NEYNAR_API_KEY;
    const limit = 10;
    let neynarEndpoint = `https://api.neynar.com/v2/farcaster/feed/?api_key=${apiKey}&limit=${limit}`;

    if (parentUrl) {
      neynarEndpoint += `&feed_type=filter&filter_type=parent_url&parent_url=${parentUrl}`;
    } else if (fid) {
      neynarEndpoint += `&fid=${fid}`;
    }

    if (cursor) {
      neynarEndpoint += `&cursor=${cursor}`;
    }
    console.log('making request to neynar');
    await fetch(neynarEndpoint)
      .then((response) => response.json())
      .then((data) => {
        console.log('got response data', data);
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

  const scollToRef = useRef();
  // scroll to selected cast when selectedCastIdx changes
  useEffect(() => {
    if (scollToRef.current) {
      // @ts-ignore
      scollToRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [selectedCastIdx]);

  const getChannelForParentUrl = (parentUrl: string | null): ChannelType | undefined => parentUrl ?
    channels.find((channel) => channel.parent_url === parentUrl) : undefined;

  if (!account) {
    return <span className="font-semibold text-gray-200">Add account first</span>;
  }

  const renderCast = (cast: CastType, idx: number) => {
    const shouldRenderChannelTag = isEmpty(selectedChannelParentUrl);
    const channel = shouldRenderChannelTag ? getChannelForParentUrl(cast.parent_url) : null;
    const embedUrl = cast.embeds.length > 0 ? cast.embeds[0].url : null;
    const embedImageUrl = embedUrl?.endsWith('.png') || embedUrl?.endsWith('.jpg') ? embedUrl : null;
    const isSelectedCast = selectedCastIdx === idx;

    return (<>
      <img
        src={cast.author.pfp_url}
        alt=""
        className="relative mt-3 h-6 w-6 flex-none rounded-full bg-gray-50"
        referrerPolicy="no-referrer"
      />
      <div
        onClick={() => isSelectedCast ? onSelectCast(idx) : setSelectedCastIdx(idx)}
        className={classNames(
          isSelectedCast ? "bg-gray-700  ring-1 ring-inset ring-gray-700" : "",
          "flex-auto rounded-sm py-1.5 px-3 cursor-pointer"
        )}>
        <div className="flex justify-between gap-x-4">
          <div className="flex flex-row py-0.5 text-xs leading-5 text-gray-300">
            {cast.parent_hash && <ArrowUturnUpIcon className="w-4 h-4 text-gray-400" />}
            <span className="font-medium text-gray-100">@{cast.author.username} ({cast.author.display_name})</span>
            {shouldRenderChannelTag && channel && (
              <div className="flex flex-row">
                <span className="ml-1 -mt-0.5 inline-flex items-center rounded-sm bg-blue-400/10 px-1.5 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/30">
                  {channel.name}
                </span>
              </div>
            )}
          </div>
          <span className="flex-none py-0.5 text-xs leading-5 text-gray-500">
            {new Date(cast.timestamp).toLocaleString()}
          </span>
        </div>
        <p className="text-sm leading-6 text-gray-300">{cast.text}</p>
        {/* {embedImageUrl} */}
        {/* {isSelectedCast && embedImageUrl && (
          <img
            className="mt-2 h-96 object-left rounded-sm"
            src={embedImageUrl}
            alt=""
            referrerPolicy="no-referrer"
          />
        )} */}
      </div>
    </>)
  }


  return (
    <div>
      <ul role="list" className="divide-y divide-gray-700">
        {feed.map((cast: CastType, idx: number) => {
          return (
            <li key={cast.hash} ref={(selectedCastIdx === idx - 3) ? scollToRef : null
            }
              className="relative flex items-center space-x-4 py-2" >
              {renderCast(cast, idx)}
            </li>
          );
        })}
      </ul>
      {isLoadingFeed && (<span className="font-semibold text-gray-200">Loading...</span>)}
    </div >
  )
}
