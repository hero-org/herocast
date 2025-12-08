import { unstable_cacheLife as cacheLife } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

async function searchChannels(query: string) {
  'use cache';
  cacheLife({
    stale: 60 * 5, // 5 minutes - serve stale content
    revalidate: 60 * 15, // 15 minutes - revalidate
    expire: 60 * 60, // 1 hour - purge from cache
  });

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Missing q parameter' }, { status: 400 });
    }

    // Normalize query to lowercase for better cache hits
    const normalizedQuery = query.toLowerCase();

    const response = await searchChannels(normalizedQuery);
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
