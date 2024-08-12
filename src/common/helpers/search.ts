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
    }
    const url = `/api/search?${params.toString()}`;
    return url;
};

export type SearchResponse = {
    results?: RawSearchResult[];
    error: string;
    isTimeout: boolean;
};

export const runFarcasterCastSearch = async (params: RunFarcasterCastSearchParams): Promise<SearchResponse> => {
    try {
        const searchUrl = getSearchUrl(params);
        const response = await fetch(searchUrl);
        const data = await response.json();
        console.log('searchResponseData', data)
        return data;
    } catch (error) {
        console.error("Failed to search for text", params.searchTerm, error);
        return { error: error as unknown as string, isTimeout: false };
    }
};


const TEXT_COLUMN = 'casts.text';
const LANGUAGE = 'english';

export const getTextMatchCondition = (term: string): string => {
    term = term.trim();

    if (isSingleWord(term)) {
        return createExactMatchCondition(removeQuotes(term));
    }

    if (hasComplexQuery(term)) {
        return handleComplexQuery(term);
    }

    if (isPhrase(term)) {
        return createExactMatchCondition(removeQuotes(term));
    }

    // temporary fix until DB is migrated
    return createExactMatchCondition(removeQuotes(term))
    // return createWebSearchQuery(term);
};

const isSingleWord = (term: string): boolean =>
    !term.includes(' ') || (isQuoted(term) && !term.slice(1, -1).includes(' '));

const isQuoted = (term: string): boolean =>
    term.startsWith('"') && term.endsWith('"');

const removeQuotes = (term: string): string =>
    term.replace(/^"|"$/g, '');

const hasComplexQuery = (term: string): boolean =>
    term.includes('"') || term.includes('-') || hasBooleanOperators(term);

const hasBooleanOperators = (term: string): boolean =>
    /\b(AND|OR)\b/i.test(term);

const isPhrase = (term: string): boolean =>
    !term.includes('"') || isQuoted(term);

const createExactMatchCondition = (phrase: string): string =>
    `${TEXT_COLUMN} ~* '\\m${escapeSingleQuotes(phrase)}\\M'`;

const createWebSearchQuery = (term: string): string =>
    `tsv @@ websearch_to_tsquery('${LANGUAGE}', '${escapeSingleQuotes(term)}')`;

const escapeSingleQuotes = (str: string): string =>
    str.replace(/'/g, "''");

const handleComplexQuery = (term: string): string => {
    const parts = term.match(/"[^"]+"|[^\s]+/g) || [];
    const conditions = parts.map(createCondition);
    insertMissingBooleanOperators(conditions);
    return conditions.join(' ');
};

const createCondition = (part: string): string => {
    if (isBooleanOperator(part)) {
        return part.toUpperCase();
    }
    if (isQuoted(part)) {
        return createExactMatchCondition(removeQuotes(part));
    }
    // temporary fix until DB is migrated
    return createExactMatchCondition(removeQuotes(part))
    // return createWebSearchQuery(part);
};

const isBooleanOperator = (part: string): boolean =>
    ['and', 'or'].includes(part.toLowerCase());

const insertMissingBooleanOperators = (conditions: string[]): void => {
    for (let i = 1; i < conditions.length; i += 2) {
        if (!isBooleanOperator(conditions[i])) {
            conditions.splice(i, 0, 'AND');
        }
    }
};
