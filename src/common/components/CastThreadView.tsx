import React, { useEffect, useState } from "react";
import { CastType } from "@/common/constants/farcaster"
import { getNeynarCastThreadEndpoint } from "../helpers/neynar";
import { Loading } from "./Loading";
import { CastRow } from "./CastRow";
import { useAccountStore } from "@/stores/useAccountStore";
import NewPostEntry from "./NewPostEntry";
import { useNewPostStore } from "@/stores/useNewPostStore";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { SelectableListWithHotkeys } from "./SelectableListWithHotkeys";
import { openWindow } from "../helpers/navigation";

type CastThreadViewProps = {
  cast: { hash: string, author: { fid: string } };
  onBack?: () => void;
  fid?: string;
  isActive?: boolean;
};

export const CastThreadView = ({ cast, onBack, fid, isActive }: CastThreadViewProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [casts, setCasts] = useState<CastType[]>([]);
  const [selectedCastIdx, setSelectedCastIdx] = useState(0);

  const draftIdx = useNewPostStore(state => state.drafts && state.drafts.findIndex(draft => draft.parentCastId?.hash === cast?.hash));

  const {
    channels,
    selectedChannelIdx
  } = useAccountStore();

  const {
    addNewPostDraft,
    removePostDraft
  } = useNewPostStore();

  const renderGoBackButton = () => (
    <button
      className="group md:-ml-2 flex flex-shrink inline-flex items-center px-2 py-1 border border-transparent shadow-sm text-sm font-medium rounded-sm text-gray-100 bg-gray-700 md:bg-gray-800 focus:outline-none"
      onClick={() => onBack && onBack()}
    >
      <kbd className="hidden md:block mr-2 px-1.5 py-1 text-xs border rounded-md bg-gray-600 text-gray-300 border-gray-600 group-hover:bg-gray-500">
        Esc
      </kbd>
      <ArrowLeftIcon className="md:hidden mr-1 h-4 w-4 text-gray-400 group-hover:text-gray-300" aria-hidden="true" />
      <span className="group-hover:underline">
        back
      </span>
    </button>
  );

  useEffect(() => {
    const loadData = async () => {
      const neynarEndpoint = getNeynarCastThreadEndpoint({ castHash: cast.hash, fid });
      await fetch(neynarEndpoint)
        .then((response) => response.json())
        .then((resp) => {
          setCasts(resp.result.casts)
        })
        .catch((error) => {
          console.log({ error })
        })
        .finally(() => {
          setIsLoading(false)
        })
    }

    if (!cast) return;

    loadData();
    addNewPostDraft({ parentCastId: { hash: cast.hash, fid: cast.author.fid } })

    return () => {
      removePostDraft(draftIdx, true)
    }
  }, [cast?.hash])

  const onOpenLinkInCast = () => {
    const castInThread = casts[selectedCastIdx];
    if (castInThread?.embeds?.length === 0) return;

    const url = castInThread.embeds[0].url;
    openWindow(url);
  }

  const renderRow = (cast: CastType, idx: number) => (
    <li key={`cast-thread-${cast.hash}`}>
      <div className="relative py-2 px-2">
        {/* this is the left line */}
        {idx !== casts.length - 1 ? (
          <span className="rounded-lg absolute left-7 top-12 -ml-px h-[calc(100%-46px)] w-px bg-radix-slate10" aria-hidden="true" />
        ) : null}
        <div className="relative flex items-start space-x-3">
          <>
            <div className="relative">
              <img
                className="flex mt-3 h-10 w-10 items-center justify-center rounded-full bg-gray-400 ring-1 ring-radix-slate5"
                src={`https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_png,w_144/${cast.author?.pfp?.url}`}
                alt=""
              />
            </div>
            <div className="min-w-0 flex-1">
              <CastRow
                cast={cast}
                channels={channels}
                showChannel={selectedChannelIdx === null}
                isSelected={selectedCastIdx === idx}
                isThreadView
                showEmbed
              />
            </div>
          </>
        </div>
      </div>
    </li >
  )


  const renderFeed = () => (
    <SelectableListWithHotkeys
      data={casts}
      selectedIdx={selectedCastIdx}
      setSelectedIdx={setSelectedCastIdx}
      renderRow={(item: any, idx: number) => renderRow(item, idx)}
      onSelect={() => onOpenLinkInCast()}
      onExpand={() => null}
      isActive={isActive}
    />
  )

  const renderThread = () => (
    <div className="flow-root">
      {renderFeed()}
      {draftIdx !== -1 && <div className="mt-8 pl-8 max-w-xl" key={`new-post-parentHash-${cast?.hash}`}>
        <NewPostEntry draftIdx={draftIdx} onPost={() => onBack && onBack()} hideChannel />
      </div>}
    </div>
  );

  return <div className="flex flex-col text-gray-100 text-lg mb-8">
    {!isLoading && onBack && (
      <div className="mb-4">
        {renderGoBackButton()}
      </div>
    )}
    {isLoading ? <Loading /> : renderThread()}
  </div>
}
