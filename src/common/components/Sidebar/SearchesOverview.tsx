import React from 'react';
import { SidebarHeader } from './SidebarHeader';
import { Badge } from '@/components/ui/badge';
import { Search, useListStore } from '@/stores/useListStore';
import { take } from 'lodash';
import sortBy from 'lodash.sortby';
import { isDev } from '@/common/helpers/env';
import { cn } from '@/lib/utils';

type SearchesOverviewProps = {
  onItemClick?: () => void;
};

const SearchesOverview = ({ onItemClick }: SearchesOverviewProps) => {
  const { searches, currentSearchTerm } = useListStore();
  const renderSearch = (search: Search) => {
    const isSelected = currentSearchTerm === search.term;
    return (
      <div key={`search-${search.startedAt}`} className="relative">
        {isSelected && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />}
        <div
          className={cn(
            'flex items-center gap-x-3 rounded-lg mx-1 px-3 py-1.5 text-sm cursor-pointer',
            isSelected
              ? 'bg-primary/20 text-foreground font-semibold'
              : 'text-foreground/70 hover:text-foreground hover:bg-sidebar/40'
          )}
          onClick={() => {
            // Set the current search term and navigate to search results
            useListStore.getState().setCurrentSearchTerm(search.term);
            if (onItemClick) onItemClick();
          }}
        >
          <span className="flex-1 truncate font-medium">{search.term}</span>
        </div>
        {isDev() && (
          <div className="flex flex-row gap-x-2 px-3 mt-1">
            <Badge variant="outline" className="text-xs">
              {search.resultsCount} results
            </Badge>
            <Badge variant="outline" className="text-xs">
              {(search.endedAt - search.startedAt) / 1000}s
            </Badge>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      <div className="px-3 py-1.5">
        <h3 className="text-sm font-semibold leading-6 text-foreground/90">Search History</h3>
      </div>
      <div className="space-y-0.5">
        {take(
          sortBy(searches, (s) => -s.endedAt),
          10
        ).map(renderSearch)}
      </div>
    </div>
  );
};

export default SearchesOverview;
