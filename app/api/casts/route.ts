import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/casts';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;
// In-memory cache for cast lookups (5 minute TTL)
const castCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const getCacheKey = (casts: string, viewerFid?: string) => `${casts}:${viewerFid || 'no-viewer'}`;
const getCachedData = (key: string) => {
  const cached = castCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (cached) {
    castCache.delete(key); // Remove expired cache
  }
  return null;
};
const setCachedData = (key: string, data: any) => {
  castCache.set(key, { data, timestamp: Date.now() });
  // Clean up old cache entries periodically (keep cache size reasonable)
  if (castCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of castCache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        castCache.delete(k);
      }
    }
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const casts = searchParams.get('casts');
    const viewerFid = searchParams.get('viewer_fid');

    if (!casts) {
      return NextResponse.json({ error: 'Missing casts parameter' }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Check cache first
    const cacheKey = getCacheKey(casts, viewerFid || undefined);
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Create params for Neynar API
    const params = new URLSearchParams();
    params.append('casts', casts);
    if (viewerFid) {
      params.append('viewer_fid', viewerFid);
    }

    // Set up timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

    try {
      const response = await axios.get(`${NEYNAR_API_URL}?${params.toString()}`, {
        headers: {
          accept: 'application/json',
          api_key: API_KEY,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Cache the response
      setCachedData(cacheKey, response.data);

      return NextResponse.json(response.data);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return NextResponse.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
      }

      console.error('Error fetching casts:', error);

      if (error.response) {
        return NextResponse.json(
          { error: error.response.data?.message || 'External API error' },
          { status: error.response.status }
        );
      }

      return NextResponse.json({ error: 'Failed to fetch casts' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in casts route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const maxDuration = 20;
