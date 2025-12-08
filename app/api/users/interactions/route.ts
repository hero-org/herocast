import { cacheLife } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.NEYNAR_API_KEY;

export type UserInteraction = {
  count: number;
  mostRecent: string | null;
};

export type UserInteractionsResponse = {
  likes: UserInteraction;
  recasts: UserInteraction;
  replies: UserInteraction;
  mentions: UserInteraction;
  quotes: UserInteraction;
};

type NeynarInteraction = {
  type: 'likes' | 'recasts' | 'replies' | 'mentions' | 'quotes' | 'follows';
  count: number;
  most_recent_timestamp: string | null;
};

type NeynarInteractionsResponse = {
  interactions: NeynarInteraction[];
};

async function fetchUserInteractions(viewerFid: number, targetFid: number): Promise<UserInteractionsResponse> {
  'use cache';
  cacheLife({
    stale: 60 * 5, // 5 minutes - serve stale content
    revalidate: 60 * 60, // 1 hour - revalidate
    expire: 60 * 60 * 24, // 1 day - purge from cache
  });

  if (!API_KEY) {
    throw new Error('NEYNAR_API_KEY not configured');
  }

  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/user/interactions/?fids=${viewerFid},${targetFid}`,
    {
      headers: {
        'x-api-key': API_KEY,
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    }
  );

  if (!response.ok) {
    throw new Error(`Neynar API error: ${response.status} ${response.statusText}`);
  }

  const data: NeynarInteractionsResponse = await response.json();

  // Transform to simplified format
  const interactions = data.interactions || [];
  return {
    likes: extractInteraction(interactions, 'likes'),
    recasts: extractInteraction(interactions, 'recasts'),
    replies: extractInteraction(interactions, 'replies'),
    mentions: extractInteraction(interactions, 'mentions'),
    quotes: extractInteraction(interactions, 'quotes'),
  };
}

function extractInteraction(interactions: NeynarInteraction[], type: NeynarInteraction['type']): UserInteraction {
  const interaction = interactions.find((i) => i.type === type);
  return interaction
    ? { count: interaction.count, mostRecent: interaction.most_recent_timestamp }
    : { count: 0, mostRecent: null };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const viewerFid = searchParams.get('viewer_fid');
    const targetFid = searchParams.get('target_fid');

    if (!viewerFid || !targetFid) {
      return NextResponse.json({ error: 'Missing viewer_fid or target_fid parameter' }, { status: 400 });
    }

    // Parse and validate FIDs
    const viewerFidNum = parseInt(viewerFid, 10);
    const targetFidNum = parseInt(targetFid, 10);

    if (isNaN(viewerFidNum) || viewerFidNum <= 0) {
      return NextResponse.json({ error: 'Invalid viewer_fid format' }, { status: 400 });
    }

    if (isNaN(targetFidNum) || targetFidNum <= 0) {
      return NextResponse.json({ error: 'Invalid target_fid format' }, { status: 400 });
    }

    // Don't fetch interactions for same user
    if (viewerFidNum === targetFidNum) {
      return NextResponse.json({ error: 'Cannot fetch interactions for same user' }, { status: 400 });
    }

    const interactions = await fetchUserInteractions(viewerFidNum, targetFidNum);

    return NextResponse.json(interactions);
  } catch (error) {
    console.error('Error fetching user interactions:', error);

    if (error instanceof Error) {
      // Handle timeout errors
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        return NextResponse.json({ error: 'Request timed out' }, { status: 408 });
      }

      // Handle Neynar API errors
      if (error.message.includes('Neynar API error')) {
        return NextResponse.json({ error: 'Failed to fetch interactions from Neynar' }, { status: 502 });
      }
    }

    return NextResponse.json({ error: 'Failed to fetch user interactions' }, { status: 500 });
  }
}

export const maxDuration = 20;
