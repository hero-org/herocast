import { unstable_cacheLife as cacheLife } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

class FetchError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

async function fetchAllChannels(): Promise<any> {
  'use cache';
  cacheLife({
    stale: 60 * 60, // 1 hour - serve stale content
    revalidate: 60 * 60 * 2, // 2 hours - background revalidation
    expire: 60 * 60 * 24, // 1 day - purge from cache
  });

  if (!API_KEY) {
    throw new FetchError('API key not configured', 500);
  }

  const neynarClient = new NeynarAPIClient(API_KEY);

  const response = await Promise.race([
    neynarClient.fetchAllChannels(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)),
  ]);

  return response;
}

export async function GET(request: NextRequest) {
  try {
    const response = await fetchAllChannels();
    return NextResponse.json(response);
  } catch (error: any) {
    if (error instanceof FetchError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

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
}

export const maxDuration = 20;
