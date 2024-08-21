import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { getProfileFetchIfNeeded } from './profileUtils';
import { CastsResponseResult } from '@neynar/nodejs-sdk/build/neynar-api/v2';

export enum Interval {
  d1 = '1 day',
  d7 = '7 days',
  d14 = '14 days',
  d30 = '30 days',
}

export type RawSearchResult = {
  hash: string;
  fid: number;
  text: string;
  timestamp: string;
};

export type SearchFilters = {
  onlyPowerBadge: boolean;
  interval?: Interval;
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
  searchTerm,
  filters,
  limit,
  offset,
  interval,
  orderBy,
  mentionFid,
  fromFid,
}: RunFarcasterCastSearchParams): string => {
  const term = prepareSearchTerm(searchTerm);
  const params = new URLSearchParams({ term });
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());
  if (interval) params.append('interval', interval);
  if (orderBy) params.append('orderBy', orderBy);
  if (mentionFid) params.append('mentionFid', mentionFid.toString());
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
  if (!params.get('interval')) {
    params.set('interval', Interval.d7);
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
  console.log('runFarcasterCastSearch', params);
  try {
    const searchUrl = getSearchUrl(params);
    const response = await fetch(searchUrl);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to search for text', params.searchTerm, error);
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

  if (term.includes(' OR ')) {
    return handlePhrasesWithOR(term);
  }

  if (hasComplexQuery(term)) {
    return handleComplexQuery(term);
  }

  if (isPhrase(term)) {
    return createExactMatchCondition(removeQuotes(term));
  }

  return createWebSearchQuery(term);
};

const isSingleWord = (term: string): boolean =>
  !term.includes(' ') || (isQuoted(term) && !term.slice(1, -1).includes(' '));

const isQuoted = (term: string): boolean => term.startsWith('"') && term.endsWith('"');

const removeQuotes = (term: string): string => term.replace(/^"|"$/g, '');

const hasComplexQuery = (term: string): boolean =>
  term.includes('"') || term.includes('-') || hasBooleanOperators(term);

const hasBooleanOperators = (term: string): boolean => /\b(AND|OR)\b/i.test(term);

const isPhrase = (term: string): boolean => !term.includes('"') || isQuoted(term);

const createExactMatchCondition = (phrase: string): string => `${TEXT_COLUMN} ~* '\\m${escapeSingleQuotes(phrase)}\\M'`;

const createWebSearchQuery = (term: string): string =>
  `tsv @@ websearch_to_tsquery('${LANGUAGE}', '${escapeSingleQuotes(term)}')`;

const escapeSingleQuotes = (str: string): string => str.replace(/'/g, "''");

const handleComplexQuery = (term: string): string => {
  const parts = term.match(/"[^"]+"|[^\s]+/g) || [];
  const conditions = parts.map(createCondition);
  insertMissingBooleanOperators(conditions);
  return conditions.join(' ');
};

const handlePhrasesWithOR = (term: string): string => {
  const parts = term.split(/\s+OR\s+/);
  return parts.map((part) => `(${createCondition(part)})`).join(' OR ');
};

const createCondition = (part: string): string => {
  if (isBooleanOperator(part)) {
    return part.toUpperCase();
  }
  if (isQuoted(part)) {
    return createExactMatchCondition(removeQuotes(part));
  }
  if (part.includes(' ')) {
    return createExactMatchCondition(part);
  }
  return createWebSearchQuery(part);
};

const isBooleanOperator = (part: string): boolean => ['and', 'or'].includes(part.toLowerCase());

const insertMissingBooleanOperators = (conditions: string[]): void => {
  for (let i = 1; i < conditions.length; i += 2) {
    if (!isBooleanOperator(conditions[i])) {
      conditions.splice(i, 0, 'AND');
    }
  }
};

export const getMentionFidFromSearchTerm = async (term: string, viewerFid: string) => {
  const isOneWordSearch = !/\s/.test(term.trim());
  if (!isOneWordSearch) {
    return;
  }
  const profile = await getProfileFetchIfNeeded({
    username: term.trim(),
    viewerFid,
  });
  return profile?.fid;
};

export const getFromFidFromSearchTerm = async (term: string, viewerFid: string) => {
  const fromIndex = term.indexOf('from:');
  if (fromIndex === -1) {
    return;
  }

  const fromTerm = term.match(/from:([^\s]+)/);
  if (!fromTerm) {
    return;
  }

  const from = fromTerm[1];
  const profile = await getProfileFetchIfNeeded({
    username: from,
    viewerFid,
  });
  return profile?.fid;
};

type getCastsFromSearchProps = {
  term: string;
  viewerFid: string;
  limit: number;
  filters: SearchFilters;
  offset: number;
};

export const getCastsFromSearch = async ({
  term,
  viewerFid,
  limit,
  filters,
  offset,
}: getCastsFromSearchProps): Promise<CastsResponseResult> => {
  const mentionFid = await getMentionFidFromSearchTerm(term, viewerFid);
  const fromFid = await getFromFidFromSearchTerm(term, viewerFid);
  console.log('getCastsFromSearch', term, filters);
  const searchResponse = await runFarcasterCastSearch({
    searchTerm: term,
    filters,
    mentionFid,
    fromFid,
    limit,
    offset,
  });
  const castHashes = searchResponse.results?.map((result) => result.hash) || [];
  const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
  const apiResponse = await neynarClient.fetchBulkCasts(castHashes, {
    viewerFid: Number(viewerFid),
  });
  return apiResponse.result;
};
