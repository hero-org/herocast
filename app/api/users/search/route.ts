import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

// In-memory cache for user search (2 minute TTL)
const searchCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const getCacheKey = (query: string, viewerFid: string, limit: string) =>
  `${query}:${viewerFid}:${limit}`;

const getCachedData = (key: string) => {
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (cached) {
    searchCache.delete(key); // Remove expired cache
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  searchCache.set(key, { data, timestamp: Date.now() });
  // Clean up old cache entries periodically (keep cache size reasonable)
  if (searchCache.size > 1000) {
    const now = Date.now();
    const entries = Array.from(searchCache.entries());
    for (const [k, v] of entries) {
      if (now - v.timestamp > CACHE_TTL) {
        searchCache.delete(k);
      }
    }
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const viewerFid = searchParams.get('viewer_fid');
    const limit = searchParams.get('limit') || '10';

    if (!query) {
      return NextResponse.json({ error: 'Missing q parameter' }, { status: 400 });
    }

    if (!viewerFid) {
      return NextResponse.json({ error: 'Missing viewer_fid parameter' }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Validate viewer_fid
    const viewerFidNum = parseInt(viewerFid, 10);
    if (isNaN(viewerFidNum) || viewerFidNum <= 0) {
      return NextResponse.json({ error: 'Invalid viewer_fid' }, { status: 400 });
    }

    // Validate limit
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 100) {
      return NextResponse.json({ error: 'Invalid limit (must be 1-100)' }, { status: 400 });
    }

    // Check cache first
    const cacheKey = getCacheKey(query, viewerFid, limit);
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Set up timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

    try {
      const neynarClient = new NeynarAPIClient(API_KEY);

      const response = await Promise.race([
        neynarClient.searchUser(query, viewerFidNum, { limit: limitNum }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)
        ),
      ]);

      clearTimeout(timeoutId);

      // Extract users array from response
      const users = (response as any)?.result?.users || [];

      // Cache the response
      const responseData = { users };
      setCachedData(cacheKey, responseData);

      return NextResponse.json(responseData);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.message === 'AbortError' || error.name === 'AbortError') {
        return NextResponse.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
      }

      console.error('Error searching users:', error);

      // Handle Neynar SDK errors
      if (error.response) {
        return NextResponse.json(
          { error: error.response.data?.message || 'External API error' },
          { status: error.response.status }
        );
      }

      return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in user search route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const config = {
  maxDuration: 20, // Max duration for the API route
};
