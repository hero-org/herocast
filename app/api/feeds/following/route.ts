import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildFollowingFeedResponse,
  followingFeedRequestSchema,
  followingFeedResponseSchemaStrict,
} from '@/lib/api-contracts/feeds-following';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

// Simple server-side timing helper
const logTiming = (label: string, startTime: number, metadata?: Record<string, unknown>) => {
  const duration = Date.now() - startTime;
  const status = duration < 1000 ? 'good' : duration < 2000 ? 'warning' : 'critical';
  const icon = status === 'good' ? '⚡' : status === 'warning' ? '⚠️' : '🐌';
  console.log(`${icon} [API] ${label}: ${duration}ms`, metadata || '');
  return duration;
};

// In-memory cache for following feed (2 minute TTL)
const feedCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const getCacheKey = (fid: number, limit: number, cursor?: string) => `following:${fid}:${limit}:${cursor || 'initial'}`;

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
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = followingFeedRequestSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid params', details: parsed.error.format() }, { status: 400 });
    }
    const { fid, limit, cursor } = parsed.data;

    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Check cache first
    const cacheKey = getCacheKey(fid, limit, cursor);
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

      const neynarStart = Date.now();
      const response = await neynarClient.fetchUserFollowingFeed(fid, options);
      logTiming('neynar:fetchUserFollowingFeed', neynarStart, { fid, limit, hasCursor: !!cursor });

      clearTimeout(timeoutId);

      // Normalize response via the pure builder — same function the
      // contract test imports to assert shape parity against the schema.
      const responsePayload = buildFollowingFeedResponse(response);

      // Dev-only response validation: surfaces drift before it ships to clients.
      // Uses the strict variant so unknown top-level keys are flagged instead
      // of silently stripped. In production this is skipped to avoid the parse
      // cost on the hot path; the client-side apiFetch validates again at the
      // consumer boundary.
      if (process.env.NODE_ENV !== 'production') {
        followingFeedResponseSchemaStrict.parse(responsePayload);
      }

      // Cache the response
      setCachedData(cacheKey, responsePayload);

      return NextResponse.json(responsePayload);
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

export const maxDuration = 20;
