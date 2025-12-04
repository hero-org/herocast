import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient, CastParamType } from '@neynar/nodejs-sdk';

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

    // Check cache first
    const cacheKey = getCacheKey(identifier, replyDepth, includeParents, viewerFid || undefined);
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Set up timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

    try {
      const neynarClient = new NeynarAPIClient(API_KEY);

      const options: { replyDepth?: number; includeChronologicalParentCasts?: boolean; viewerFid?: number } = {
        replyDepth,
        includeChronologicalParentCasts: includeParents,
      };

      if (viewerFid) {
        const viewerFidNum = parseInt(viewerFid, 10);
        if (!isNaN(viewerFidNum) && viewerFidNum > 0) {
          options.viewerFid = viewerFidNum;
        }
      }

      const response = await Promise.race([
        neynarClient.lookupCastConversation(identifier, CastParamType.Hash, options),
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

      console.error('Error looking up cast conversation:', error);

      // Handle Neynar SDK errors
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
