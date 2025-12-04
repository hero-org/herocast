import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/notifications';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const cursor = searchParams.get('cursor');
    const limit = searchParams.get('limit') || '25';

    if (!fid) {
      return NextResponse.json({ error: 'Missing fid parameter' }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Create params for Neynar API
    const params = new URLSearchParams();
    params.append('fid', fid);
    params.append('limit', limit);
    if (cursor) {
      params.append('cursor', cursor);
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
      return NextResponse.json(response.data);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return NextResponse.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
      }

      console.error('Error fetching notifications:', error);

      if (error.response) {
        return NextResponse.json(
          { error: error.response.data?.message || 'External API error' },
          { status: error.response.status }
        );
      }

      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in notifications route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const maxDuration = 20;
