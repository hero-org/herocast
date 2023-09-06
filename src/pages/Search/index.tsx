import React, { useEffect, useRef, useState } from "react";
import { InformationCircleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { searchForText, SearchResultCast } from "@/common/helpers/searchcaster";
import { SelectableListWithHotkeys } from "@/common/components/SelectableListWithHotkeys";
import debounce from "lodash.debounce";
import { useAccountStore } from "@/stores/useAccountStore";
import { CastRow } from "@/common/components/CastRow";
import { CastType } from "@/common/constants/farcaster";


// export type CastType = {
//   author: AuthorType
//   hash: string
//   parent_author: AuthorType | { fid?: string } | null
//   parent_hash: string | null
//   parent_url: string | null
//   reactions: CastReactionsType
//   text: string
//   thread_hash: string | null
//   timestamp: string
//   embeds: EmbedType[]
//   replies: { count: number }
// }

// this transform isn't perfect yet
function transformToCastType(searchCasts: SearchResultCast[]): CastType[] {
  return searchCasts.map((searchCast) => ({
    author: {
      fid: '',
      username: searchCast.body.username,
      displayName: searchCast.meta.displayName,
      pfp_url: searchCast.meta.avatar,
    },
    hash: searchCast.merkleRoot,
    parent_author: {
      fid: '',
      username: searchCast.meta.replyParentUsername.username,
      displayName: searchCast.meta.replyParentUsername.username,
      pfp_url: '',
    },
    parent_hash: searchCast.body.data.replyParentMerkleRoot,
    parent_url: '',
    reactions: {
      count: searchCast.meta.reactions.count,
      type: searchCast.meta.reactions.type,
    },
    text: searchCast.body.data.text,
    thread_hash: searchCast.body.data.threadMerkleRoot,
    timestamp: new Date(searchCast.body.publishedAt).toISOString(),
    embeds: [],
    replies: { count: searchCast.meta.numReplyChildren },
  }))
}



export default function Search() {
  const [search, setSearch] = useState('');
  const [casts, setCasts] = useState<CastType[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  const {
    channels,
    selectedChannelIdx
  } = useAccountStore();

  const onChange = async (text: string) => {
    setSearch(text)
  }

  const debouncedSearch = useRef(
    debounce(async (text) => {
      setLoading(true);
      const searchCasts = await searchForText(text);
      setCasts(transformToCastType(searchCasts));
      setLoading(false);
    }, 200)
  ).current;

  useEffect(() => {
    if (search.length < 3) return;

    debouncedSearch(search);
  }, [search])

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const renderSearchResultRow = (row: CastType, idx: number) => (
    <li key={row.hash}
      className="border-b border-gray-700 relative flex items-center space-x-4 py-2 max-w-full md:max-w-2xl xl:max-w-4xl">
      <CastRow
        cast={row}
        channels={channels}
        showChannel={selectedChannelIdx === null}
        isSelected={selectedIdx === idx}
        onSelect={() => null}
      />
    </li>
  )

  return (
    <div className="min-w-0 flex-1 px-12 mt-12">
      <div className="w-full max-w-2xl">
        <label htmlFor="desktop-search" className="sr-only">
          Search
        </label>
        <div className="relative text-gray-300 focus-within:text-gray-100">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <input
            onChange={(e) => onChange(e.target.value)}
            id="search"
            className="block w-full rounded-sm border-0 bg-white/20 py-2.5 pl-10 pr-3 text-gray-300 placeholder:text-white focus:bg-white/30 focus:text-white focus:ring-0 focus:placeholder:text-gray-200 sm:text-sm sm:leading-6"
            placeholder="Search"
            type="search"
            name="search"
          />
        </div>
      </div>
      <div className="mb-8 w-full max-w-2xl rounded-sm bg-blue-800 p-3">
        <div className="flex">
          <div className="flex-shrink-0">
            <InformationCircleIcon className="h-5 w-5 text-blue-300" aria-hidden="true" />
          </div>
          <div className="ml-3 flex-1 md:flex md:justify-between">
            <p className="text-sm text-blue-300">early search prototype, liking and recasting doesn&apos;t work yet<br />use Cmd + Shift + F to cast feedback</p>
          </div>
        </div>
      </div>
      {loading && (
        <div className="my-8 w-full max-w-2xl">
          <div className="flex items-center justify-center">
            <div className="flex space-x-3">
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
            </div>
          </div>
        </div>
      )}
      <SelectableListWithHotkeys
        data={casts}
        renderRow={renderSearchResultRow}
        selectedIdx={selectedIdx}
        setSelectedIdx={setSelectedIdx}
        onSelect={(idx) => setSelectedIdx(idx)}
      />
    </div>
  )
}
