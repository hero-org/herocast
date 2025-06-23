import React from 'react';
import { SearchFilters, SearchMode, SortType } from '@/services/searchService';
import { Badge } from '@/components/ui/badge';
import { Interval } from '@/common/types/types';
import { cn } from '@/lib/utils';

interface CompactSearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  className?: string;
}

interface FilterBadgeProps {
  children: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

const FilterBadge = ({ children, isActive, onClick }: FilterBadgeProps) => {
  return (
    <Badge
      className={cn(
        'h-8 rounded-lg px-3 text-xs shadow-sm hover:bg-accent hover:text-accent-foreground hover:cursor-pointer transition-colors',
        isActive && 'bg-primary text-primary-foreground hover:bg-primary/90'
      )}
      variant={isActive ? 'default' : 'outline'}
      onClick={onClick}
    >
      {children}
    </Badge>
  );
};

export function CompactSearchFilters({ filters, onFiltersChange, className }: CompactSearchFiltersProps) {
  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K], defaultValue: SearchFilters[K]) => {
    const currentValue = filters[key];
    updateFilter(key, currentValue === value ? defaultValue : value);
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {/* Time intervals */}
      <FilterBadge
        isActive={filters.interval === Interval.d1}
        onClick={() => toggleFilter('interval', Interval.d1, Interval.d7)}
      >
        24h
      </FilterBadge>
      <FilterBadge
        isActive={filters.interval === Interval.d7}
        onClick={() => toggleFilter('interval', Interval.d7, Interval.d7)}
      >
        7d
      </FilterBadge>
      <FilterBadge
        isActive={filters.interval === Interval.d14}
        onClick={() => toggleFilter('interval', Interval.d14, Interval.d7)}
      >
        14d
      </FilterBadge>

      {/* Sort options */}
      <FilterBadge
        isActive={filters.sortType === SortType.ALGORITHMIC}
        onClick={() => toggleFilter('sortType', SortType.ALGORITHMIC, SortType.DESC_CHRON)}
      >
        Most Engaging
      </FilterBadge>



      {/* Show active channel filter */}
      {filters.channelId && (
        <FilterBadge
          isActive={true}
          onClick={() => updateFilter('channelId', undefined)}
        >
          #{filters.channelId} ×
        </FilterBadge>
      )}

      {/* Show active author filter */}
      {filters.authorFid && (
        <FilterBadge
          isActive={true}
          onClick={() => updateFilter('authorFid', undefined)}
        >
          Author: {filters.authorFid} ×
        </FilterBadge>
      )}
    </div>
  );
}