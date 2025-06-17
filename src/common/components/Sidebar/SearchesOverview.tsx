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
      <div key={`search-${search.startedAt}`} className="px-2">
        <div
          className={cn(
            'flex items-center gap-x-3 rounded-lg px-4 py-2.5 text-sm cursor-pointer',
            isSelected
              ? 'bg-primary text-primary-foreground shadow-sm font-medium'
              : 'text-foreground/70 hover:text-foreground hover:bg-sidebar/40'
          )}
          onClick={() => {
            // Set the current search term and navigate to search results
            useListStore.getState().setCurrentSearchTerm(search.term);
            if (onItemClick) onItemClick();
          }}
        >
          <span className="flex-1 truncate font-medium">{search.term}</span>
          {isSelected && <div className="ml-auto w-2 h-2 bg-primary-foreground rounded-full" />}
        </div>
        {isDev() && (
          <div className="flex flex-row gap-x-2 px-4 mt-1">
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
    <div className="space-y-2">
      <div className="px-4 py-2">
        <h3 className="text-sm font-semibold leading-6 text-foreground/90">Search History</h3>
      </div>
      <div className="space-y-1">
        {take(
          sortBy(searches, (s) => -s.endedAt),
          10
        ).map(renderSearch)}
      </div>
    </div>
  );
};

export default SearchesOverview;
