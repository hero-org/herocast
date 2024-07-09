/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { SelectableListWithHotkeys } from "@/common/components/SelectableListWithHotkeys";
import { CastRow } from "@/common/components/CastRow";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useHotkeys } from "react-hotkeys-hook";
import { Key } from "ts-key-enum";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { useAccountStore } from "@/stores/useAccountStore";
import { useDataStore } from "@/stores/useDataStore";
import isEmpty from "lodash.isempty";
import { useListStore } from "@/stores/useListStore";
import { map, uniq } from "lodash";
import SkeletonCastRow from "@/common/components/SkeletonCastRow";
import { Switch } from "@/components/ui/switch";
import {
  SearchInterval,
  SearchIntervalFilter,
} from "@/common/components/SearchIntervalFilter";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";
import { BookmarkIcon } from "@heroicons/react/20/solid";
import { usePostHog } from "posthog-js/react";
import { SearchFilters } from "@/common/helpers/search";
import { searchForText } from "@/common/helpers/search";
import { RawSearchResult } from "@/common/helpers/search";

const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;
const SEARCH_LIMIT_INITIAL_LOAD = 4;
const SEARCH_LIMIT_NEXT_LOAD = 10;

export const DEFAULT_FILTERS: SearchFilters = {
  onlyPowerBadge: true,
  interval: SearchInterval.d7,
  hideReplies: true,
};

export default function SearchPage() {
  const posthog = usePostHog();

  const [searchTerm, setSearchTerm] = useState("");
  const [casts, setCasts] = useState<CastWithInteractions[]>([]);
  const [castHashes, setCastHashes] = useState<RawSearchResult[]>([]);
  const [selectedCastIdx, setSelectedCastIdx] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [searchCounter, setSearchCounter] = useState(0);
  const [filterByPowerBadge, setFilterByPowerBadge] = useState(true);
  const [filterByHideReplies, setFilterByHideReplies] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const activeSearchCounter = useRef(0);
  const [interval, setInterval] = useState<SearchInterval>();
  const [showFilter, setShowFilter] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const {
    searches,
    addSearch,
    addList,
    selectedList,
    updateSelectedList,
    lists,
  } = useListStore();
  const canSearch = searchTerm.trim().length >= 3;
  const lastSearchHasNoResults =
    searches[searches.length - 1]?.resultsCount === 0;
  const { updateSelectedCast } = useDataStore();

  const selectedAccount = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx]
  );

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get("search");
    if (searchParam) {
      setSearchTerm(searchParam);
      onSearch(searchParam, DEFAULT_FILTERS);
    }

    const listId = urlParams.get("list");
    if (listId) {
      const list = lists.find((list) => list.id === listId);
      updateSelectedList(list);
    }

    // if navigating away, reset the selected cast
    return () => {
      updateSelectedCast();
    };
  }, []);

  useEffect(() => {
    if (selectedCastIdx === -1) return;

    if (isEmpty(casts)) {
      updateSelectedCast();
    } else {
      updateSelectedCast(casts[selectedCastIdx]);
    }
  }, [selectedCastIdx, casts]);

  useEffect(() => {
    if (selectedList && selectedList.type === "search") {
      const { term, filters } = selectedList.contents as {
        term?: string;
        filters?: SearchFilters;
      };

      const { onlyPowerBadge } = filters || DEFAULT_FILTERS;
      setFilterByPowerBadge(onlyPowerBadge);

      if (term) {
        setSearchTerm(term);
        onSearch(term, filters || DEFAULT_FILTERS);
      }
    }
  }, [selectedList]);

  const onChange = async (text: string) => {
    setSearchTerm(text);
  };

  const addCastHashes = (newCastHashes: RawSearchResult[], reset: boolean) => {
    setCastHashes((prevCastHashes) =>
      uniq([...(reset ? [] : prevCastHashes), ...newCastHashes])
    );
  };

  const resetState = () => {
    setError(null);
    setIsLoading(true);
    setCasts([]);
    setCastHashes([]);
    setHasMore(true);
  };

  const getFilters = () => ({
    interval,
    orderBy: "timestamp DESC",
    onlyPowerBadge: filterByPowerBadge,
    hideReplies: filterByHideReplies,
  });

  const onSearch = useCallback(
    async (term?: string, filters?: SearchFilters) => {
      const newSearchCounter = searchCounter + 1;
      setSearchCounter(newSearchCounter);
      activeSearchCounter.current = newSearchCounter;

      if (!term) {
        term = searchTerm;
      }

      if (isEmpty(filters)) {
        filters = getFilters();
      }

      resetState();
      posthog.capture("user_start_castSearch", {
        term,
      });
      const startedAt = Date.now();
      try {
        const searchResults = await searchForText({
          searchTerm: term,
          filters,
          limit: SEARCH_LIMIT_INITIAL_LOAD,
        });
        if (activeSearchCounter.current !== newSearchCounter) {
          return;
        }

        const endedAt = Date.now();
        addSearch({
          term,
          startedAt,
          endedAt,
          resultsCount: searchResults.length,
        });
        posthog.capture("backend_returns_castSearch", {
          term,
          resultsCount: searchResults.length,
          duration: endedAt - startedAt,
        });
        if (searchResults.length > 0) {
          console.log(
            `setting cast hashes for term ${term} - initial - ${searchResults.length} results`
          );
          addCastHashes(searchResults, true);
          // use posthog to track event
        }
      } catch (error) {
        console.error("Failed to search for text", term, error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      searchCounter,
      searchTerm,
      filterByPowerBadge,
      filterByHideReplies,
      interval,
      posthog,
    ]
  );

  const onContinueSearch = () => {
    setIsLoading(true);
    searchForText({
      searchTerm,
      filters: getFilters(),
      limit: SEARCH_LIMIT_NEXT_LOAD,
      orderBy: "timestamp DESC",
      offset: castHashes.length,
    }).then((results) => {
      if (results.length < SEARCH_LIMIT_NEXT_LOAD) {
        setHasMore(false);
      }
      addCastHashes(results, false);
      setIsLoading(false);
    });
  };

  const onSaveSearch = async () => {
    const newIdx = lists.reduce((max, list) => Math.max(max, list.idx), 0) + 1;

    const contents = {
      term: searchTerm,
      filters: getFilters(),
    };
    addList({
      name: searchTerm,
      type: "search",
      contents,
      idx: newIdx,
      account_id: selectedAccount?.id,
    });
    posthog.capture("user_save_list", {
      contents,
    });
  };

  useHotkeys([Key.Enter, "meta+enter"], () => onSearch(), [onSearch], {
    enableOnFormTags: true,
    enabled: canSearch,
  });

  useEffect(() => {
    const fetchCasts = async (newCastHashes: string[]) => {
      try {
        const neynarClient = new NeynarAPIClient(
          process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
        );
        const apiResponse = await neynarClient.fetchBulkCasts(newCastHashes, {
          viewerFid: Number(selectedAccount?.platformAccountId || APP_FID),
        });
        const allCasts = [...casts, ...apiResponse.result.casts];
        const sortedCasts = allCasts.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setCasts(sortedCasts);
      } catch (error) {
        if (error instanceof Error) {
          setError(error);
        } else {
          setError(new Error(`Unknown error occurred ${error}`));
        }
        console.error("Failed to fetch casts", newCastHashes, error);
      }
    };
    const newCastHashes = map(castHashes, "hash").filter(
      (hash) => !casts.find((cast) => cast.hash === hash)
    );
    if (newCastHashes.length > 0) {
      fetchCasts(newCastHashes.slice(0, 2));
    }
  }, [castHashes, casts]);

  const renderSearchResultRow = (row: CastWithInteractions, idx: number) => (
    <li
      key={row.hash}
      className="border-b border-gray-700 relative flex items-center space-x-4 py-2 max-w-full md:max-w-2xl xl:max-w-4xl"
    >
      <CastRow
        cast={row}
        isSelected={selectedCastIdx === idx}
        onSelect={() => null}
        showChannel
      />
    </li>
  );

  const renderLoadMoreButton = () =>
    hasMore ? (
      <Button size="lg" disabled={isLoading} onClick={() => onContinueSearch()}>
        Load More
      </Button>
    ) : (
      <div className="flex flex-col">
        <div className="text-muted-foreground">
          No more results for {`"${searchTerm}"`} with your selected filters.
          Add more filters to refine your search and get results faster.
        </div>
        {renderTryAgainButton()}
      </div>
    );

  const renderLoadingSpinner = () => (
    <div className="flex items-center justify-center">
      <div className="flex space-x-3">
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce animation-delay-0" />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce animation-delay-200" />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce animation-delay-400" />
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className="my-8 w-full max-w-2xl space-y-8">
      {castHashes.length === 0 ? (
        <>
          <SkeletonCastRow />
          <SkeletonCastRow />
        </>
      ) : (
        castHashes
          .filter((obj) => !casts.some((cast) => cast.hash === obj.hash))
          .map((obj) => (
            <SkeletonCastRow key={`skeleton-${obj?.hash}`} text={obj.text} />
          ))
      )}
    </div>
  );

  const renderPowerBadgeFilter = () => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setFilterByPowerBadge((prev) => !prev)}
    >
      Power Badge
      <img
        src="/images/ActiveBadge.webp"
        className="ml-1 h-4 w-4"
        alt="power badge"
      />
      <Switch
        className="ml-1"
        aria-label="Toggle powerbadge"
        checked={filterByPowerBadge}
      />
    </Button>
  );

  const renderHideRepliesFilter = () => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setFilterByHideReplies((prev) => !prev)}
    >
      Hide replies
      <Switch
        className="ml-1"
        aria-label="Toggle hide replies"
        checked={filterByHideReplies}
      />
    </Button>
  );

  const renderTryAgainButton = () => (
    <Button
      size="sm"
      variant="outline"
      className="mt-1 w-20 mx-auto"
      disabled={!canSearch}
      onClick={() => onContinueSearch()}
    >
      Try again
    </Button>
  );

  const renderIntervalFilter = () => (
    <SearchIntervalFilter
      defaultInterval={SearchInterval.d7}
      updateInterval={setInterval}
    />
  );

  return (
    <div className="min-w-0 flex-1 p-6">
      <div className="w-full max-w-2xl">
        <label htmlFor="desktop-search" className="sr-only">
          Search
        </label>
        <div className="flex w-full max-w-xl items-center space-x-2">
          <Input
            variantSize="lg"
            value={searchTerm}
            onChange={(e) => onChange(e.target.value)}
            id="search"
            placeholder="Search for casts..."
            type="search"
            name="search"
            className={isLoading ? "animate-pulse" : ""}
            autoFocus
          />
          <Button
            disabled={!canSearch}
            size="lg"
            type="button"
            className="px-10"
            onClick={() => onSearch()}
          >
            Search
          </Button>

          <Button
            size="lg"
            type="button"
            variant="outline"
            className="group px-4"
            onClick={() => onSaveSearch()}
          >
            <BookmarkIcon className="group-hover:text-muted-foreground h-5 w-5 mr-1" />
            Save
          </Button>
        </div>
        <div className="flex w-full max-w-lg mt-2 h-12 space-x-2 ">
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "px-4",
              showFilter ? "bg-muted text-muted-foreground" : ""
            )}
            onClick={() => setShowFilter((prev) => !prev)}
          >
            <AdjustmentsHorizontalIcon className="h-5 w-5 mr-1" />
            Filters
          </Button>
          {showFilter && (
            <div
              className={`space-x-2 transition-all duration-200 ${
                showFilter ? "opacity-100" : "opacity-0"
              }`}
            >
              {renderPowerBadgeFilter()}
              {renderHideRepliesFilter()}
              {renderIntervalFilter()}
            </div>
          )}
        </div>
      </div>
      {(isLoading || (castHashes.length !== 0 && casts.length === 0)) &&
        renderLoading()}
      {!isLoading && lastSearchHasNoResults && (
        <div className="flex flex-col text-center mt-8 text-muted-foreground">
          <span>No results found</span>
          {renderTryAgainButton()}
        </div>
      )}
      <SelectableListWithHotkeys
        data={casts}
        renderRow={renderSearchResultRow}
        selectedIdx={selectedCastIdx}
        setSelectedIdx={setSelectedCastIdx}
        onSelect={(idx) => setSelectedCastIdx(idx)}
      />
      {castHashes.length > 0 && (
        <div className="flex justify-center my-8">
          {isLoading ? renderLoadingSpinner() : renderLoadMoreButton()}
        </div>
      )}
      {error && (
        <div className="text-center mt-8 text-red-500">
          Error: {error.message}
        </div>
      )}
    </div>
  );
}
