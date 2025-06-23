import axios from 'axios';
import type { NextApiRequest, NextApiResponse } from 'next';
import { SearchQueryBuilder } from '@/services/searchQueryBuilder';
import { getProfileFetchIfNeeded } from '@/common/helpers/profileUtils';

export const config = {
  maxDuration: 20, // Max duration for the API route
};

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/cast/search';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    term,
    q, // Direct Neynar query parameter
    limit = 10,
    offset = 0,
    priorityMode = false,
    mode = 'literal',
    sortType = 'desc_chron',
    authorFid,
    viewerFid,
    parentUrl,
    channelId,
    fromFid,
    mentionFid,
    // Legacy filters
    interval,
  } = req.query;

  // Use q parameter if provided, otherwise use term
  const searchQuery = q || term;

  // Check if query has valid operators
  const hasValidOperators = searchQuery && /(?:from:|channel:|parent:|before:|after:)\S+/.test(searchQuery as string);

  // Validate the search query - but allow empty query if we have filters or operators
  // Allow empty searches when filters are provided
  const hasFilters = authorFid || channelId || parentUrl || fromFid || mentionFid;
  if (!searchQuery && !hasFilters) {
    return res.status(400).json({ error: 'Invalid search query. Provide a search term or at least one filter.' });
  }
  if (searchQuery && typeof searchQuery !== 'string') {
    return res.status(400).json({ error: 'Invalid search query type.' });
  }
  if (searchQuery && searchQuery.length < 3 && !hasFilters && !hasValidOperators) {
    return res.status(400).json({
      error:
        'Invalid search query. Minimum 3 characters required unless filtering by author, channel, or using operators.',
    });
  }

  // Validate query syntax only if we have a query
  if (searchQuery) {
    const validation = SearchQueryBuilder.validateQuery(searchQuery as string);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
  }

  const timeout = setTimeout(() => {
    res.status(503).json({ error: TIMEOUT_ERROR_MESSAGE, results: [], isTimeout: true });
  }, timeoutThreshold);

  try {
    // Build query with advanced operators only if we have a search query
    let processedQuery = '';
    let filters: any = {};
    let finalAuthorFid = authorFid;

    if (searchQuery) {
      const queryBuilder = new SearchQueryBuilder(searchQuery as string);
      const result = queryBuilder.buildQuery();
      processedQuery = result.q;
      filters = result.filters;

      // Extract from: username if present
      if (!finalAuthorFid && viewerFid) {
        const fromUsername = SearchQueryBuilder.extractFromUsername(searchQuery as string);
        if (fromUsername) {
          try {
            const profile = await getProfileFetchIfNeeded({
              username: fromUsername,
              viewerFid: viewerFid as string,
            });
            if (profile?.fid) {
              finalAuthorFid = profile.fid.toString();
            }
          } catch (error) {
            console.error('Failed to fetch profile for from: filter', error);
          }
        }
      }
    }

    // Handle author_fid - prioritize the parameter over from: extraction
    const authorFidToUse = authorFid || finalAuthorFid || fromFid;

    // Construct Neynar API URL with all parameters
    const params = new URLSearchParams();
    // Add q parameter - Neynar search requires it even for filtered searches
    // Use '*' as wildcard when we only have filters
    if (processedQuery && processedQuery.trim()) {
      params.append('q', processedQuery);
    } else if (authorFidToUse || channelId || filters.channelId) {
      // For filter-only searches, use wildcard
      params.append('q', '*');
    }
    params.append('priority_mode', priorityMode as string);
    params.append('limit', limit as string);
    params.append('offset', offset as string);

    // Add new Neynar parameters
    if (mode) params.append('mode', mode as string);
    if (sortType) params.append('sort_type', sortType as string);

    if (authorFidToUse) params.append('author_fid', authorFidToUse as string);

    if (viewerFid) params.append('viewer_fid', viewerFid as string);
    if (parentUrl || filters.parentUrl) params.append('parent_url', (parentUrl || filters.parentUrl) as string);
    if (channelId || filters.channelId) params.append('channel_id', (channelId || filters.channelId) as string);

    const apiUrl = `${NEYNAR_API_URL}?${params.toString()}`;

    console.log('API Search endpoint - incoming params:', {
      q,
      term,
      searchQuery,
      authorFid,
      fromFid,
      viewerFid,
    });
    console.log('API Search endpoint - processed params:', {
      processedQuery,
      finalAuthorFid,
      authorFidToUse,
      filters,
    });
    console.log('Sending request to Neynar API...');
    console.log('Request URL:', apiUrl);

    // Send GET request to Neynar API
    const response = await axios.get(apiUrl, {
      headers: {
        accept: 'application/json',
        api_key: API_KEY,
      },
      timeout: timeoutThreshold,
    });

    // console.log('Response from Neynar API:', response.data);

    // Parse and return the results
    const results = response.data?.result?.casts || [];
    clearTimeout(timeout); // Clear the timeout if the request completes successfully

    res.status(200).json({ results, isTimeout: false });
  } catch (error) {
    clearTimeout(timeout); // Clear the timeout in case of error
    if (axios.isAxiosError(error)) {
      console.error('Error during Neynar API request:', error.response?.data || error.message);
    } else {
      console.error('Error during Neynar API request:', error);
    }

    res.status(500).json({
      error: 'Failed to fetch search results',
      results: [],
      isTimeout: false,
    });
  }
}
