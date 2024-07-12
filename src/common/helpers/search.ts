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

export type SearchForTextParams = {
    searchTerm: string;
    filters?: SearchFilters;
    limit?: number;
    offset?: number;
    interval?: string;
    orderBy?: string;
};


const getSearchUrl = ({
    searchTerm, filters, limit, offset, interval, orderBy,
}: SearchForTextParams): string => {
    const params = new URLSearchParams({ term: searchTerm });
    if (limit) params.append("limit", limit.toString());
    if (offset) params.append("offset", offset.toString());
    if (interval) params.append("interval", interval);
    if (orderBy) params.append("orderBy", orderBy);
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

export const searchForText = async ({
    searchTerm, filters, limit, offset, interval, orderBy,
}: SearchForTextParams): Promise<RawSearchResult[]> => {
    try {
        const searchUrl = getSearchUrl({
            searchTerm,
            filters,
            limit,
            offset,
            interval,
            orderBy,
        });
        const response = await fetch(searchUrl);
        const data = await response.json();
        if (!data || data?.error) return [];

        return data;
    } catch (error) {
        console.error("Failed to search for text", searchTerm, error);
        return [];
    }
};
