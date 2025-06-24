import { Json } from './database.types';

/**
 * Search filter options for list content
 */
export interface SearchFilters {
  orderBy?: string;
  interval?: string;
  mode?: 'literal' | 'semantic' | 'hybrid';
  sortType?: 'desc_chron' | 'algorithmic';
  authorFid?: number;
  parentUrl?: string;
  channelId?: string;
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
 * Content structure for auto-interaction lists
 */
export interface AutoInteractionListContent {
  fids: string[]; // Target accounts to monitor
  displayNames?: Record<string, string>;
  sourceAccountId: string; // Account that will perform actions
  actionType: 'like' | 'recast' | 'both';
  onlyTopCasts: boolean; // Only interact with top-level casts
  requireMentions?: string[]; // Only act if these FIDs are mentioned
  lastProcessedHash?: string; // Track last processed cast
}

/**
 * Union type for all possible list content structures
 */
export type ListContent = SearchListContent | FidListContent | AutoInteractionListContent;

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
  return content && typeof content === 'object' && 'fids' in content && Array.isArray(content.fids) && !('sourceAccountId' in content);
}

/**
 * Type guard to check if content is an auto-interaction list
 */
export function isAutoInteractionListContent(content: Json): content is AutoInteractionListContent {
  return content && typeof content === 'object' && 'fids' in content && 'sourceAccountId' in content;
}
