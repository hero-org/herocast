import type { FarcasterCast } from '@/common/types/farcaster';
import { getProvider } from '@/lib/farcaster/providers';
import { Interval } from '../common/types/types';
import { SearchQueryBuilder } from './searchQueryBuilder';

// Type representing the result of cast lookups (matches Neynar API response structure)
export type CastsResult = {
  casts: FarcasterCast[];
};

export type RawSearchResult = {
  hash: string;
  fid: number;
  text: string;
  timestamp: string;
};

export enum SearchMode {
  LITERAL = 'literal',
  SEMANTIC = 'semantic',
  HYBRID = 'hybrid',
}

export enum SortType {
  DESC_CHRON = 'desc_chron',
  ALGORITHMIC = 'algorithmic',
}

export type SearchFilters = {
  interval?: Interval;
  mode?: SearchMode;
  sortType?: SortType;
  authorFid?: number;
  parentUrl?: string;
  channelId?: string;
};

export type SearchParams = {
  searchTerm: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
  interval?: string;
  orderBy?: string;
  mentionFid?: number;
  fromFid?: number;
  viewerFid?: string;
  // Direct Neynar API params
  q?: string;
  mode?: SearchMode;
  sortType?: SortType;
  authorFid?: number;
  parentUrl?: string;
  channelId?: string;
};

export type SearchResponse = {
  results?: RawSearchResult[];
  error?: string;
  isTimeout: boolean;
};

export class SearchService {
  async search(params: SearchParams): Promise<SearchResponse> {
    try {
      // Validate query syntax only if we have a search term
      if (params.searchTerm) {
        const validation = SearchQueryBuilder.validateQuery(params.searchTerm);
        if (!validation.valid) {
          return { error: validation.error, isTimeout: false };
        }
      }

      // Build query with advanced operators
      const queryBuilder = new SearchQueryBuilder(params.searchTerm || '');
      const { q, filters } = queryBuilder.buildQuery();

      // Extract from: username and convert to FID
      let authorFid = params.authorFid || params.filters?.authorFid;
      if (!authorFid && params.viewerFid && params.searchTerm) {
        const fromUsername = SearchQueryBuilder.extractFromUsername(params.searchTerm);
        if (fromUsername) {
          console.log('SearchService - Looking up user:', fromUsername);
          try {
            const users = await getProvider().searchUsers(fromUsername, Number(params.viewerFid), 1);
            const profile = users?.[0];
            console.log('SearchService - Profile lookup result:', profile);
            if (profile?.fid) {
              authorFid = profile.fid;
            } else {
              console.warn('SearchService - Could not find user:', fromUsername);
            }
          } catch (error) {
            console.error('SearchService - Error looking up user:', fromUsername, error);
          }
        }
      }

      // Remove from: operator from the query string
      const cleanQuery = SearchQueryBuilder.removeFromOperator(q);

      const searchParams: SearchParams = {
        ...params,
        q: cleanQuery, // Always use the cleaned query
        searchTerm: '', // Empty string instead of undefined
        authorFid: authorFid,
        channelId: params.channelId || filters.channelId,
        parentUrl: params.parentUrl || filters.parentUrl,
      };

      console.log('SearchService - Final search params:', {
        q: searchParams.q,
        authorFid: searchParams.authorFid,
        searchTerm: params.searchTerm,
        cleanQuery,
      });

      // Build filters for the provider
      const providerFilters: Record<string, string> = {};
      const mode = searchParams.mode || searchParams.filters?.mode;
      if (mode) providerFilters.mode = mode;
      const sortType = searchParams.sortType || searchParams.filters?.sortType;
      if (sortType) providerFilters.sortType = sortType;
      if (searchParams.authorFid) providerFilters.authorFid = searchParams.authorFid.toString();
      if (searchParams.parentUrl) providerFilters.parentUrl = searchParams.parentUrl;
      if (searchParams.channelId) providerFilters.channelId = searchParams.channelId;
      const interval = searchParams.filters?.interval;
      if (interval) {
        providerFilters.interval = interval;
      } else {
        providerFilters.interval = Interval.d7;
      }
      if (searchParams.viewerFid) providerFilters.viewerFid = searchParams.viewerFid;

      const searchResponse = await getProvider().searchCasts(
        searchParams.q || '',
        providerFilters,
        searchParams.limit,
        searchParams.offset
      );

      return {
        results: searchResponse.results,
        isTimeout: false,
      } as SearchResponse;
    } catch (error) {
      console.error('Search failed:', error);
      return { error: error instanceof Error ? error.message : String(error), isTimeout: false };
    }
  }

  async searchWithCasts(params: SearchParams): Promise<CastsResult> {
    const searchResponse = await this.search(params);
    const castHashes = searchResponse.results?.map((result) => result.hash) || [];

    // If no results, return empty response
    if (castHashes.length === 0) {
      return { casts: [] };
    }

    const viewerFid = params.viewerFid ? Number(params.viewerFid) : undefined;
    const casts = await getProvider().getCasts(castHashes, viewerFid);
    return { casts };
  }

  getTextMatchCondition(term: string): string {
    term = term.trim();

    if (this.isSingleWord(term)) {
      return this.createExactMatchCondition(this.removeQuotes(term));
    }

    if (term.includes(' OR ')) {
      return this.handlePhrasesWithOR(term);
    }

    if (this.hasComplexQuery(term)) {
      return this.handleComplexQuery(term);
    }

    if (this.isPhrase(term)) {
      return this.createExactMatchCondition(this.removeQuotes(term));
    }

    return this.createWebSearchQuery(term);
  }

  private isSingleWord(term: string): boolean {
    return !term.includes(' ') || (this.isQuoted(term) && !term.slice(1, -1).includes(' '));
  }

  private isQuoted(term: string): boolean {
    return term.startsWith('"') && term.endsWith('"');
  }

  private removeQuotes(term: string): string {
    return term.replace(/^"|"$/g, '');
  }

  private hasComplexQuery(term: string): boolean {
    return term.includes('"') || term.includes('-') || this.hasBooleanOperators(term);
  }

  private hasBooleanOperators(term: string): boolean {
    return /\b(AND|OR)\b/i.test(term);
  }

  private isPhrase(term: string): boolean {
    return !term.includes('"') || this.isQuoted(term);
  }

  private createExactMatchCondition(phrase: string): string {
    return `casts.text ~* '\\m${this.escapeSingleQuotes(phrase)}\\M'`;
  }

  private createWebSearchQuery(term: string): string {
    return `tsv @@ websearch_to_tsquery('english', '${this.escapeSingleQuotes(term)}')`;
  }

  private escapeSingleQuotes(str: string): string {
    return str.replace(/'/g, "''");
  }

  private handleComplexQuery(term: string): string {
    const parts = term.match(/"[^"]+"|[^\s]+/g) || [];
    const conditions = parts.map((part) => this.createCondition(part));
    this.insertMissingBooleanOperators(conditions);
    return conditions.join(' ');
  }

  private handlePhrasesWithOR(term: string): string {
    const parts = term.split(/\s+OR\s+/);
    return parts.map((part) => `(${this.createCondition(part)})`).join(' OR ');
  }

  private createCondition(part: string): string {
    if (this.isBooleanOperator(part)) {
      return part.toUpperCase();
    }
    if (this.isQuoted(part)) {
      return this.createExactMatchCondition(this.removeQuotes(part));
    }
    if (part.includes(' ')) {
      return this.createExactMatchCondition(part);
    }
    return this.createWebSearchQuery(part);
  }

  private isBooleanOperator(part: string): boolean {
    return ['and', 'or'].includes(part.toLowerCase());
  }

  private insertMissingBooleanOperators(conditions: string[]): void {
    for (let i = 1; i < conditions.length; i += 2) {
      if (!this.isBooleanOperator(conditions[i])) {
        conditions.splice(i, 0, 'AND');
      }
    }
  }

  static getSearchHelp(): string {
    return SearchQueryBuilder.getSearchHelp();
  }

  static validateQuery(query: string): { valid: boolean; error?: string } {
    return SearchQueryBuilder.validateQuery(query);
  }
}

export const searchService = new SearchService();
