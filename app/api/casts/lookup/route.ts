import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient, CastParamType } from '@neynar/nodejs-sdk';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

// In-memory cache for cast lookups (5 minute TTL)
const lookupCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (identifier: string, type: string, viewerFid?: string) =>
  `${identifier}:${type}:${viewerFid || 'no-viewer'}`;

const getCachedData = (key: string) => {
  const cached = lookupCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (cached) {
    lookupCache.delete(key); // Remove expired cache
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  lookupCache.set(key, { data, timestamp: Date.now() });
  // Clean up old cache entries periodically (keep cache size reasonable)
  if (lookupCache.size > 1000) {
    const now = Date.now();
    const entries = Array.from(lookupCache.entries());
    for (const [k, v] of entries) {
      if (now - v.timestamp > CACHE_TTL) {
        lookupCache.delete(k);
      }
    }
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const identifier = searchParams.get('identifier');
    const type = searchParams.get('type');
    const viewerFid = searchParams.get('viewer_fid');

    if (!identifier) {
      return NextResponse.json({ error: 'Missing identifier parameter' }, { status: 400 });
    }

    if (!type || (type !== 'hash' && type !== 'url')) {
      return NextResponse.json({ error: 'Invalid type parameter. Must be "hash" or "url"' }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Check cache first
    const cacheKey = getCacheKey(identifier, type, viewerFid || undefined);
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Set up timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

    try {
      const neynarClient = new NeynarAPIClient(API_KEY);

      const castParamType = type === 'hash' ? CastParamType.Hash : CastParamType.Url;

      const options: { viewerFid?: number } = {};
      if (viewerFid) {
        const viewerFidNum = parseInt(viewerFid, 10);
        if (!isNaN(viewerFidNum) && viewerFidNum > 0) {
          options.viewerFid = viewerFidNum;
        }
      }

      const response = await Promise.race([
        neynarClient.lookUpCastByHashOrWarpcastUrl(identifier, castParamType, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)),
      ]);

      clearTimeout(timeoutId);

      // Cache the response
      setCachedData(cacheKey, response);

      return NextResponse.json(response);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.message === 'AbortError' || error.name === 'AbortError') {
        return NextResponse.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
      }

      console.error('Error looking up cast:', error);

      // Handle Neynar SDK errors
      if (error.response) {
        return NextResponse.json(
          { error: error.response.data?.message || 'External API error' },
          { status: error.response.status }
        );
      }

      return NextResponse.json({ error: 'Failed to lookup cast' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in casts lookup route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const config = {
  maxDuration: 20, // Max duration for the API route
};
