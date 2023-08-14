import React, { useEffect, useRef, useState } from "react";
import { classNames } from "@/common/helpers/css";
import { AccountObjectType, useAccountStore } from "@/stores/useAccountStore";
import { CastType } from "@/common/constants/farcaster";
import { channels, ChannelType } from "@/common/constants/channels";
import { useHotkeys } from "react-hotkeys-hook";
import uniqBy from 'lodash.uniqby';

export default function Feed() {
  const [feed, setFeed] = useState<CastType[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [nextFeedOffset, setNextFeedOffset] = useState("");
  const [selectedCastIdx, setSelectedCastIdx] = useState(0);
  const {
    accounts,
    selectedAccountIdx
  } = useAccountStore();

  const account: AccountObjectType = accounts[selectedAccountIdx];

  useHotkeys('j', () => {
    if (selectedCastIdx >= feed.length - 4) {
      const cursor = feed[feed.length - 1].timestamp;
      // unbounce this call to getFeed
      getFeed({ fid: account.platformAccountId, cursor });
    }

    if (selectedCastIdx === feed.length - 1) {
      return;
    }
    setSelectedCastIdx(selectedCastIdx + 1);
  }, [selectedCastIdx, account, feed, nextFeedOffset], {
  })

  useHotkeys('k', () => {
    if (selectedCastIdx === 0) {
      return;
    }
    setSelectedCastIdx(selectedCastIdx - 1);
  }, [selectedCastIdx], {
  })

  const getFeed = async ({ fid, parentUrl, cursor }: { fid: string, parentUrl?: string, cursor?: string }) => {
    if (isLoadingFeed) {
      return;
    }
    console.log('getFeed', { fid, parentUrl });
    setIsLoadingFeed(true);
    const apiKey = '';
    const limit = 10;
    let neynarEndpoint = `https://api.neynar.com/v2/farcaster/feed/?api_key=${apiKey}&limit=${limit}`;
    if (fid) {
      neynarEndpoint += `&fid=${fid}`;
    }

    if (parentUrl) {
      neynarEndpoint += `&feed_type=filter&filter_type=parent_url&parent_url=${parentUrl}`;
    }

    if (cursor) {
      neynarEndpoint += `&cursor=${cursor}`;
    }
    await fetch(neynarEndpoint)
      .then((response) => response.json())
      .then((data) => {
        console.log('data', data);
        setFeed(uniqBy(feed.concat(data.casts), 'hash'));
        setNextFeedOffset(data.next_offset);
      }).catch((err) => {
        console.log('err', err);
      }).finally(() => setIsLoadingFeed(false));
  }

  useEffect(() => {
    if (account && !nextFeedOffset && !isLoadingFeed) {
      getFeed({ fid: account.platformAccountId });
    }
  }, [account]);

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


  return (
    <div>
      <ul role="list" className="divide-y divide-white/5">
        {feed.map((cast: CastType, idx: number) => {
          const channel = getChannelForParentUrl(cast.parent_url);
          return (
            <li key={cast.hash} ref={selectedCastIdx === idx ? scollToRef : null}
              className="relative flex items-center space-x-4 py-4">
              <>
                <img
                  src={cast.author.pfp_url}
                  alt=""
                  className="relative mt-3 h-6 w-6 flex-none rounded-full bg-gray-50"
                />
                <div className={classNames(
                  selectedCastIdx === idx ? "bg-gray-700 ring-gray-500" : "bg-gray-800 ring-gray-600",
                  "flex-auto rounded-sm p-3 ring-1 ring-inset"
                )}>
                  <div className="flex justify-between gap-x-4">
                    <div className="py-0.5 text-xs leading-5 text-gray-300">
                      <span className="font-medium text-gray-100">@{cast.author.username} ({cast.author.display_name})</span>
                    </div>
                    <time dateTime={cast.timestamp} className="flex-none py-0.5 text-xs leading-5 text-gray-500">
                      {cast.timestamp}
                    </time>
                  </div>
                  <p className="text-sm leading-6 text-gray-300">{cast.text}</p>
                  {channel && (
                    <span className="inline-flex items-center rounded-md bg-blue-400/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/30">
                      {channel.name}
                    </span>
                  )}
                </div>
              </>
            </li>
          );
        })}
      </ul>
      {isLoadingFeed && (<span className="font-semibold text-gray-200">Loading...</span>)}
    </div>
  )
}
