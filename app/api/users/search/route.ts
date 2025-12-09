import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

async function searchUsersUncached(query: string, viewerFid: number, limit: number) {
  if (!API_KEY) {
    throw new Error('API key not configured');
  }

  // Set up timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

  try {
    const neynarClient = new NeynarAPIClient(API_KEY);

    const response = await Promise.race([
      neynarClient.searchUser(query, viewerFid, { limit }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)),
    ]);

    clearTimeout(timeoutId);

    // Extract users array from response
    const users = (response as any)?.result?.users || [];

    return { users };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.message === 'AbortError' || error.name === 'AbortError') {
      throw new Error(TIMEOUT_ERROR_MESSAGE);
    }

    // Handle Neynar SDK errors
    if (error.response) {
      const apiError = new Error(error.response.data?.message || 'External API error');
      (apiError as any).status = error.response.status;
      throw apiError;
    }

    throw error;
  }
}

// Create cached version with unstable_cache (works in Next.js 15 stable)
const getCachedSearchUsers = (query: string, viewerFid: number, limit: number) =>
  unstable_cache(() => searchUsersUncached(query, viewerFid, limit), [`users-search-${query}-${viewerFid}-${limit}`], {
    revalidate: 300, // 5 minutes
    tags: ['users-search'],
  })();

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

    const result = await getCachedSearchUsers(query, viewerFidNum, limitNum);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error searching users:', error);

    // Handle timeout errors
    if (error.message === TIMEOUT_ERROR_MESSAGE) {
      return NextResponse.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
    }

    // Handle API errors with status code
    if (error.status) {
      return NextResponse.json({ error: error.message || 'External API error' }, { status: error.status });
    }

    // Handle API key configuration error
    if (error.message === 'API key not configured') {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
  }
}

export const maxDuration = 20;
