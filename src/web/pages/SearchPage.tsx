import isEmpty from 'lodash.isempty';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Key } from 'ts-key-enum';
import { CastThreadView } from '@/common/components/CastThreadView';
import { SearchInterface } from '@/common/components/SearchInterface';
import { SearchResultsView } from '@/common/components/SearchResultsView';
import { Interval } from '@/common/types/types';
import { useCastSearchInfinite } from '@/hooks/queries/useCastSearch';
import { useToast } from '@/hooks/use-toast';
import { type SearchFilters, SearchMode, SortType } from '@/services/searchService';
import { useAccountStore } from '@/stores/useAccountStore';
import { useListStore } from '@/stores/useListStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useRouter } from '@/web/lib/navigation';

const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;
const SEARCH_LIMIT_INITIAL_LOAD = 5;
const SEARCH_LIMIT_NEXT_LOAD = 10;

const DEFAULT_FILTERS: SearchFilters = {
  interval: Interval.d7,
  mode: SearchMode.LITERAL, // Default to literal mode
  sortType: SortType.DESC_CHRON,
};

export default function SearchPage() {
  const posthog = usePostHog();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCastIdx, setSelectedCastIdx] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false); // Track if search has been performed
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [showCastThreadView, setShowCastThreadView] = useState(false);
  const [submittedSearch, setSubmittedSearch] = useState<{
    term: string;
    filters: SearchFilters;
    requestId: number;
  } | null>(null);

  const router = useRouter();
  const { toast } = useToast();
  const { addSearch, addList, setSelectedListId, lists } = useListStore();
  const lastTrackedSearchIdRef = useRef<number | null>(null);
  const searchStartedAtRef = useRef(0);
  const selectedList = useListStore((state) =>
    state.selectedListId !== undefined ? state.lists.find((list) => list.id === state.selectedListId) : undefined
  );
  // Allow search if we have 3+ chars OR if we have valid operators like from: or channel: OR if we have filters set
  const hasValidOperators = /(?:from:|channel:|parent:|before:|after:)\S+/.test(searchTerm);
  const hasActiveFilters = Boolean(filters.authorFid || filters.channelId || filters.parentUrl);
  const canSearch = searchTerm.trim().length >= 3 || hasValidOperators || hasActiveFilters;
  const { updateSelectedCast, updateSelectedProfileFid } = useNavigationStore();

  const selectedAccount = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const viewerFid = selectedAccount?.platformAccountId || APP_FID;
  const searchQuery = useCastSearchInfinite(submittedSearch?.term ?? '', submittedSearch?.filters, viewerFid, {
    enabled: !!submittedSearch,
    initialLimit: SEARCH_LIMIT_INITIAL_LOAD,
    limit: SEARCH_LIMIT_NEXT_LOAD,
    queryKeyScope: { source: 'search-page' },
  });
  const casts = searchQuery.casts;
  const isLoading = searchQuery.isPending || searchQuery.isFetching;
  const hasMore = Boolean(searchQuery.hasNextPage);
  const error = searchQuery.error instanceof Error ? searchQuery.error : null;

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam) {
      setSearchTerm(searchParam);
      onSearch(searchParam, DEFAULT_FILTERS);
    }

    const listId = urlParams.get('list');
    if (listId) {
      setSelectedListId(listId);
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

  const getFilters = () => filters;
  const getSerializedSearch = (term: string, activeFilters: SearchFilters) =>
    JSON.stringify({
      term,
      interval: activeFilters.interval,
      mode: activeFilters.mode,
      sortType: activeFilters.sortType,
      authorFid: activeFilters.authorFid,
      parentUrl: activeFilters.parentUrl,
      channelId: activeFilters.channelId,
    });

  const onSearch = useCallback(
    async (term?: string, filters?: SearchFilters) => {
      if (!term) {
        term = searchTerm;
      }

      if (isEmpty(filters)) {
        filters = getFilters();
      }

      const nextFilters = filters || DEFAULT_FILTERS;
      const nextRequestId = Date.now();
      const nextSearch = {
        term,
        filters: nextFilters,
        requestId: nextRequestId,
      };
      const isSameSearch =
        submittedSearch &&
        getSerializedSearch(submittedSearch.term, submittedSearch.filters) === getSerializedSearch(term, nextFilters);

      setShowCastThreadView(false);
      setSelectedCastIdx(-1);
      setHasSearched(true); // Mark that a search has been performed
      searchStartedAtRef.current = Date.now();
      posthog.capture('user_start_castSearch', {
        term,
      });

      setSubmittedSearch(nextSearch);

      if (isSameSearch) {
        await searchQuery.refetch();
      }
    },
    [searchQuery, searchTerm, filters, posthog, submittedSearch]
  );

  useEffect(() => {
    if (!submittedSearch || searchQuery.isFetching || searchQuery.isError) return;
    if (lastTrackedSearchIdRef.current === submittedSearch.requestId) return;
    if (searchQuery.dataUpdatedAt < searchStartedAtRef.current) return;

    const endedAt = Date.now();
    addSearch({
      term: submittedSearch.term,
      startedAt: searchStartedAtRef.current,
      endedAt,
      resultsCount: searchQuery.totalResults,
    });
    posthog.capture('backend_returns_castSearch', {
      term: submittedSearch.term,
      resultsCount: searchQuery.totalResults,
      duration: endedAt - searchStartedAtRef.current,
    });
    lastTrackedSearchIdRef.current = submittedSearch.requestId;
  }, [
    submittedSearch,
    searchQuery.isFetching,
    searchQuery.isError,
    searchQuery.totalResults,
    searchQuery.dataUpdatedAt,
    addSearch,
    posthog,
  ]);

  const onContinueSearch = () => {
    if (!searchQuery.hasNextPage || searchQuery.isFetchingNextPage) return;
    void searchQuery.fetchNextPage();
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
    enabled: Boolean(canSearch) && !isLoading,
  });

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
              totalResults={searchQuery.totalResults}
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
