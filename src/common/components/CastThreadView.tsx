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


export const CastThreadView = ({ cast, onBack, fid }: { cast: CastType, onBack: () => void, fid?: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [casts, setCasts] = useState<CastType[]>([]);
  const [selectedCastIdx, setSelectedCastIdx] = useState(0);

  const draftIdx = useNewPostStore(state => state.postDrafts.findIndex(draft => draft.parentCastId?.hash === cast?.hash));

  const {
    channels,
    selectedChannelIdx
  } = useAccountStore();

  const {
    addNewPostDraft
  } = useNewPostStore();

  const renderGoBackButton = () => (
    <button
      className="group md:-ml-2 flex flex-shrink inline-flex items-center px-2 py-1 border border-transparent shadow-sm text-sm font-medium rounded-sm text-gray-100 bg-gray-700 md:bg-gray-800 focus:outline-none"
      onClick={() => onBack()}
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

    loadData();
    console.log({ cast })
    addNewPostDraft({ parentCastId: { hash: cast.hash, fid: cast.author.fid } })
  }, [])

  const renderRow = (cast: CastType, idx: number) => (
    <li key={cast.hash}>
      <div className="relative py-2">
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
                isSelected={selectedCastIdx === idx}
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
  )


  const renderFeed = () => (
    <SelectableListWithHotkeys
      data={casts}
      selectedIdx={selectedCastIdx}
      setSelectedIdx={setSelectedCastIdx}
      renderRow={(item: any, idx: number) => renderRow(item, idx)}
    // onExpand={onOpenLinkInCast}
    // onSelect={onSelectCast}
    />
  )

  const renderThread = () => (
    <div className="flow-root">
      <ul role="list" className="-mb-8">
        {renderFeed()}
        {draftIdx && <li key={`new-post-parentHash-${cast.hash}`}>
          <NewPostEntry draftIdx={draftIdx} onPost={() => onBack()} hideChannel />
        </li>}
      </ul>
    </div>
  );

  return <div className="flex flex-col text-gray-100 text-lg mb-8">
    {!isLoading && (
      <div className="mb-4">
        {renderGoBackButton()}
      </div>
    )}
    {isLoading ? <Loading /> : renderThread()}
  </div>
}
