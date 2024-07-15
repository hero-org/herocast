import { DEFAULT_FILTERS } from "pages/search";
import { SearchInterval } from "../components/SearchIntervalFilter";


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
    matchFid?: number;
    fromFid?: number;
};


const getSearchUrl = ({
    searchTerm, filters, limit, offset, interval, orderBy, matchFid, fromFid,
}: RunFarcasterCastSearchParams): string => {
    const params = new URLSearchParams({ term: searchTerm });
    if (limit) params.append("limit", limit.toString());
    if (offset) params.append("offset", offset.toString());
    if (interval) params.append("interval", interval);
    if (orderBy) params.append("orderBy", orderBy);
    if (matchFid) params.append("matchFid", matchFid.toString());
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
        params.set("interval", DEFAULT_FILTERS.interval!);
    } else if (params.get("interval") === SearchInterval.m3) {
        params.delete("interval");
    }
    const url = `/api/search?${params.toString()}`;
    return url;
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
