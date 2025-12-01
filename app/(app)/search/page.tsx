/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CastThreadView } from '@/common/components/CastThreadView';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { Button } from '@/components/ui/button';
import { useHotkeys } from 'react-hotkeys-hook';
import { Key } from 'ts-key-enum';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { useAccountStore } from '@/stores/useAccountStore';
import { useDataStore } from '@/stores/useDataStore';
import { getProfileFetchIfNeeded } from '@/common/helpers/profileUtils';
import isEmpty from 'lodash.isempty';
import { useListStore } from '@/stores/useListStore';
import { map, uniq, debounce } from 'lodash';
import { Interval } from '@/common/types/types';
import { cn } from '@/lib/utils';
import { usePostHog } from 'posthog-js/react';
import {
  searchService,
  SearchFilters,
  SearchResponse,
  RawSearchResult,
  SearchMode,
  SortType,
} from '@/services/searchService';
import { SearchInterface } from '@/common/components/SearchInterface';
import { SearchResultsView } from '@/common/components/SearchResultsView';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { UUID } from 'crypto';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/router';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;
const SEARCH_LIMIT_INITIAL_LOAD = 5;
const SEARCH_LIMIT_NEXT_LOAD = 10;

export const DEFAULT_FILTERS: SearchFilters = {
  interval: Interval.d7,
  mode: SearchMode.LITERAL, // Default to literal mode
  sortType: SortType.DESC_CHRON,
};

export default function SearchPage() {
  const posthog = usePostHog();

  const [searchTerm, setSearchTerm] = useState('');
  const [casts, setCasts] = useState<CastWithInteractions[]>([]);
  const [castHashes, setCastHashes] = useState<RawSearchResult[]>([]);
  const [selectedCastIdx, setSelectedCastIdx] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); // Track if search has been performed
  const [searchCounter, setSearchCounter] = useState(0);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [error, setError] = useState<Error | null>(null);
  const activeSearchCounter = useRef(0);
  const [hasMore, setHasMore] = useState(true);
  const [showCastThreadView, setShowCastThreadView] = useState(false);

  const router = useRouter();
  const { toast } = useToast();
  const { addSearch, addList, setSelectedListId, lists } = useListStore();
  const selectedList = useListStore((state) =>
    state.selectedListId !== undefined ? state.lists.find((list) => list.id === state.selectedListId) : undefined
  );
  // Allow search if we have 3+ chars OR if we have valid operators like from: or channel: OR if we have filters set
  const hasValidOperators = /(?:from:|channel:|parent:|before:|after:)\S+/.test(searchTerm);
  const hasActiveFilters = filters.authorFid || filters.channelId || filters.parentUrl;
  const canSearch = searchTerm.trim().length >= 3 || hasValidOperators || hasActiveFilters;
  const { updateSelectedCast, updateSelectedProfileFid } = useDataStore();

  const selectedAccount = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const viewerFid = selectedAccount?.platformAccountId || APP_FID;

  const debouncedUserSearch = useCallback(
    debounce(async (term: string) => {
      if (term.length > 2 && viewerFid) {
        try {
          // This is handled by SearchService now
        } catch (error) {
          console.error('Error searching for users:', error);
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
    const searchParam = urlParams.get('search');
    if (searchParam) {
      setSearchTerm(searchParam);
      onSearch(searchParam, DEFAULT_FILTERS);
    }

    const listId = urlParams.get('list');
    if (listId) {
      setSelectedListId(listId as UUID);
    }

    // if navigating away, reset the selected cast and profile
    return () => {
      updateSelectedCast();
      updateSelectedProfileFid();
      setSelectedListId();
    };
  }, []);

  useEffect(() => {
    if (selectedCastIdx === -1) return;

    if (isEmpty(casts)) {
      updateSelectedCast();
      updateSelectedProfileFid();
    } else {
      updateSelectedCast(casts[selectedCastIdx]);
      // Clear selectedProfileFid when selecting a cast (sidebar will use cast author)
      updateSelectedProfileFid();
    }
  }, [selectedCastIdx, casts, updateSelectedCast, updateSelectedProfileFid]);

  useEffect(() => {
    if (selectedList && selectedList.type === 'search') {
      const { term, filters } = selectedList.contents as {
        term?: string;
        filters?: SearchFilters;
      };

      setFilters(filters || DEFAULT_FILTERS);

      if (term) {
        setSearchTerm(term);
        onSearch(term, filters || DEFAULT_FILTERS);
      }
    }
  }, [selectedList]);

  const onChange = async (text: string) => {
    setSearchTerm(text);
    // Reset hasSearched if the user clears the search term
    if (!text.trim()) {
      setHasSearched(false);
    }
  };

  const addCastHashes = (newCastHashes: RawSearchResult[], reset: boolean) => {
    console.log('addCastHashes', newCastHashes?.length, 'reset: ', reset);
    setCastHashes((prevCastHashes) => uniq([...(reset ? [] : prevCastHashes), ...(newCastHashes || [])]));
  };

  const resetState = () => {
    setError(null);
    setIsLoading(true);
    setCasts([]);
    setCastHashes([]);
    setHasMore(true);
  };

  const getFilters = () => filters;

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
      setHasSearched(true); // Mark that a search has been performed
      posthog.capture('user_start_castSearch', {
        term,
      });
      const startedAt = Date.now();
      try {
        const searchResponse = await searchService.search({
          searchTerm: term,
          filters,
          viewerFid,
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
        posthog.capture('backend_returns_castSearch', {
          term,
          resultsCount: searchResults.length,
          duration: endedAt - startedAt,
        });
        processSearchResponse(searchResponse, SEARCH_LIMIT_INITIAL_LOAD);
      } catch (error) {
        console.error('Failed to search for text', term, error);
      } finally {
        setIsLoading(false);
      }
    },
    [searchCounter, searchTerm, filters, posthog]
  );

  const processSearchResponse = (response: SearchResponse, limit: number) => {
    const results = response.results || [];
    console.log('processSearchResponse - results', results.length);
    if (results.length < limit) {
      setHasMore(false);
    }
    if (results.length > 0) {
      addCastHashes(results, false);
    }
    const { isTimeout, error } = response;
    if (isTimeout) {
      setError(new Error('Search timed out - please try again'));
    } else if (error) {
      setError(new Error(error));
    }
    setIsLoading(false);
  };

  const onContinueSearch = () => {
    setIsLoading(true);
    posthog.capture('user_start_castSearch', {
      term: searchTerm,
    });
    searchService
      .search({
        searchTerm,
        filters: getFilters(),
        viewerFid,
        limit: SEARCH_LIMIT_NEXT_LOAD,
        orderBy: 'timestamp DESC',
        offset: castHashes.length,
      })
      .then((response) => {
        posthog.capture('backend_returns_castSearch', {
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
      enabled_daily_email: false,
    };

    const result = await addList({
      name: searchTerm,
      type: 'search',
      contents,
      idx: newIdx,
      account_id: selectedAccount?.id || undefined,
    });

    if (result.success) {
      posthog.capture('user_save_list', {
        contents,
      });

      toast({
        title: 'Search saved',
        description: `"${searchTerm}" has been saved to your lists`,
      });

      router.push('/lists?tab=search');
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  useHotkeys([Key.Enter, 'meta+enter'], () => onSearch(), [onSearch], {
    enableOnFormTags: true,
    enabled: canSearch && !isLoading,
  });

  useEffect(() => {
    const fetchCasts = async (newCastHashes: string[]) => {
      try {
        const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
        const apiResponse = await neynarClient.fetchBulkCasts(newCastHashes, {
          viewerFid: Number(viewerFid),
        });
        const allCasts = [...casts, ...apiResponse.result.casts];
        const sortedCasts = allCasts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setCasts(sortedCasts);
      } catch (error) {
        if (error instanceof Error) {
          setError(error);
        } else {
          setError(new Error(`Unknown error occurred ${error}`));
        }
        console.error('Failed to fetch casts', newCastHashes, error);
      }
    };
    const newCastHashes = map(castHashes, 'hash').filter((hash) => !casts.find((cast) => cast.hash === hash));
    if (newCastHashes.length > 0) {
      fetchCasts(newCastHashes.slice(0, 2));
    }
  }, [castHashes, casts, viewerFid]);

  const onBack = useCallback(() => {
    setShowCastThreadView(false);
  }, []);

  return (
    <div className="min-w-0 flex-1 px-6 py-4">
      {!showCastThreadView ? (
        <>
          <SearchInterface
            searchTerm={searchTerm}
            filters={filters}
            isLoading={isLoading}
            canSearch={canSearch}
            onSearchTermChange={onChange}
            onFiltersChange={setFilters}
            onSearch={() => onSearch()}
            onSaveSearch={onSaveSearch}
            className="mx-auto"
          />
          <div className="mt-6 max-w-4xl mx-auto">
            <SearchResultsView
              searchTerm={searchTerm}
              filters={filters}
              casts={casts}
              castHashes={castHashes}
              isLoading={isLoading}
              hasSearched={hasSearched}
              hasMore={hasMore}
              error={error}
              selectedCastIdx={selectedCastIdx}
              onCastSelect={(idx) => {
                setSelectedCastIdx(idx);
                setShowCastThreadView(true);
              }}
              onLoadMore={onContinueSearch}
            />
          </div>
        </>
      ) : (
        <CastThreadView cast={casts[selectedCastIdx]} onBack={onBack} />
      )}
    </div>
  );
}
