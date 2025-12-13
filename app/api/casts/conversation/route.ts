import { NextRequest, NextResponse } from 'next/server';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

// In-memory cache for conversation lookups (5 minute TTL)
const conversationCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (identifier: string, replyDepth: number, includeParents: boolean, viewerFid?: string) =>
  `${identifier}:${replyDepth}:${includeParents}:${viewerFid || 'no-viewer'}`;

const getCachedData = (key: string) => {
  const cached = conversationCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (cached) {
    conversationCache.delete(key); // Remove expired cache
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  conversationCache.set(key, { data, timestamp: Date.now() });
  // Clean up old cache entries periodically (keep cache size reasonable)
  if (conversationCache.size > 1000) {
    const now = Date.now();
    const entries = Array.from(conversationCache.entries());
    for (const [k, v] of entries) {
      if (now - v.timestamp > CACHE_TTL) {
        conversationCache.delete(k);
      }
    }
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const identifier = searchParams.get('identifier');
    const replyDepthParam = searchParams.get('reply_depth') || '1';
    const includeParentsParam = searchParams.get('include_chronological_parent_casts') || 'true';
    const viewerFid = searchParams.get('viewer_fid');
    const fold = searchParams.get('fold') || 'above'; // Quality filtering: hide low-quality replies below the fold
    const sortType = searchParams.get('sort_type') || 'algorithmic'; // Rank replies by quality

    if (!identifier) {
      return NextResponse.json({ error: 'Missing identifier parameter' }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Parse parameters
    const replyDepth = parseInt(replyDepthParam, 10);
    if (isNaN(replyDepth) || replyDepth < 0 || replyDepth > 5) {
      return NextResponse.json({ error: 'Invalid reply_depth (must be 0-5)' }, { status: 400 });
    }

    const includeParents = includeParentsParam === 'true';

    // Check cache first (include fold and sortType in cache key)
    const cacheKey = `${getCacheKey(identifier, replyDepth, includeParents, viewerFid || undefined)}:${fold}:${sortType}`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Set up timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

    try {
      // Build query parameters manually since SDK doesn't support fold and sortType yet
      const queryParams = new URLSearchParams({
        identifier,
        type: 'hash',
        reply_depth: replyDepth.toString(),
        include_chronological_parent_casts: includeParents.toString(),
      });

      if (viewerFid) {
        const viewerFidNum = parseInt(viewerFid, 10);
        if (!isNaN(viewerFidNum) && viewerFidNum > 0) {
          queryParams.append('viewer_fid', viewerFidNum.toString());
        }
      }

      // Add quality filtering parameters
      if (fold) {
        queryParams.append('fold', fold);
      }
      if (sortType) {
        queryParams.append('sort_type', sortType);
      }

      // Make direct API call to support new quality filtering parameters
      const apiUrl = `https://api.neynar.com/v2/farcaster/cast/conversation?${queryParams.toString()}`;

      const fetchPromise = fetch(apiUrl, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          api_key: API_KEY,
          'x-neynar-experimental': 'true', // Enable score-based filtering
        },
        signal: controller.signal,
      }).then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `API error: ${res.status}`);
        }
        return res.json();
      });

      const response = await Promise.race([
        fetchPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)),
      ]);

      clearTimeout(timeoutId);

      // Cache the response
      setCachedData(cacheKey, response);

      return NextResponse.json(response);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.message === 'AbortError' || error.name === 'AbortError' || error.name === 'AbortError') {
        return NextResponse.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
      }

      console.error('Error looking up cast conversation:', error);

      // Handle API errors
      if (error.response) {
        return NextResponse.json(
          { error: error.response.data?.message || 'External API error' },
          { status: error.response.status }
        );
      }

      return NextResponse.json({ error: 'Failed to lookup cast conversation' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in casts conversation route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const maxDuration = 20;
