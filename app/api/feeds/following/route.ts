import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

// In-memory cache for following feed (2 minute TTL)
const feedCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const getCacheKey = (fid: number, limit: number, cursor?: string) =>
  `following:${fid}:${limit}:${cursor || 'initial'}`;

const getCachedData = (key: string) => {
  const cached = feedCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (cached) {
    feedCache.delete(key); // Remove expired cache
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  feedCache.set(key, { data, timestamp: Date.now() });
  // Clean up old cache entries periodically (keep cache size reasonable)
  if (feedCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of feedCache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        feedCache.delete(k);
      }
    }
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const limitParam = searchParams.get('limit');
    const cursor = searchParams.get('cursor');

    if (!fidParam) {
      return NextResponse.json({ error: 'Missing fid parameter' }, { status: 400 });
    }

    const fid = parseInt(fidParam, 10);
    const limit = limitParam ? parseInt(limitParam, 10) : 15;

    if (isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: 'Invalid limit parameter (1-100)' }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Check cache first
    const cacheKey = getCacheKey(fid, limit, cursor || undefined);
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Initialize Neynar client
    const neynarClient = new NeynarAPIClient(API_KEY);

    // Set up timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

    try {
      const options: any = { limit };
      if (cursor) {
        options.cursor = cursor;
      }

      const response = await neynarClient.fetchUserFollowingFeed(fid, options);

      clearTimeout(timeoutId);

      // Normalize response
      const normalizedResponse = {
        casts: response.casts || [],
        next: response.next || {},
      };

      // Cache the response
      setCachedData(cacheKey, normalizedResponse);

      return NextResponse.json(normalizedResponse);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return NextResponse.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
      }

      console.error('Error fetching following feed:', error);

      if (error.response) {
        return NextResponse.json(
          { error: error.response.data?.message || 'External API error' },
          { status: error.response.status }
        );
      }

      return NextResponse.json({ error: 'Failed to fetch following feed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in following feed route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const config = {
  maxDuration: 20, // Max duration for the API route
};
