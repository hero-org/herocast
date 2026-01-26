import { InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Interval } from '@/common/types/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { type SearchFilters, SearchService, SortType } from '@/services/searchService';

interface SearchFiltersPanelProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  className?: string;
}

export function SearchFiltersPanel({ filters, onFiltersChange, className }: SearchFiltersPanelProps) {
  const [showHelp, setShowHelp] = useState(false);

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'interval') return value !== Interval.d7;
    if (key === 'sortType') return value !== SortType.DESC_CHRON;
    return value !== undefined && !Object.is(value, false) && value !== '';
  }).length;

  return (
    <div className={cn('space-y-4 p-4 border rounded-lg bg-background/50', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Search Filters</h3>
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeFiltersCount} active
            </Badge>
          )}
          <Popover open={showHelp} onOpenChange={setShowHelp}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <InformationCircleIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96">
              <div className="space-y-2">
                <h4 className="font-medium">Search Operators</h4>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{SearchService.getSearchHelp()}</pre>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Sort Type */}
        <div className="space-y-2">
          <Label htmlFor="sort-type">Sort By</Label>
          <Select
            value={filters.sortType || SortType.DESC_CHRON}
            onValueChange={(value) => updateFilter('sortType', value as SortType)}
          >
            <SelectTrigger id="sort-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SortType.DESC_CHRON}>Latest First</SelectItem>
              <SelectItem value={SortType.ALGORITHMIC}>Most Engaging</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Time Interval */}
        <div className="space-y-2">
          <Label htmlFor="interval">Time Period</Label>
          <Select
            value={filters.interval || Interval.d7}
            onValueChange={(value) => updateFilter('interval', value as Interval)}
          >
            <SelectTrigger id="interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={Interval.d1}>Last 24 hours</SelectItem>
              <SelectItem value={Interval.d7}>Last 7 days</SelectItem>
              <SelectItem value={Interval.d14}>Last 14 days</SelectItem>
              <SelectItem value={Interval.d30}>Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Author FID */}
        <div className="space-y-2">
          <Label htmlFor="author-fid">Author FID</Label>
          <Input
            id="author-fid"
            type="number"
            placeholder="Filter by author FID"
            value={filters.authorFid || ''}
            onChange={(e) => updateFilter('authorFid', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>

        {/* Channel ID */}
        <div className="space-y-2">
          <Label htmlFor="channel-id">Channel</Label>
          <Input
            id="channel-id"
            placeholder="e.g., farcaster"
            value={filters.channelId || ''}
            onChange={(e) => updateFilter('channelId', e.target.value || undefined)}
          />
        </div>

        {/* Parent URL */}
        <div className="space-y-2">
          <Label htmlFor="parent-url">Parent URL</Label>
          <Input
            id="parent-url"
            placeholder="Filter by parent cast URL"
            value={filters.parentUrl || ''}
            onChange={(e) => updateFilter('parentUrl', e.target.value || undefined)}
          />
        </div>
      </div>

      {/* Clear Filters */}
      {activeFiltersCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() =>
            onFiltersChange({
              interval: Interval.d7,
              sortType: SortType.DESC_CHRON,
            })
          }
        >
          <XMarkIcon className="h-4 w-4 mr-1" />
          Clear All Filters
        </Button>
      )}
    </div>
  );
}
