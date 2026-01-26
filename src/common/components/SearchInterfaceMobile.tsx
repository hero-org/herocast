import { AdjustmentsHorizontalIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Interval } from '@/common/types/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { type SearchFilters, SortType } from '@/services/searchService';
import { SearchFiltersPanel } from './SearchFiltersPanel';

interface SearchInterfaceMobileProps {
  searchTerm: string;
  filters: SearchFilters;
  isLoading: boolean;
  canSearch: boolean;
  onSearchTermChange: (term: string) => void;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  onSaveSearch: () => void;
  className?: string;
}

export function SearchInterfaceMobile({
  searchTerm,
  filters,
  isLoading,
  canSearch,
  onSearchTermChange,
  onFiltersChange,
  onSearch,
  onSaveSearch,
  className,
}: SearchInterfaceMobileProps) {
  const [showFilters, setShowFilters] = useState(false);

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'interval') return value !== Interval.d7;
    if (key === 'sortType') return value !== SortType.DESC_CHRON;
    return value !== undefined && !Object.is(value, false) && value !== '';
  }).length;

  return (
    <div className={cn('w-full', className)}>
      {/* Search Bar */}
      <div className="space-y-3">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="Search casts..."
            className="pl-10 pr-10"
            onKeyPress={(e) => e.key === 'Enter' && canSearch && onSearch()}
            autoFocus
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
              onClick={() => onSearchTermChange('')}
            >
              <XMarkIcon className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button className="flex-1" disabled={!canSearch || isLoading} onClick={onSearch}>
            {isLoading ? 'Searching...' : 'Search'}
          </Button>

          <Button variant="outline" size="icon" onClick={() => setShowFilters(true)} className="relative">
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            {activeFiltersCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
              >
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Quick Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.interval !== Interval.d7 && (
            <Badge variant="secondary" className="whitespace-nowrap">
              {filters.interval}
            </Badge>
          )}
          {filters.channelId && (
            <Badge variant="secondary" className="whitespace-nowrap">
              #{filters.channelId}
            </Badge>
          )}
        </div>
      </div>

      {/* Filters Drawer */}
      <Drawer open={showFilters} onOpenChange={setShowFilters}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Search Filters</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <SearchFiltersPanel
              filters={filters}
              onFiltersChange={(newFilters) => {
                onFiltersChange(newFilters);
                setShowFilters(false);
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
