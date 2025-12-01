import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient, FeedType, FilterType } from '@neynar/nodejs-sdk';
import { NEYNAR_API_MAX_FIDS_PER_REQUEST } from '@/common/constants/listLimits';

const apiKey = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

/**
 * GET /api/lists - Fetch feed for a FID list
 *
 * Query params:
 * - fids: Comma-separated list of FIDs (required)
 * - viewerFid: Viewer's FID for personalization (required)
 * - limit: Number of casts to return (default 25)
 * - cursor: Pagination cursor
 *
 * Note: We pass FIDs directly from the client since they're already loaded
 * in useListStore. This avoids Supabase auth complexity in App Router.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidsParam = searchParams.get('fids');
    const viewerFid = searchParams.get('viewerFid');
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const cursor = searchParams.get('cursor') || undefined;

    if (!fidsParam) {
      return NextResponse.json({ error: 'Missing fids parameter' }, { status: 400 });
    }

    if (!viewerFid) {
      return NextResponse.json({ error: 'Missing viewerFid parameter' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Parse FIDs from comma-separated string
    const fids = fidsParam
      .split(',')
      .map((fid) => parseInt(fid.trim(), 10))
      .filter((fid) => !isNaN(fid));

    if (fids.length === 0) {
      return NextResponse.json({ error: 'No valid FIDs provided' }, { status: 400 });
    }

    // Use Neynar API to fetch feed for these FIDs
    const neynarClient = new NeynarAPIClient(apiKey);

    // Limit FIDs to Neynar's max per request
    const limitedFids = fids.slice(0, NEYNAR_API_MAX_FIDS_PER_REQUEST);

    // Fetch feed filtered by these FIDs
    const response = await neynarClient.fetchFeed(FeedType.Filter, {
      filterType: FilterType.Fids,
      fids: limitedFids,
      limit,
      cursor,
      fid: parseInt(viewerFid, 10),
    });

    return NextResponse.json({
      casts: response.casts || [],
      next: response.next || { cursor: null },
    });
  } catch (error) {
    console.error('Error in lists route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
