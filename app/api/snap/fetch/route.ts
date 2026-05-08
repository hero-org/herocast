import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

const SNAP_MEDIA_TYPE = 'application/vnd.farcaster.snap+json';

/**
 * Validates that a URL is an HTTP(S) URL.
 * Rejects custom URI schemes (chain:, swap://, etc.)
 */
function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Fetch snap JSON from a URL via content negotiation.
 * Returns the snap response if the server supports snaps, null otherwise.
 */
async function fetchSnapUncached(url: string): Promise<unknown | null> {
  const startTime = Date.now();
  console.log('[snap/fetch] Fetching snap for:', url);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: SNAP_MEDIA_TYPE,
        'User-Agent': 'Mozilla/5.0 (compatible; HerocastBot/1.0; +https://herocast.xyz)',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.log(`[snap/fetch] HTTP ${response.status} for ${url} in ${Date.now() - startTime}ms`);
      return null;
    }

    // Check if the response is actually snap JSON
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes(SNAP_MEDIA_TYPE)) {
      console.log(`[snap/fetch] Not a snap (content-type: ${contentType}) for ${url} in ${Date.now() - startTime}ms`);
      return null;
    }

    const json = await response.json();

    // Basic validation: must have version field
    if (!json || typeof json !== 'object' || !('version' in json)) {
      console.log(`[snap/fetch] Invalid snap response (missing version) for ${url} in ${Date.now() - startTime}ms`);
      return null;
    }

    console.log(`[snap/fetch] Snap detected (v${json.version}) for ${url} in ${Date.now() - startTime}ms`);
    return json;
  } catch (error) {
    console.error(`[snap/fetch] Error for ${url} after ${Date.now() - startTime}ms:`, error);
    return null;
  }
}

// Cache snap responses for 5 minutes (snaps are dynamic, shorter TTL than OG metadata)
const getCachedSnap = (url: string) =>
  unstable_cache(() => fetchSnapUncached(url), [`snap-fetch-${url}`], {
    revalidate: 300, // 5 minutes
    tags: ['snap-fetch'],
  })();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    if (!isValidHttpUrl(url)) {
      return NextResponse.json({ snap: null });
    }

    const snap = await getCachedSnap(url);
    return NextResponse.json({ snap });
  } catch (error) {
    console.error('Error in snap fetch route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const maxDuration = 10;
