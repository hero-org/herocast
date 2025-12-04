import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

// In-memory cache for relevant followers (5 minute TTL)
const followersCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (targetFid: number, viewerFid: number) => `${targetFid}:${viewerFid}`;

const getCachedData = (key: string) => {
  const cached = followersCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (cached) {
    followersCache.delete(key); // Remove expired cache
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  followersCache.set(key, { data, timestamp: Date.now() });
  // Clean up old cache entries periodically (keep cache size reasonable)
  if (followersCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of followersCache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        followersCache.delete(k);
      }
    }
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetFidParam = searchParams.get('target_fid');
    const viewerFidParam = searchParams.get('viewer_fid');

    if (!targetFidParam) {
      return NextResponse.json({ error: 'Missing target_fid parameter' }, { status: 400 });
    }

    if (!viewerFidParam) {
      return NextResponse.json({ error: 'Missing viewer_fid parameter' }, { status: 400 });
    }

    const targetFid = parseInt(targetFidParam, 10);
    const viewerFid = parseInt(viewerFidParam, 10);

    if (isNaN(targetFid) || targetFid <= 0) {
      return NextResponse.json({ error: 'Invalid target_fid parameter' }, { status: 400 });
    }

    if (isNaN(viewerFid) || viewerFid <= 0) {
      return NextResponse.json({ error: 'Invalid viewer_fid parameter' }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Check cache first
    const cacheKey = getCacheKey(targetFid, viewerFid);
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
      const response = await Promise.race([
        neynarClient.fetchRelevantFollowers(targetFid, viewerFid),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)),
      ]);

      clearTimeout(timeoutId);

      // Extract follower FIDs from the response
      const relevantFollowers = (response as any)?.all_relevant_followers_dehydrated || [];
      const fids = relevantFollowers
        .map((follower: any) => follower.user?.fid)
        .filter((fid: number | undefined): fid is number => fid !== undefined);

      const responseData = { fids };

      // Cache the response
      setCachedData(cacheKey, responseData);

      return NextResponse.json(responseData);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.message === 'AbortError' || error.name === 'AbortError') {
        return NextResponse.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
      }

      console.error('Error fetching relevant followers:', error);

      if (error.response) {
        return NextResponse.json(
          { error: error.response.data?.message || 'External API error' },
          { status: error.response.status }
        );
      }

      return NextResponse.json({ error: 'Failed to fetch relevant followers' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in relevant followers route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const maxDuration = 20;
