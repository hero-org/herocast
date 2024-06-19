import React, { useEffect, useState } from "react";
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
import { useSearchStore } from "@/stores/useSearchStore";

const getSearchUrl = (
  searchTerm: string,
  limit?: number,
  offset?: number
): string => {
  let url = `/api/search?term=${searchTerm}`;
  if (limit) {
    url += `&limit=${limit}`;
  }
  if (offset) {
    url += `&offset=${offset}`;
  }
  return url;
};

const searchForText = async (searchTerm, limit?, offset?) => {
  try {
    const response = await fetch(getSearchUrl(searchTerm, limit, offset));
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

  const { searches, addSearch } = useSearchStore();
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
      onSearch();
    }
  }, []);

  useEffect(() => {
    if (selectedCastIdx === -1 || isEmpty(casts)) return;

    updateSelectedCast(casts[selectedCastIdx]);
  }, [selectedCastIdx, casts]);

  const onChange = async (text: string) => {
    setSearchTerm(text);
  };

  const onSearch = async () => {
    setIsLoading(true);
    setCasts([]);
    setCastHashes([]);

    const startedAt = Date.now();

    const searchResults = await searchForText(
      searchTerm,
      SEARCH_LIMIT_INITIAL_LOAD
    );
    setCastHashes(searchResults.map((cast) => cast.hash));
    const endedAt = Date.now();
    addSearch({
      term: searchTerm,
      startedAt,
      endedAt,
      resultsCount: searchResults.length,
    });

    if (searchResults.length === SEARCH_LIMIT_INITIAL_LOAD) {
      const moreResults = await searchForText(
        searchTerm,
        SEARCH_LIMIT_NEXT_LOAD,
        SEARCH_LIMIT_INITIAL_LOAD
      );
      setCastHashes([...castHashes, ...moreResults.map((cast) => cast.hash)]);
    }
    setIsLoading(false);
  };

  useHotkeys([Key.Enter, "meta+enter"], onSearch, [onSearch], {
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
        setCasts([...casts, ...apiResponse.result.casts]);
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
    <div className="my-8 w-full max-w-2xl">
      <div className="flex items-center justify-center">
        <div className="flex space-x-3">
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce animation-delay-0" />
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce animation-delay-200" />
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce animation-delay-400" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-w-0 flex-1 px-12 mt-12">
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
            placeholder="Search"
            type="search"
            name="search"
            autoFocus
            disabled={isLoading}
          />
          <Button
            disabled={isLoading || !canSearch}
            size="lg"
            type="button"
            onClick={() => onSearch()}
          >
            Search
          </Button>
        </div>
      </div>
      {isLoading && casts.length === 0 && renderLoadingSpinner()}
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
