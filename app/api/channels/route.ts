import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

// In-memory cache for all channels (1 hour TTL - channels rarely change)
let channelsCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const getCachedData = () => {
  if (channelsCache && Date.now() - channelsCache.timestamp < CACHE_TTL) {
    return channelsCache.data;
  }
  if (channelsCache) {
    channelsCache = null; // Clear expired cache
  }
  return null;
};

const setCachedData = (data: any) => {
  channelsCache = { data, timestamp: Date.now() };
};

export async function GET(request: NextRequest) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Check cache first
    const cachedData = getCachedData();
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Set up timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

    try {
      const neynarClient = new NeynarAPIClient(API_KEY);

      const response = await Promise.race([
        neynarClient.fetchAllChannels(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)),
      ]);

      clearTimeout(timeoutId);

      // Cache the response
      setCachedData(response);

      return NextResponse.json(response);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.message === 'AbortError' || error.name === 'AbortError') {
        return NextResponse.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
      }

      console.error('Error fetching all channels:', error);

      // Handle Neynar SDK errors
      if (error.response) {
        return NextResponse.json(
          { error: error.response.data?.message || 'External API error' },
          { status: error.response.status }
        );
      }

      return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in channels route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const config = {
  maxDuration: 20, // Max duration for the API route
};
