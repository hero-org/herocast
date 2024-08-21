/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { SelectableListWithHotkeys } from "@/common/components/SelectableListWithHotkeys";
import { CastRow } from "@/common/components/CastRow";
import { CastThreadView } from "@/common/components/CastThreadView";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useHotkeys } from "react-hotkeys-hook";
import { Key } from "ts-key-enum";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { useAccountStore } from "@/stores/useAccountStore";
import { useDataStore } from "@/stores/useDataStore";
import { getProfileFetchIfNeeded } from "@/common/helpers/profileUtils";
import isEmpty from "lodash.isempty";
import { useListStore } from "@/stores/useListStore";
import { map, uniq, debounce } from "lodash";
import SkeletonCastRow from "@/common/components/SkeletonCastRow";
import { Switch } from "@/components/ui/switch";
import { IntervalFilter } from "@/common/components/IntervalFilter";
import { getFromFidFromSearchTerm, getMentionFidFromSearchTerm, Interval, SearchResponse } from "@/common/helpers/search";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";
import { usePostHog } from "posthog-js/react";
import {
  runFarcasterCastSearch,
  RawSearchResult,
  SearchFilters,
} from "@/common/helpers/search";
import ManageListModal from "@/common/components/ManageListModal";
import { useNavigationStore } from "@/stores/useNavigationStore";
import ClickToCopyText from "@/common/components/ClickToCopyText";
import { Badge } from "@/components/ui/badge";
import { UUID } from "crypto";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;
const SEARCH_LIMIT_INITIAL_LOAD = 5;
const SEARCH_LIMIT_NEXT_LOAD = 10;

export const DEFAULT_FILTERS: SearchFilters = {
  onlyPowerBadge: true,
  interval: Interval.d7,
  hideReplies: true,
};

const intervals = [Interval.d1, Interval.d7, Interval.d14];

const FilterBadge = ({
  children,
  isActive,
  action,
}: {
  children: React.ReactNode;
  isActive: boolean;
  action: () => void;
}) => {
  return (
    <Badge
      className={cn(
        isActive && "text-foreground",
        " h-8 rounded-lg px-3 text-xs shadow-sm hover:bg-accent hover:text-accent-foreground hover:cursor-pointer"
      )}
      variant="outline"
      onClick={action}
    >
      {children}
    </Badge>
  );
};

export default function SearchPage() {
  const posthog = usePostHog();

  const [searchTerm, setSearchTerm] = useState("");
  const [casts, setCasts] = useState<CastWithInteractions[]>([]);
  const [castHashes, setCastHashes] = useState<RawSearchResult[]>([]);
  const [selectedCastIdx, setSelectedCastIdx] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [searchCounter, setSearchCounter] = useState(0);
  const [filterByPowerBadge, setFilterByPowerBadge] = useState(false);
  const [filterByHideReplies, setFilterByHideReplies] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const activeSearchCounter = useRef(0);
  const [interval, setInterval] = useState<Interval>();
  const [showFilter, setShowFilter] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [showCastThreadView, setShowCastThreadView] = useState(false);

  const { isManageListModalOpen, setIsManageListModalOpen } =
    useNavigationStore();
  const { addSearch, addList, setSelectedListId, lists } = useListStore();
  const selectedList = useListStore((state) =>
    state.selectedListId !== undefined
      ? state.lists.find((list) => list.id === state.selectedListId)
      : undefined
  );
  const canSearch = searchTerm.trim().length >= 3;
  const { updateSelectedCast } = useDataStore();

  const selectedAccount = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx]
  );
  const viewerFid = selectedAccount?.platformAccountId || APP_FID;

  const debouncedUserSearch = useCallback(
    debounce(async (term: string) => {
      if (term.length > 2 && viewerFid) {
        try {
          getMentionFidFromSearchTerm(term, viewerFid);
        } catch (error) {
          console.error("Error searching for users:", error);
        }
      }
    }, 300),
    [viewerFid]
  );

  useEffect(() => {
    debouncedUserSearch(searchTerm);
  }, [searchTerm, debouncedUserSearch]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get("search");
    if (searchParam) {
      setSearchTerm(searchParam);
      onSearch(searchParam, DEFAULT_FILTERS);
    }

    const listId = urlParams.get("list");
    if (listId) {
      setSelectedListId(listId as UUID);
    }

    // if navigating away, reset the selected cast
    return () => {
      updateSelectedCast();
      setSelectedListId();
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
    console.log("addCastHashes", newCastHashes?.length, "reset: ", reset);
    setCastHashes((prevCastHashes) =>
      uniq([...(reset ? [] : prevCastHashes), ...(newCastHashes || [])])
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
      setShowCastThreadView(false);
      posthog.capture("user_start_castSearch", {
        term,
      });
      const startedAt = Date.now();
      try {
        const mentionFid = await getMentionFidFromSearchTerm(term, viewerFid);
        const fromFid = await getFromFidFromSearchTerm(term, viewerFid);
        const searchResponse = await runFarcasterCastSearch({
          searchTerm: term,
          filters,
          mentionFid,
          fromFid,
          limit: SEARCH_LIMIT_INITIAL_LOAD,
        });
        if (activeSearchCounter.current !== newSearchCounter) {
          return;
        }
        const endedAt = Date.now();
        const searchResults = searchResponse.results || [];

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
        processSearchResponse(searchResponse, SEARCH_LIMIT_INITIAL_LOAD);
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

  const processSearchResponse = (response: SearchResponse, limit: number) => {
    const results = response.results || [];
    console.log("processSearchResponse - results", results.length);
    if (results.length < limit) {
      setHasMore(false);
    }
    if (results.length > 0) {
      addCastHashes(results, false);
    }
    const { isTimeout, error } = response;
    if (isTimeout) {
      setError(new Error("Search timed out - please try again"));
    } else if (error) {
      setError(new Error(error));
    }
    setIsLoading(false);
  };

  const onContinueSearch = () => {
    setIsLoading(true);
    posthog.capture("user_start_castSearch", {
      term: searchTerm,
    });
    runFarcasterCastSearch({
      searchTerm,
      filters: getFilters(),
      limit: SEARCH_LIMIT_NEXT_LOAD,
      orderBy: "timestamp DESC",
      offset: castHashes.length,
    }).then((response) => {
      posthog.capture("backend_returns_castSearch", {
        term: searchTerm,
        resultsCount: (response?.results || []).length,
      });
      processSearchResponse(response, SEARCH_LIMIT_NEXT_LOAD);
    });
  };

  const onSaveSearch = async () => {
    const newIdx = lists.reduce((max, list) => Math.max(max, list.idx), 0) + 1;

    const contents = {
      term: searchTerm,
      filters: getFilters(),
      enabled_daily_email: true,
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
    enabled: canSearch && !isLoading && !isManageListModalOpen,
  });

  useEffect(() => {
    const fetchCasts = async (newCastHashes: string[]) => {
      try {
        const neynarClient = new NeynarAPIClient(
          process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
        );
        const apiResponse = await neynarClient.fetchBulkCasts(newCastHashes, {
          viewerFid: Number(viewerFid),
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
  }, [castHashes, casts, viewerFid]);

  const renderSearchResultRow = (row: CastWithInteractions, idx: number) => (
    <li
      key={row.hash}
      className="border-b border-gray-700 relative flex items-center space-x-4 max-w-full md:max-w-2xl xl:max-w-4xl"
    >
      <CastRow
        cast={row}
        isSelected={selectedCastIdx === idx}
        onSelect={() => {
          setSelectedCastIdx(idx);
          setShowCastThreadView(true);
        }}
        showChannel
        showParentDetails
      />
    </li>
  );

  const onBack = useCallback(() => {
    setShowCastThreadView(false);
  }, []);

  const renderLoadMoreButton = () =>
    hasMore ? (
      <Button size="lg" disabled={isLoading} onClick={() => onContinueSearch()}>
        Load More
      </Button>
    ) : (
      <div className="flex flex-col">
        <div className="text-muted-foreground">
          No more results for {`"${searchTerm}"`} with your selected filters.
          Adjust your search to get more results.
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
    <FilterBadge
      action={() => setFilterByPowerBadge((prev) => !prev)}
      isActive={filterByPowerBadge}
    >
      Power Badge
      <img
        src="/images/ActiveBadge.webp"
        className="hidden md:flex ml-1 h-4 w-4"
        alt="power badge"
      />
      <Switch
        className="ml-1"
        aria-label="Toggle powerbadge"
        checked={filterByPowerBadge}
      />
    </FilterBadge>
  );

  const renderHideRepliesFilter = () => (
    <FilterBadge
      action={() => setFilterByHideReplies((prev) => !prev)}
      isActive={filterByHideReplies}
    >
      Hide replies
      <Switch
        className="ml-1"
        aria-label="Toggle hide replies"
        checked={filterByHideReplies}
      />
    </FilterBadge>
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
    <IntervalFilter
      intervals={intervals}
      defaultInterval={Interval.d7}
      updateInterval={setInterval}
    />
  );

  return (
    <div className="min-w-0 flex-1 px-6 py-4">
      {!showCastThreadView ? (
        <>
          <div className="w-full max-w-xl mt-2">
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2 w-full items-center">
              <div className="flex col-span-3 group">
                <Input
                  variantSize="lg"
                  value={searchTerm}
                  onChange={(e) => onChange(e.target.value)}
                  id="search"
                  placeholder="Search for casts or users..."
                  type="search"
                  name="search"
                  className={cn(
                    "rounded-r-none",
                    "border-none ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600",
                    isLoading ? "animate-pulse" : ""
                  )}
                  autoFocus
                />
                <Button
                  disabled={!canSearch}
                  size="lg"
                  type="button"
                  className="px-8 rounded-l-none"
                  onClick={() => onSearch()}
                >
                  Search
                </Button>
              </div>
              <div className="flex col-span-3 md:col-span-1 w-full">
                <Button
                  size="lg"
                  type="button"
                  variant="outline"
                  disabled={!searchTerm}
                  className="px-2 rounded-r-none w-1/2"
                  onClick={() => onSaveSearch()}
                >
                  Save
                </Button>
                <ClickToCopyText
                  disabled={!searchTerm}
                  className={cn("rounded-l-none border-l-0 w-1/2 px-4")}
                  buttonText="Share"
                  text={`https://app.herocast.xyz/search?search=${searchTerm}`}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 w-full gap-y-2 my-2 md:h-12 md:gap-x-2 ">
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  "px-4 col-span-2 md:col-span-1",
                  showFilter ? "bg-muted text-muted-foreground" : ""
                )}
                onClick={() => setShowFilter((prev) => !prev)}
              >
                <AdjustmentsHorizontalIcon className="h-5 w-5 mr-1" />
                Filters
              </Button>
              {showFilter && (
                <div
                  className={cn(
                    "w-full col-span-3 flex space-x-2 transition-all duration-200 md:justify-end",
                    showFilter ? "opacity-100" : "opacity-0"
                  )}
                >
                  {renderPowerBadgeFilter()}
                  {renderHideRepliesFilter()}
                  {renderIntervalFilter()}
                </div>
              )}
            </div>
          </div>
          {casts.length > 0 && (
            <span className="text-muted-foreground text-sm">
              {casts.length} casts {hasMore && "with more to load"}
            </span>
          )}
          {(isLoading || (castHashes.length !== 0 && casts.length === 0)) &&
            renderLoading()}
          {!error && !isLoading && searchCounter > 0 && isEmpty(casts) && (
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
            onSelect={(idx) => {
              setSelectedCastIdx(idx);
              setShowCastThreadView(true);
            }}
          />
          {castHashes.length > 0 && (
            <div className="flex justify-center my-8">
              {isLoading ? renderLoadingSpinner() : renderLoadMoreButton()}
            </div>
          )}
          {error && (
            <Alert variant="default" className="mb-4 max-w-xs">
              <InformationCircleIcon className="h-4 w-4" />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
          <ManageListModal
            open={isManageListModalOpen}
            onClose={() => setIsManageListModalOpen(false)}
          />
        </>
      ) : (
        <CastThreadView cast={casts[selectedCastIdx]} onBack={onBack} />
      )}
    </div>
  );
}
