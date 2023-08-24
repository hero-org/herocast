import React, { useEffect, useState } from "react";
import { CastType } from "@/common/constants/farcaster"
import { getNeynarCastThreadEndpoint } from "../helpers/neynar";
import { Loading } from "./Loading";
import { CastRow } from "./CastRow";
import { useAccountStore } from "@/stores/useAccountStore";

// todo: cast in thread has slightly different structure
// pfps don't seem to render
// can auto expand images
// add up down selector hotkeys in list with j and k

export const CastThreadView = ({ cast, onBack, fid }: { cast: CastType, onBack: () => void, fid?: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [casts, setCasts] = useState<CastType[]>([]);

  console.log('cast thread', cast);

  const {
    channels,
    selectedChannelIdx
  } = useAccountStore();

  const renderGoBackButton = () => (
    <button
      className="flex flex-shrink inline-flex items-center -ml-2 px-2 py-1 border border-transparent shadow-sm text-sm font-medium rounded-sm text-gray-100 hover:bg-gray-700 focus:outline-none"
      onClick={() => onBack()}
    >
      <kbd className="mr-2 px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
        Esc
      </kbd>
      back to feed
    </button>
  );

  useEffect(() => {
    const loadData = async () => {
      const neynarEndpoint = getNeynarCastThreadEndpoint({ castHash: cast.hash, fid });
      await fetch(neynarEndpoint)
        .then((response) => response.json())
        .then((resp) => {
          console.log(resp.result.casts)
          setCasts(resp.result.casts)
        })
        .catch((error) => {
          console.log({ error })
        })
        .finally(() => {
          setIsLoading(false)
        })
    }

    loadData();
  }, [])

  const renderThread = () => (
    <ul role="list" className="border-b border-gray-700 divide-y divide-gray-700">
      {casts.map((cast: CastType, idx: number) => (
        <li key={cast.hash}
          className="relative flex items-center space-x-4 py-2 max-w-full md:max-w-2xl xl:max-w-4xl">
          <CastRow
            cast={cast}
            channels={channels}
            showChannel={selectedChannelIdx === null}
            showEmbed
          /* isSelected={selectedCastIdx === idx} */
          /* onSelect={() => selectedCastIdx === idx ? onSelectCast(idx) : setSelectedCastIdx(idx)} */
          />
        </li>
      ))}
    </ul>
  );

  return <div className="flex flex-col text-gray-100 text-lg">
    {isLoading ? <Loading /> : renderThread()}
    {!isLoading && (
      <div className="py-2 px-4">
        {renderGoBackButton()}
      </div>
    )}
  </div>
}
