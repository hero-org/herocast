import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { SearchQueryBuilder } from '@/services/searchQueryBuilder';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/cast/search';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const term = searchParams.get('term');
    const q = searchParams.get('q'); // Direct Neynar query parameter
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const priorityMode = searchParams.get('priorityMode') === 'true';
    const mode = searchParams.get('mode') || 'literal';
    const sortType = searchParams.get('sortType') || 'desc_chron';
    const authorFid = searchParams.get('authorFid');
    const viewerFid = searchParams.get('viewerFid');
    const parentUrl = searchParams.get('parentUrl');
    const channelId = searchParams.get('channelId');
    const fromFid = searchParams.get('fromFid');
    const mentionFid = searchParams.get('mentionFid');
    const interval = searchParams.get('interval');

    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Use direct query if provided, otherwise build from term and filters
    let queryString = q;
    if (!queryString && term) {
      const queryBuilder = new SearchQueryBuilder();
      queryString = queryBuilder
        .setQuery(term)
        .setChannelId(channelId)
        .setAuthorFid(authorFid)
        .setFromFid(fromFid)
        .setMentionFid(mentionFid)
        .setParentUrl(parentUrl)
        .build();
    }

    if (!queryString) {
      return NextResponse.json({ error: 'Missing search query' }, { status: 400 });
    }

    // Create params for Neynar API
    const params = new URLSearchParams();
    params.append('q', queryString);
    params.append('limit', limit.toString());
    if (offset > 0) {
      params.append('offset', offset.toString());
    }
    if (priorityMode) {
      params.append('priority_mode', 'true');
    }
    if (viewerFid) {
      params.append('viewer_fid', viewerFid);
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

      // Return search results - cast data from Neynar already includes author information
      return NextResponse.json(response.data);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return NextResponse.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
      }

      console.error('Error searching casts:', error);

      if (error.response) {
        return NextResponse.json(
          { error: error.response.data?.message || 'External API error' },
          { status: error.response.status }
        );
      }

      return NextResponse.json({ error: 'Failed to search casts' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in search route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const config = {
  maxDuration: 20, // Max duration for the API route
};
