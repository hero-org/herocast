import { Json } from './database.types';

/**
 * Search filter options for list content
 */
export interface SearchFilters {
  orderBy?: string;
  hideReplies?: boolean;
  onlyPowerBadge?: boolean;
  interval?: string;
}

/**
 * Content structure for search-type lists
 */
export interface SearchListContent {
  term: string;
  filters?: SearchFilters;
  enabled_daily_email?: boolean;
}

/**
 * Content structure for fids-type lists (user lists)
 */
export interface FidListContent {
  fids: string[];
  displayNames?: Record<string, string>; // Optional mapping of FIDs to display names
}

/**
 * Union type for all possible list content structures
 */
export type ListContent = SearchListContent | FidListContent;

/**
 * Type guard to check if content is a search list
 */
export function isSearchListContent(content: Json): content is SearchListContent {
  return content && typeof content === 'object' && 'term' in content;
}

/**
 * Type guard to check if content is a FID list
 */
export function isFidListContent(content: Json): content is FidListContent {
  return content && typeof content === 'object' && 'fids' in content && Array.isArray(content.fids);
}
