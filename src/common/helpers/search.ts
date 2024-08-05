export enum SearchInterval {
    d1 = "1 day",
    d7 = "7 days",
    d30 = "30 days",
    m3 = "3 months"
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
};

const prepareSearchTerm = (term: string): string => {
    // remove from:username 
    // remove whitespaces in front and back
    return term.replace(/from:\S+/g, '').trim();
};

const getSearchUrl = ({
    searchTerm, filters, limit, offset, interval, orderBy, mentionFid, fromFid,
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


const TEXT_COLUMN = 'casts.text';
export const getTextMatchCondition = (term: string) => {
    term = term.trim();
    // Function to create exact match condition without word boundaries
    const exactMatch = (phrase: string) => `${TEXT_COLUMN} ~* '${phrase.replace(/'/g, "''")}'`;
    const hasBooleanOperators = (phrase: string) => /\b(AND|OR)\b/i.test(phrase);

    // Single word or quoted single word -> exact match with word boundaries
    if (!term.includes(' ') || (term.startsWith('"') && term.endsWith('"') && !term.slice(1, -1).includes(' '))) {
        const word = term.replace(/^"|"$/g, '');
        return `${TEXT_COLUMN} ~* '${word.replace(/'/g, "''")}'`;
    }

    // Combination of quotes and boolean operators
    if (term.includes('"') || term.includes('-') || hasBooleanOperators(term)) {
        const parts = term.match(/"[^"]+"|[^\s]+/g) || [];
        const conditions = parts.map(part => {
            if (part.toLowerCase() === 'and' || part.toLowerCase() === 'or') {
                return part.toUpperCase();
            } else if (part.startsWith('"') && part.endsWith('"')) {
                return exactMatch(part.slice(1, -1));
            }
            return `tsv @@ websearch_to_tsquery('english', '${part.replace(/'/g, "''")}')`; // Escape single quotes
        });
        // validate that every second element is a boolean operator
        // insert AND if not present
        for (let i = 1; i < conditions.length; i += 2) {
            if (!['and', 'or'].includes(conditions[i].toLowerCase())) {
                conditions.splice(i, 0, 'AND');
            }
        }
        return conditions.join(' ');
    }

    // Phrase (with or without quotes) -> exact match without word boundaries
    if (!term.includes('"') || (term.startsWith('"') && term.endsWith('"'))) {
        const phrase = term.replace(/^"|"$/g, '');
        return exactMatch(phrase);
    }

    if (!hasBooleanOperators(term)) {
        return `tsv @@ websearch_to_tsquery('english', '${term.replace(/'/g, "''")}')`;
        // Handle negated words and fallback to websearch_to_tsquery for other queries
        const words = term.split(' ');
        const conditions = words.map(word => {
            if (word.startsWith('-')) {
                return `tsv @@ websearch_to_tsquery('english', '${word.replace(/'/g, "''")}')`; // Escape single quotes
            } else {
                return `${TEXT_COLUMN} ~* '\\m${word.replace(/'/g, "''")}\\M'`;
            }
        });
        return conditions.join(' ');
    }

    return exactMatch(term);
};
