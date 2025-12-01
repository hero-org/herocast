import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

// In-memory cache for user lookups (5 minute TTL)
const userCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (fids: string, viewerFid?: string) => `${fids}:${viewerFid || 'no-viewer'}`;

const getCachedData = (key: string) => {
  const cached = userCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (cached) {
    userCache.delete(key); // Remove expired cache
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  userCache.set(key, { data, timestamp: Date.now() });
  // Clean up old cache entries periodically (keep cache size reasonable)
  if (userCache.size > 1000) {
    const now = Date.now();
    const entries = Array.from(userCache.entries());
    for (const [k, v] of entries) {
      if (now - v.timestamp > CACHE_TTL) {
        userCache.delete(k);
      }
    }
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidsParam = searchParams.get('fids');
    const viewerFid = searchParams.get('viewer_fid');

    if (!fidsParam) {
      return NextResponse.json({ error: 'Missing fids parameter' }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Parse and validate FIDs
    const fids = fidsParam.split(',').map((fid) => parseInt(fid.trim(), 10));

    if (fids.length === 0) {
      return NextResponse.json({ users: [] });
    }

    if (fids.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 FIDs allowed' }, { status: 400 });
    }

    if (fids.some((fid) => isNaN(fid) || fid <= 0)) {
      return NextResponse.json({ error: 'Invalid FID format' }, { status: 400 });
    }

    // Check cache first
    const cacheKey = getCacheKey(fidsParam, viewerFid || undefined);
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Set up timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

    try {
      const neynarClient = new NeynarAPIClient(API_KEY);

      const options: { viewerFid?: number } = {};
      if (viewerFid) {
        const viewerFidNum = parseInt(viewerFid, 10);
        if (!isNaN(viewerFidNum) && viewerFidNum > 0) {
          options.viewerFid = viewerFidNum;
        }
      }

      const response = await Promise.race([
        neynarClient.fetchBulkUsers(fids, options),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)
        ),
      ]);

      clearTimeout(timeoutId);

      // Extract users array from response
      const users = (response as any)?.users || [];

      // Cache the response
      const responseData = { users };
      setCachedData(cacheKey, responseData);

      return NextResponse.json(responseData);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.message === 'AbortError' || error.name === 'AbortError') {
        return NextResponse.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
      }

      console.error('Error fetching users:', error);

      // Handle Neynar SDK errors
      if (error.response) {
        return NextResponse.json(
          { error: error.response.data?.message || 'External API error' },
          { status: error.response.status }
        );
      }

      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in users route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const config = {
  maxDuration: 20, // Max duration for the API route
};
