import { cacheLife } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

async function fetchUsers(fids: string, viewerFid: number | null) {
  'use cache';
  cacheLife({
    stale: 60 * 5, // 5 minutes - serve stale content
    revalidate: 60 * 10, // 10 minutes - revalidate
    expire: 60 * 60, // 1 hour - purge from cache
  });

  if (!API_KEY) {
    throw new Error('API key not configured');
  }

  // Parse and validate FIDs
  const fidsArray = fids.split(',').map((fid) => parseInt(fid.trim(), 10));

  if (fidsArray.length === 0) {
    return { users: [] };
  }

  if (fidsArray.length > 100) {
    throw new Error('Maximum 100 FIDs allowed');
  }

  if (fidsArray.some((fid) => isNaN(fid) || fid <= 0)) {
    throw new Error('Invalid FID format');
  }

  // Set up timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutThreshold);

  try {
    const neynarClient = new NeynarAPIClient(API_KEY);

    const options: { viewerFid?: number } = {};
    if (viewerFid && viewerFid > 0) {
      options.viewerFid = viewerFid;
    }

    const response = await Promise.race([
      neynarClient.fetchBulkUsers(fidsArray, options),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), timeoutThreshold)),
    ]);

    clearTimeout(timeoutId);

    // Extract users array from response
    const users = (response as any)?.users || [];

    return { users };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.message === 'AbortError' || error.name === 'AbortError') {
      throw new Error(TIMEOUT_ERROR_MESSAGE);
    }

    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidsParam = searchParams.get('fids');
    const viewerFidParam = searchParams.get('viewer_fid');

    if (!fidsParam) {
      return NextResponse.json({ error: 'Missing fids parameter' }, { status: 400 });
    }

    // Parse and validate viewerFid
    let viewerFid: number | null = null;
    if (viewerFidParam) {
      const viewerFidNum = parseInt(viewerFidParam, 10);
      if (!isNaN(viewerFidNum) && viewerFidNum > 0) {
        viewerFid = viewerFidNum;
      }
    }

    const result = await fetchUsers(fidsParam, viewerFid);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in users route:', error);

    // Handle timeout errors
    if (error.message === TIMEOUT_ERROR_MESSAGE) {
      return NextResponse.json({ error: TIMEOUT_ERROR_MESSAGE }, { status: 408 });
    }

    // Handle validation errors
    if (error.message === 'Maximum 100 FIDs allowed' || error.message === 'Invalid FID format') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Handle API key errors
    if (error.message === 'API key not configured') {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Handle Neynar SDK errors
    if (error.response) {
      return NextResponse.json(
        { error: error.response.data?.message || 'External API error' },
        { status: error.response.status }
      );
    }

    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export const maxDuration = 20;
