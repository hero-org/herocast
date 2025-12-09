import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

async function searchChannelsUncached(query: string) {
  if (!API_KEY) {
    throw new Error('API key not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

  try {
    const neynarClient = new NeynarAPIClient(API_KEY);

    const response = await Promise.race([
      neynarClient.searchChannels(query),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)),
    ]);

    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Create cached version with unstable_cache (works in Next.js 15 stable)
const getCachedSearchChannels = (query: string) =>
  unstable_cache(() => searchChannelsUncached(query), [`channels-search-${query}`], {
    revalidate: 900, // 15 minutes
    tags: ['channels-search'],
  })();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Missing q parameter' }, { status: 400 });
    }

    // Normalize query to lowercase for better cache hits
    const normalizedQuery = query.toLowerCase();

    const response = await getCachedSearchChannels(normalizedQuery);
    return NextResponse.json(response);
  } catch (error: any) {
    if (error.message === 'AbortError' || error.name === 'AbortError') {
      return NextResponse.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
    }

    if (error.message === 'API key not configured') {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    console.error('Error searching channels:', error);

    // Handle Neynar SDK errors
    if (error.response) {
      return NextResponse.json(
        { error: error.response.data?.message || 'External API error' },
        { status: error.response.status }
      );
    }

    return NextResponse.json({ error: 'Failed to search channels' }, { status: 500 });
  }
}

export const maxDuration = 20;
