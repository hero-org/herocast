import React, { useCallback, useEffect, useRef, useState } from "react";
import { SelectableListWithHotkeys } from "../../src/common/components/SelectableListWithHotkeys";
import { CastRow } from "../../src/common/components/CastRow";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useHotkeys } from "react-hotkeys-hook";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Key } from "ts-key-enum";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { useAccountStore } from "@/stores/useAccountStore";
import NewCastModal from "@/common/components/NewCastModal";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { useDataStore } from "@/stores/useDataStore";
import isEmpty from "lodash.isempty";
import { useListStore } from "@/stores/useListStore";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@/components/ui/skeleton";
import { uniq } from "lodash";

const getSearchUrl = (
  searchTerm: string,
  limit?: number,
  offset?: number,
  interval?: string,
  orderBy?: string
): string => {
  const params = new URLSearchParams({ term: searchTerm });
  if (limit) params.append("limit", limit.toString());
  if (offset) params.append("offset", offset.toString());
  if (interval) params.append("interval", interval);
  if (orderBy) params.append("orderBy", orderBy);
  const url = `/api/search?${params.toString()}`;
  console.log("getSearchUrl", url);
  return url;
};

type SearchForTextParams = {
  searchTerm: string;
  limit?: number;
  offset?: number;
  interval?: string;
  orderBy?: string;
};

const searchForText = async ({
  searchTerm,
  limit,
  offset,
  interval,
  orderBy,
}: SearchForTextParams) => {
  try {
    const response = await fetch(
      getSearchUrl(searchTerm, limit, offset, interval, orderBy)
    );
    const data = await response.json();
    if (!data || data?.error) return [];
    return data;
  } catch (error) {
    console.error("Failed to search for text", searchTerm, error);
    return [];
  }
};

const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;
const SEARCH_LIMIT_INITIAL_LOAD = 6;
const SEARCH_LIMIT_NEXT_LOAD = 10;
const SEARCH_LIMIT = SEARCH_LIMIT_INITIAL_LOAD + SEARCH_LIMIT_NEXT_LOAD - 1;

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [casts, setCasts] = useState<CastWithInteractions[]>([]);
  const [castHashes, setCastHashes] = useState<string[]>([]);
  const [selectedCastIdx, setSelectedCastIdx] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [searchCounter, setSearchCounter] = useState(0);
  const activeSearchCounter = useRef(0);

  const { searches, addSearch, addList, selectedList, updateSelectedList, lists } = useListStore();
  const canSearch = searchTerm.length >= 3;
  const { selectedCast, updateSelectedCast } = useDataStore();
  const { isNewCastModalOpen, openNewCastModal, closeNewCastModal } =
    useNavigationStore();

  const selectedAccount = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx]
  );

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get("search");
    if (searchParam) {
      setSearchTerm(searchParam);
      onSearch(searchParam);
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
    if (selectedCastIdx === -1 || isEmpty(casts)) return;

    updateSelectedCast(casts[selectedCastIdx]);
  }, [selectedCastIdx, casts]);

  useEffect(() => {
    if (selectedList && selectedList.type === "search") {
      const { term } = selectedList.contents as { term?: string };
      if (term) {
        setSearchTerm(term);
        onSearch(term);
      }
    }
  }, [selectedList]);

  const onChange = async (text: string) => {
    setSearchTerm(text);
  };

  const addCastHashes = (newCastHashes: string[]) => {
    setCastHashes(uniq([...castHashes, ...newCastHashes]));
  };

  const onSearch = useCallback(
    async (term?: string) => {
      const newSearchCounter = searchCounter + 1;
      setSearchCounter(newSearchCounter);
      activeSearchCounter.current = newSearchCounter;

      if (!term) {
        term = searchTerm;
      }

      setIsLoading(true);
      setCasts([]);
      setCastHashes([]);

      const startedAt = Date.now();

      try {
        const searchResults = await searchForText({
          searchTerm: term,
          limit: SEARCH_LIMIT_INITIAL_LOAD,
          interval: "3 days",
        });
        if (activeSearchCounter.current !== newSearchCounter) {
          return;
        }
        if (searchResults.length > 0) {
          addCastHashes(searchResults.map((cast) => cast.hash));
          const endedAt = Date.now();
          addSearch({
            term,
            startedAt,
            endedAt,
            resultsCount: searchResults.length,
          });
        }
        const moreResults = await searchForText({
          searchTerm: term,
          limit: SEARCH_LIMIT_NEXT_LOAD,
          orderBy: "timestamp DESC",
        });
        if (activeSearchCounter.current !== newSearchCounter) {
          return;
        }
        if (moreResults.length > 0) {
          addCastHashes(moreResults.map((cast) => cast.hash));
        }
      } catch (error) {
        console.error("Failed to search for text", term, error);
      } finally {
        setIsLoading(false);
      }
    },
    [searchCounter, searchTerm]
  );

  const onSaveSearch = async () => {
    const newIdx = lists.reduce((max, list) => Math.max(max, list.idx), 0) + 1;

    addList({
      name: searchTerm,
      type: "search",
      contents: { term: searchTerm },
      idx: newIdx,
      account_id: selectedAccount?.id,
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
        console.error("Failed to fetch casts", newCastHashes, error);
      }
    };

    const newCastHashes = castHashes.filter(
      (hash) => !casts.find((cast) => cast.hash === hash)
    );
    if (newCastHashes.length > 0) {
      fetchCasts(newCastHashes.slice(0, 5));
    }
  }, [castHashes, casts]);

  const renderDebugMetrics = () => (
    <Table className="mb-8">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Duration</TableHead>
          <TableHead>Results</TableHead>
          <TableHead>Search</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {searches.map((metric) => (
          <TableRow key={metric.startedAt}>
            <TableCell className="font-medium">
              {metric.endedAt - metric.startedAt}
            </TableCell>
            <TableCell>{metric.resultsCount}</TableCell>
            <TableCell>{metric.term}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

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

  const renderNewCastModal = () => (
    <NewCastModal
      open={isNewCastModalOpen}
      setOpen={(isOpen) => (isOpen ? openNewCastModal() : closeNewCastModal())}
      linkedCast={selectedCast}
    />
  );

  const renderLoadMoreButton = () => (
    <div className="flex justify-center my-8">
      <Button
        size="lg"
        disabled={isLoading}
        onClick={() => {
          setIsLoading(true);
          searchForText(searchTerm, SEARCH_LIMIT_NEXT_LOAD, casts.length).then(
            (results) => {
              setCastHashes([
                ...castHashes,
                ...results.map((cast) => cast.hash),
              ]);
              setIsLoading(false);
            }
          );
        }}
      >
        Load More
      </Button>
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

  const renderLoading = () => {
    const renderSkeletonRow = () => (
      <div className="flex items-start space-x-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/4 rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
        </div>
      </div>
    );

    return (
      <div className="my-8 w-full max-w-2xl space-y-8">
        {castHashes.length === 0 ? (
          <>
            {renderSkeletonRow()}
            {renderSkeletonRow()}
          </>
        ) : (
          castHashes.map(renderSkeletonRow)
        )}
      </div>
    );
  };

  return (
    <div className="min-w-0 flex-1 p-6">
      <div className="w-full max-w-2xl">
        <label htmlFor="desktop-search" className="sr-only">
          Search
        </label>
        <div className="flex w-full max-w-lg items-center space-x-2">
          <Input
            variantSize="lg"
            value={searchTerm}
            onChange={(e) => onChange(e.target.value)}
            id="search"
            placeholder="New search..."
            type="search"
            name="search"
            autoFocus
          />
          <Button
            disabled={!canSearch}
            size="lg"
            type="button"
            onClick={() => onSearch()}
          >
            Search
          </Button>
          <Button
            size="lg"
            type="button"
            variant="outline"
            className="px-4"
            onClick={() => onSaveSearch()}
          >
            <PlusCircleIcon className="h-5 w-5 mr-1" />
            Save
          </Button>
        </div>
      </div>
      {isLoading && casts.length === 0 && renderLoading()}
      <SelectableListWithHotkeys
        data={casts}
        renderRow={renderSearchResultRow}
        selectedIdx={selectedCastIdx}
        setSelectedIdx={setSelectedCastIdx}
        onSelect={(idx) => setSelectedCastIdx(idx)}
      />
      {casts.length >= SEARCH_LIMIT &&
        (isLoading ? renderLoadingSpinner() : renderLoadMoreButton())}
      {renderNewCastModal()}
    </div>
  );
}
