import React, { useState, useEffect } from 'react';
import { SearchFilters, SearchMode, SortType } from '@/services/searchService';
import { SearchService } from '@/services/searchService';
import { SearchQueryBuilder } from '@/services/searchQueryBuilder';
import { SearchInterfaceMobile } from './SearchInterfaceMobile';
import { useMediaQuery } from '@/common/hooks/useMediaQuery';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Interval } from '@/common/types/types';
import { 
  MagnifyingGlassIcon, 
  AdjustmentsHorizontalIcon,
  QuestionMarkCircleIcon,
  XMarkIcon,
  SparklesIcon,
  ClockIcon,
  UserIcon,
  HashtagIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface SearchInterfaceProps {
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

export function SearchInterface({
  searchTerm,
  filters,
  isLoading,
  canSearch,
  onSearchTermChange,
  onFiltersChange,
  onSearch,
  onSaveSearch,
  className,
}: SearchInterfaceProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Use mobile interface on small screens
  if (isMobile) {
    return (
      <SearchInterfaceMobile
        searchTerm={searchTerm}
        filters={filters}
        isLoading={isLoading}
        canSearch={canSearch}
        onSearchTermChange={onSearchTermChange}
        onFiltersChange={onFiltersChange}
        onSearch={onSearch}
        onSaveSearch={onSaveSearch}
        className={className}
      />
    );
  }

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Check for from: and channel: operators in search term
  const fromUsername = SearchQueryBuilder.extractFromUsername(searchTerm);
  const channelFromQuery = searchTerm.match(/channel:([^\s]+)/)?.[1];
  
  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'interval') return value !== Interval.d7;
    if (key === 'sortType') return value !== SortType.DESC_CHRON;
    return value !== undefined && value !== false && value !== '';
  }).length + (fromUsername ? 1 : 0) + (channelFromQuery ? 1 : 0);

  const clearAllFilters = () => {
    onFiltersChange({
      interval: Interval.d7,
      sortType: SortType.DESC_CHRON,
    });
  };

  return (
    <div className={cn('w-full max-w-4xl', className)}>
      {/* Main Search Bar */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              placeholder="Search casts... (Try: from:username, channel:farcaster, before:2024-12-25)"
              className="pl-10 pr-10 h-12 text-base"
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
          
          <Button
            size="lg"
            disabled={!canSearch || isLoading}
            onClick={onSearch}
            className="h-12"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Searching
              </div>
            ) : (
              'Search'
            )}
          </Button>
        </div>

        {/* Controls Bar */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4 mr-1" />
              Advanced
            </Button>

            <Popover open={showHelp} onOpenChange={setShowHelp}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <QuestionMarkCircleIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96" align="start">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium mb-2">Search Tips</h4>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <code className="bg-muted px-1 py-0.5 rounded text-xs">from:username</code>
                        <span>Search posts from a specific user</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <code className="bg-muted px-1 py-0.5 rounded text-xs">channel:farcaster</code>
                        <span>Search within a channel</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <code className="bg-muted px-1 py-0.5 rounded text-xs">&quot;exact phrase&quot;</code>
                        <span>Search for an exact phrase</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <code className="bg-muted px-1 py-0.5 rounded text-xs">before:2024-12-25</code>
                        <span>Find posts before a date</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{SearchService.getSearchHelp()}
                    </pre>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-7 text-xs"
              >
                Clear filters ({activeFiltersCount})
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              disabled={!searchTerm}
              onClick={onSaveSearch}
              className="h-7"
            >
              Save Search
            </Button>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvanced && (
          <div className="mt-3 p-4 bg-muted/50 rounded-lg space-y-3 animate-in slide-in-from-top-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Time Period */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <ClockIcon className="h-3 w-3" />
                  Time Period
                </Label>
                <Select
                  value={filters.interval || Interval.d7}
                  onValueChange={(value) => updateFilter('interval', value as Interval)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Interval.d1}>Last 24 hours</SelectItem>
                    <SelectItem value={Interval.d7}>Last 7 days</SelectItem>
                    <SelectItem value={Interval.d30}>Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort Type */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <ClockIcon className="h-3 w-3" />
                  Sort By
                </Label>
                <Select
                  value={filters.sortType || SortType.DESC_CHRON}
                  onValueChange={(value) => updateFilter('sortType', value as SortType)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SortType.DESC_CHRON}>Latest First</SelectItem>
                    <SelectItem value={SortType.ALGORITHMIC}>Most Relevant</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Author FID */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <UserIcon className="h-3 w-3" />
                  Author FID
                </Label>
                <Input
                  type="number"
                  placeholder="e.g. 3621"
                  value={filters.authorFid || ''}
                  onChange={(e) => updateFilter('authorFid', e.target.value ? Number(e.target.value) : undefined)}
                  className="h-9"
                />
              </div>

              {/* Channel */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <HashtagIcon className="h-3 w-3" />
                  Channel
                </Label>
                <Input
                  placeholder="e.g. farcaster"
                  value={filters.channelId || ''}
                  onChange={(e) => updateFilter('channelId', e.target.value || undefined)}
                  className="h-9"
                />
              </div>

              {/* Parent URL */}
              <div className="space-y-1.5 md:col-span-4">
                <Label className="text-xs flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" />
                  Parent URL
                </Label>
                <Input
                  placeholder="Filter by parent cast URL"
                  value={filters.parentUrl || ''}
                  onChange={(e) => updateFilter('parentUrl', e.target.value || undefined)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Active Filters Summary */}
            {(activeFiltersCount > 0 || fromUsername || channelFromQuery) && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">Active filters:</span>
                <div className="flex flex-wrap gap-1">
                  {fromUsername && (
                    <Badge variant="secondary" className="text-xs">
                      from: {fromUsername}
                    </Badge>
                  )}
                  {channelFromQuery && !filters.channelId && (
                    <Badge variant="secondary" className="text-xs">
                      channel: {channelFromQuery}
                    </Badge>
                  )}
                  {filters.interval !== Interval.d7 && (
                    <Badge variant="secondary" className="text-xs">
                      {filters.interval?.replace(' days', 'd').replace(' day', 'd')}
                    </Badge>
                  )}
                  {filters.sortType !== SortType.DESC_CHRON && (
                    <Badge variant="secondary" className="text-xs">
                      Most Relevant
                    </Badge>
                  )}
                  {filters.authorFid && (
                    <Badge variant="secondary" className="text-xs">
                      Author: {filters.authorFid}
                    </Badge>
                  )}
                  {filters.channelId && (
                    <Badge variant="secondary" className="text-xs">
                      #{filters.channelId}
                    </Badge>
                  )}
                  {filters.parentUrl && (
                    <Badge variant="secondary" className="text-xs">
                      Has parent
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}