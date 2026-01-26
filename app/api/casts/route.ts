import axios from 'axios';
import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/casts';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

async function fetchCastsUncached(casts: string, viewerFid: number | null) {
  if (!API_KEY) {
    throw new Error('API key not configured');
  }

  // Create params for Neynar API
  const params = new URLSearchParams();
  params.append('casts', casts);
  if (viewerFid !== null) {
    params.append('viewer_fid', viewerFid.toString());
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
    return response.data;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      const timeoutError = new Error(TIMEOUT_ERROR_MESSAGE);
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }

    if (error.response) {
      const apiError = new Error(error.response.data?.message || 'External API error');
      (apiError as any).status = error.response.status;
      throw apiError;
    }

    throw error;
  }
}

// Create cached version with unstable_cache (works in Next.js 15 stable)
const getCachedCasts = (casts: string, viewerFid: number | null) =>
  unstable_cache(() => fetchCastsUncached(casts, viewerFid), [`casts-${casts}-${viewerFid ?? 'anon'}`], {
    revalidate: 600, // 10 minutes
    tags: ['casts'],
  })();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const casts = searchParams.get('casts');
    const viewerFid = searchParams.get('viewer_fid');

    if (!casts) {
      return NextResponse.json({ error: 'Missing casts parameter' }, { status: 400 });
    }

    // Parse viewer_fid to number or null
    const viewerFidNum = viewerFid ? parseInt(viewerFid, 10) : null;
    if (viewerFid && (isNaN(viewerFidNum!) || viewerFidNum! <= 0)) {
      return NextResponse.json({ error: 'Invalid viewer_fid format' }, { status: 400 });
    }

    const data = await getCachedCasts(casts, viewerFidNum);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching casts:', error);

    // Handle timeout errors
    if (error.name === 'TimeoutError' || error.message === TIMEOUT_ERROR_MESSAGE) {
      return NextResponse.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
    }

    // Handle API configuration errors
    if (error.message === 'API key not configured') {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Handle API errors with status
    if (error.status) {
      return NextResponse.json({ error: error.message || 'External API error' }, { status: error.status });
    }

    return NextResponse.json({ error: 'Failed to fetch casts' }, { status: 500 });
  }
}

export const maxDuration = 20;
