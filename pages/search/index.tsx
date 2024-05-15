import React, { useEffect, useRef, useState } from "react";
import {
  InformationCircleIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import {
  searchForText,
  SearchResultCast,
} from "../../src/common/helpers/searchcaster";
import { SelectableListWithHotkeys } from "../../src/common/components/SelectableListWithHotkeys";
import debounce from "lodash.debounce";
import { CastRow } from "../../src/common/components/CastRow";
import { getUrlsInText } from "../../src/common/helpers/text";
import {
  CastWithInteractions,
  UserObjectEnum,
} from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { ActiveStatus } from "@neynar/nodejs-sdk/build/neynar-api/v2/openapi-recommendation";

type CastWithInteractions = {
  author: {
    fid: number;
    username: string;
    displayName: string;
    pfp_url: string;
    object: "user";
    display_name: string;
    custody_address: string;
    profile: {
      bio: {
        text: string;
        mentioned_profiles: never[];
      };
    };
    follower_count: number;
    following_count: number;
    verifications: any[];
    verified_addresses: {
      eth_addresses: any[];
      sol_addresses: any[];
    };
    active_status: "active";
  };
  hash: string;
  parent_author: {
    fid: number;
    username: string;
    displayName: string;
    pfp_url: string;
  };
  parent_hash: string;
  parent_url: string;
  reactions: {
    count: number;
    type: string;
    likes: number;
    recasts: number;
  };
  text: string;
  thread_hash: string;
  timestamp: string;
  embeds: string[];
  replies: {
    count: number;
  };
  mentioned_profiles: never[];
};

function transformToCastType(
  searchCasts: SearchResultCast[]
): CastWithInteractions[] {
  return searchCasts.map((searchCast) => ({
    author: {
      fid: -1,
      username: searchCast.body.username,
      displayName: searchCast.meta.displayName,
      pfp_url: searchCast.meta.avatar,
      object: UserObjectEnum.User,
      display_name: "",
      custody_address: "",
      profile: {
        bio: {
          text: "",
          mentioned_profiles: [],
        },
      },
      follower_count: -1,
      following_count: -1,
      verifications: [],
      verified_addresses: { eth_addresses: [], sol_addresses: [] },
      active_status: ActiveStatus.Active,
    },
    hash: searchCast.merkleRoot,
    parent_author: {
      fid: searchCast.meta.replyParentUsername.fid,
      username: searchCast.meta.replyParentUsername.username,
      displayName: searchCast.meta.replyParentUsername.username,
      pfp_url: "",
    },
    parent_hash: searchCast.body.data.replyParentMerkleRoot,
    parent_url: "",
    reactions: {
      count: searchCast.meta.reactions.count,
      type: searchCast.meta.reactions.type,
      likes: 0,
      recasts: 0,
    },
    text: searchCast.body.data.text,
    thread_hash: searchCast.body.data.threadMerkleRoot,
    timestamp: new Date(searchCast.body.publishedAt).toISOString(),
    embeds: getUrlsInText(searchCast.body.data.text).map((url) => url.url),
    replies: { count: searchCast.meta.numReplyChildren },
    mentioned_profiles: [],
  }));
}

export default function Search() {
  const [search, setSearch] = useState("");
  const [casts, setCasts] = useState<CastType[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  const onChange = async (text: string) => {
    setSearch(text);
  };

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
  }, [search]);

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const renderSearchResultRow = (row: CastType, idx: number) => (
    <li
      key={row.hash}
      className="border-b border-gray-700 relative flex items-center space-x-4 py-2 max-w-full md:max-w-2xl xl:max-w-4xl"
    >
      <CastRow
        cast={row}
        isSelected={selectedIdx === idx}
        onSelect={() => null}
        showChannel
      />
    </li>
  );

  return (
    <div className="min-w-0 flex-1 px-12 mt-12">
      <div className="w-full max-w-2xl">
        <label htmlFor="desktop-search" className="sr-only">
          Search
        </label>
        <div className="relative text-foreground/80 focus-within:text-foreground/80">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <input
            onChange={(e) => onChange(e.target.value)}
            id="search"
            className="block w-full rounded-md border-0 bg-white/20 py-2.5 pl-10 pr-3 text-foreground/80 placeholder:text-foreground focus:bg-white/30 focus:text-foreground focus:ring-0 focus:placeholder:text-gray-200 sm:text-sm sm:leading-6"
            placeholder="Search"
            type="search"
            name="search"
            autoFocus
          />
        </div>
      </div>
      <div className="mt-8 mb-8 w-full max-w-2xl rounded-sm bg-blue-800 p-3">
        <div className="flex">
          <div className="flex-shrink-0">
            <InformationCircleIcon
              className="h-5 w-5 text-blue-300"
              aria-hidden="true"
            />
          </div>
          <div className="ml-3 flex-1 md:flex md:justify-between">
            <p className="text-sm text-blue-300">
              early search prototype, liking and recasting doesn&apos;t work yet
              <br />
              use Cmd + Shift + F to cast feedback
            </p>
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
  );
}
