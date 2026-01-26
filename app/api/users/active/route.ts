import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { type NextRequest, NextResponse } from 'next/server';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

// In-memory cache for active users (5 minute TTL)
const activeUsersCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (limit: number) => `active:${limit}`;

const getCachedData = (key: string) => {
  const cached = activeUsersCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (cached) {
    activeUsersCache.delete(key); // Remove expired cache
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  activeUsersCache.set(key, { data, timestamp: Date.now() });
  // Clean up old cache entries periodically (keep cache size reasonable)
  if (activeUsersCache.size > 100) {
    const now = Date.now();
    const entries = Array.from(activeUsersCache.entries());
    for (const [k, v] of entries) {
      if (now - v.timestamp > CACHE_TTL) {
        activeUsersCache.delete(k);
      }
    }
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit') || '14';

    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Validate limit
    const limit = parseInt(limitParam, 10);
    if (isNaN(limit) || limit <= 0 || limit > 100) {
      return NextResponse.json({ error: 'Invalid limit (must be 1-100)' }, { status: 400 });
    }

    // Check cache first
    const cacheKey = getCacheKey(limit);
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
        neynarClient.fetchActiveUsers({ limit }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)),
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

      console.error('Error fetching active users:', error);

      // Handle Neynar SDK errors
      if (error.response) {
        return NextResponse.json(
          { error: error.response.data?.message || 'External API error' },
          { status: error.response.status }
        );
      }

      return NextResponse.json({ error: 'Failed to fetch active users' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in active users route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const maxDuration = 20;
