// Shared search service for Supabase edge functions
// This is a minimal version that can work in Deno environment

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
  onlyPowerBadge?: boolean;
  interval?: string;
  hideReplies?: boolean;
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
  baseUrl?: string;
};

export type RawSearchResult = {
  hash: string;
  fid: number;
  text: string;
  timestamp: string;
};

export type SearchResponse = {
  results?: RawSearchResult[];
  error?: string;
  isTimeout: boolean;
};

export class SearchService {
  async search(params: SearchParams): Promise<SearchResponse> {
    try {
      const searchUrl = this.buildSearchUrl(params);
      const response = await fetch(searchUrl);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Search failed:', error);
      return { error: error as string, isTimeout: false };
    }
  }

  private buildSearchUrl(params: SearchParams): string {
    const term = this.prepareSearchTerm(params.searchTerm);
    const urlParams = new URLSearchParams({ term });

    // Add all parameters
    if (params.limit) urlParams.append('limit', params.limit.toString());
    if (params.offset) urlParams.append('offset', params.offset.toString());
    if (params.interval) urlParams.append('interval', params.interval);
    if (params.orderBy) urlParams.append('orderBy', params.orderBy);
    if (params.mentionFid) urlParams.append('mentionFid', params.mentionFid.toString());
    if (params.fromFid) urlParams.append('fromFid', params.fromFid.toString());

    // Add filter parameters
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && !urlParams.has(key)) {
          urlParams.set(key, value.toString());
        }
      });
    }

    // Default interval if not set
    if (!urlParams.get('interval')) {
      urlParams.set('interval', '7 days');
    }

    const baseUrl = params.baseUrl || Deno.env.get('BASE_URL') || '';
    return `${baseUrl}/api/search?${urlParams.toString()}`;
  }

  private prepareSearchTerm(term: string): string {
    return term.replace(/from:\S+/g, '').trim();
  }
}

export const searchService = new SearchService();

// Legacy compatibility export
export const runFarcasterCastSearch = async (params: SearchParams): Promise<SearchResponse> => {
  return searchService.search(params);
};
