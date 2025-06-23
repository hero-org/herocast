import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { CastsResponseResult } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { getProfileFetchIfNeeded } from '../common/helpers/profileUtils';
import { Interval } from '../common/types/types';
import { SearchQueryBuilder } from './searchQueryBuilder';

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
  private neynarClient: NeynarAPIClient | null = null;

  constructor() {
    if (typeof window === 'undefined' && process.env.NEXT_PUBLIC_NEYNAR_API_KEY) {
      this.neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY);
    }
  }

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
            const profile = await getProfileFetchIfNeeded({
              username: fromUsername,
              viewerFid: params.viewerFid,
            });
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

      const searchParams = {
        ...params,
        q: cleanQuery, // Always use the cleaned query
        searchTerm: undefined, // Clear searchTerm to force use of q
        authorFid: authorFid,
        channelId: params.channelId || filters.channelId,
        parentUrl: params.parentUrl || filters.parentUrl,
      };

      const searchUrl = this.buildSearchUrl(searchParams);
      console.log('SearchService - Final search params:', {
        q: searchParams.q,
        authorFid: searchParams.authorFid,
        searchTerm: params.searchTerm,
        cleanQuery,
      });
      const response = await fetch(searchUrl);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Search failed:', error);
      return { error: error as string, isTimeout: false };
    }
  }

  async searchWithCasts(params: SearchParams): Promise<CastsResponseResult> {
    const searchResponse = await this.search(params);
    const castHashes = searchResponse.results?.map((result) => result.hash) || [];

    if (!this.neynarClient) {
      this.neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
    }

    const apiResponse = await this.neynarClient.fetchBulkCasts(castHashes, {
      viewerFid: Number(params.viewerFid),
    });
    return apiResponse.result;
  }

  private buildSearchUrl(params: SearchParams): string {
    const urlParams = new URLSearchParams();

    // Use 'q' parameter for Neynar API
    if (params.q) {
      urlParams.append('q', params.q);
    } else if (params.searchTerm) {
      // Fallback to term for backward compatibility
      urlParams.append('term', params.searchTerm);
    }

    // Core search parameters
    if (params.limit) urlParams.append('limit', params.limit.toString());
    if (params.offset) urlParams.append('offset', params.offset.toString());
    if (params.viewerFid) urlParams.append('viewerFid', params.viewerFid);

    // Neynar API parameters
    if (params.mode || params.filters?.mode) {
      urlParams.append('mode', params.mode || params.filters.mode);
    }
    if (params.sortType || params.filters?.sortType) {
      urlParams.append('sortType', params.sortType || params.filters.sortType);
    }
    if (params.authorFid) {
      urlParams.append('authorFid', params.authorFid.toString());
    }
    if (params.parentUrl) {
      urlParams.append('parentUrl', params.parentUrl);
    }
    if (params.channelId) {
      urlParams.append('channelId', params.channelId);
    }

    // Filter parameters
    if (params.filters) {
      if (params.filters.interval) urlParams.append('interval', params.filters.interval);
    }

    if (!urlParams.get('interval')) {
      urlParams.set('interval', Interval.d7);
    }

    const baseUrl = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_URL || '';
    return `${baseUrl}/api/search?${urlParams.toString()}`;
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
