import React, { useEffect, useState } from "react";
import { CastType } from "@/common/constants/farcaster"
import { getNeynarCastThreadEndpoint } from "../helpers/neynar";
import { Loading } from "./Loading";
import { CastRow } from "./CastRow";
import { useAccountStore } from "@/stores/useAccountStore";

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
    <div className="flow-root">
      <ul role="list" className="-mb-8">
        {casts.map((cast, idx) => (
          <li key={cast.hash}>
            <div className="relative pb-8">
              {/* this is the left line */}
              {idx !== casts.length - 1 ? (
                <span className="rounded-lg absolute left-3 top-12 -ml-px h-[calc(100%-46px)] w-px bg-radix-slate10" aria-hidden="true" />
              ) : null}
              <div className="relative flex items-start space-x-3">
                <>
                  <div className="relative">
                    <img
                      className="flex mt-3 h-6 w-6 items-center justify-center rounded-full bg-gray-400 ring-1 ring-radix-slate5"
                      src={`https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_png,w_144/${cast.author?.pfp?.url}`}
                      alt=""
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CastRow
                      cast={cast}
                      channels={channels}
                      showChannel={selectedChannelIdx === null}
                      isThreadView
                      showEmbed
                    /* isSelected={selectedCastIdx === idx} */
                    /* onSelect={() => selectedCastIdx === idx ? onSelectCast(idx) : setSelectedCastIdx(idx)} */
                    />
                  </div>
                </>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  return <div className="flex flex-col text-gray-100 text-lg">
    {isLoading ? <Loading /> : renderThread()}
    {!isLoading && (
      <div className="my-4">
        {renderGoBackButton()}
      </div>
    )}
  </div>
}
