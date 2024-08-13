export enum SearchInterval {
    d1 = "1 day",
    d7 = "7 days",
    d30 = "30 days",
}

export type RawSearchResult = {
    hash: string;
    fid: number;
    text: string;
    timestamp: string;
};

export type SearchFilters = {
    onlyPowerBadge: boolean;
    interval?: SearchInterval;
    hideReplies: boolean;
};

export type RunFarcasterCastSearchParams = {
    searchTerm: string;
    filters?: SearchFilters;
    limit?: number;
    offset?: number;
    interval?: string;
    orderBy?: string;
    mentionFid?: number;
    fromFid?: number;
    baseUrl?: string;
};

const prepareSearchTerm = (term: string): string => {
    // remove from:username 
    // remove whitespaces in front and back
    return term.replace(/from:\S+/g, '').trim();
};

const getSearchUrl = ({
    searchTerm, filters, limit, offset, interval, orderBy, mentionFid, fromFid, baseUrl
}: RunFarcasterCastSearchParams): string => {
    const term = prepareSearchTerm(searchTerm);
    const params = new URLSearchParams({ term });
    if (limit) params.append("limit", limit.toString());
    if (offset) params.append("offset", offset.toString());
    if (interval) params.append("interval", interval);
    if (orderBy) params.append("orderBy", orderBy);
    if (mentionFid) params.append("mentionFid", mentionFid.toString());
    if (fromFid) {
        params.append('fromFid', fromFid.toString());
    }
    if (filters) {
        Object.keys(filters).forEach((key) => {
            if (filters[key] !== undefined) {
                params.set(key, filters[key].toString());
            }
        });
    }
    if (!params.get("interval")) {
        params.set("interval", SearchInterval.d7);
    }
    if (!baseUrl) {
        baseUrl = process.env.NEXT_PUBLIC_URL;
    }
    return `${baseUrl}/api/search?${params.toString()}`;
};

export const runFarcasterCastSearch = async (params: RunFarcasterCastSearchParams): Promise<RawSearchResult[]> => {
    try {
        const searchUrl = getSearchUrl(params);
        const response = await fetch(searchUrl);
        const data = await response.json();
        if (!data || data?.error) return [];

        return data;
    } catch (error) {
        console.error("Failed to search for text", params.searchTerm, error);
        return [];
    }
};
