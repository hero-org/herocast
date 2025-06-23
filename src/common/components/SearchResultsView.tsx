import React from 'react';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { CastRow } from '@/common/components/CastRow';
import { Button } from '@/components/ui/button';
import { SearchFilters } from '@/services/searchService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InformationCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import SkeletonCastRow from '@/common/components/SkeletonCastRow';
import { RawSearchResult } from '@/services/searchService';

interface SearchResultsViewProps {
  searchTerm: string;
  filters: SearchFilters;
  casts: CastWithInteractions[];
  castHashes: RawSearchResult[];
  isLoading: boolean;
  hasSearched: boolean;
  hasMore: boolean;
  error: Error | null;
  selectedCastIdx: number;
  onCastSelect: (idx: number) => void;
  onLoadMore: () => void;
}

export function SearchResultsView({
  searchTerm,
  filters,
  casts,
  castHashes,
  isLoading,
  hasSearched,
  hasMore,
  error,
  selectedCastIdx,
  onCastSelect,
  onLoadMore,
}: SearchResultsViewProps) {
  // Empty state - only show if a search has been performed
  if (!isLoading && casts.length === 0 && hasSearched) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="bg-muted rounded-full p-4 mb-4">
          <MagnifyingGlassIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No results found</h3>
        <p className="text-muted-foreground text-center max-w-md">
          Try adjusting your search terms or filters to find what you&apos;re looking for.
        </p>
      </div>
    );
  }

  // If not searched yet and not loading, don't show anything
  if (!hasSearched && !isLoading) {
    return null;
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertDescription>{error.message || 'An error occurred while searching. Please try again.'}</AlertDescription>
      </Alert>
    );
  }

  // Initial loading state - show skeletons only for the first search
  if (isLoading && casts.length === 0 && castHashes.length === 0) {
    return (
      <div className="my-8 space-y-4">
        <SkeletonCastRow />
        <SkeletonCastRow />
        <SkeletonCastRow />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Results count */}
      {casts.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            {casts.length} results {hasMore && '(more available)'}
          </p>
          {filters.sortType === 'algorithmic' && (
            <Badge variant="outline" className="text-xs">
              Sorted by relevance
            </Badge>
          )}
        </div>
      )}

      {/* Cast list */}
      <div className="space-y-2">
        {casts.map((cast, idx) => (
          <div key={cast.hash} className="border rounded-lg transition-colors hover:bg-muted/50">
            <CastRow
              cast={cast}
              isSelected={selectedCastIdx === idx}
              onSelect={() => onCastSelect(idx)}
              showChannel
              showParentDetails
            />
          </div>
        ))}
      </div>

      {/* Loading more indicator */}
      {isLoading && casts.length > 0 && (
        <div className="space-y-2 opacity-60">
          {castHashes
            .filter((obj) => !casts.some((cast) => cast.hash === obj.hash))
            .slice(0, 3)
            .map((obj) => (
              <SkeletonCastRow key={`skeleton-${obj.hash}`} text={obj.text} />
            ))}
        </div>
      )}

      {/* Load more button */}
      {!isLoading && hasMore && casts.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={onLoadMore} className="min-w-[200px]">
            Load More Results
          </Button>
        </div>
      )}

      {/* No more results */}
      {!hasMore && casts.length > 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">No more results for &quot;{searchTerm}&quot;</p>
          <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters to see more results</p>
        </div>
      )}
    </div>
  );
}

// Missing import fix
const Badge = ({
  children,
  variant = 'default',
  className = '',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'outline';
  className?: string;
}) => (
  <span
    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
      variant === 'outline' ? 'border border-border bg-background' : 'bg-primary text-primary-foreground'
    } ${className}`}
  >
    {children}
  </span>
);
