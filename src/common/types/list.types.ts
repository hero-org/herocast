import type { Interval } from '@/common/types/types';
import type { SearchMode, SortType } from '@/services/searchService';
import type { Json } from './database.types';

type JsonRecord = { [key: string]: Json | undefined };

/**
 * Search filter options for list content
 */
export interface SearchFilters extends JsonRecord {
  orderBy?: string;
  interval?: Interval;
  mode?: SearchMode;
  sortType?: SortType;
  authorFid?: number;
  parentUrl?: string;
  channelId?: string;
}

/**
 * Content structure for search-type lists
 */
export interface SearchListContent extends JsonRecord {
  term: string;
  filters?: SearchFilters;
  enabled_daily_email?: boolean;
}

/**
 * Content structure for fids-type lists (user lists)
 */
export interface FidListContent extends JsonRecord {
  fids: string[];
  displayNames?: Record<string, string>; // Optional mapping of FIDs to display names
}

/**
 * Content structure for auto-interaction lists
 */
export interface AutoInteractionListContent extends JsonRecord {
  fids: string[]; // Target accounts to monitor
  displayNames?: Record<string, string>;
  sourceAccountId: string; // Account that will perform actions
  actionType: 'like' | 'recast' | 'both';
  onlyTopCasts: boolean; // Only interact with top-level casts
  requireMentions?: string[]; // Only act if these FIDs are mentioned
  lastProcessedHash?: string; // Track last processed cast
  // Content filters
  feedSource?: 'specific_users' | 'following'; // Default: specific_users
  requiredUrls?: string[]; // URLs that must be present in embeds
  requiredKeywords?: string[]; // Keywords that must be present in text
}

/**
 * Union type for all possible list content structures
 */
export type ListContent = SearchListContent | FidListContent | AutoInteractionListContent;

/**
 * Type guard to check if content is a search list
 */
export function isSearchListContent(content: unknown): content is SearchListContent {
  if (!content || typeof content !== 'object') {
    return false;
  }
  return 'term' in content;
}

/**
 * Type guard to check if content is a FID list
 */
export function isFidListContent(content: unknown): content is FidListContent {
  if (!content || typeof content !== 'object') {
    return false;
  }
  return 'fids' in content && Array.isArray(content.fids) && !('sourceAccountId' in content);
}

/**
 * Type guard to check if content is an auto-interaction list
 */
export function isAutoInteractionListContent(content: unknown): content is AutoInteractionListContent {
  if (!content || typeof content !== 'object') {
    return false;
  }
  return 'fids' in content && 'sourceAccountId' in content;
}
