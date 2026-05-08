import { type NextRequest, NextResponse } from 'next/server';

const SNAP_MEDIA_TYPE = 'application/vnd.farcaster.snap+json';

function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const isLocalDev =
      parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    return isHttps || isLocalDev;
  } catch {
    return false;
  }
}

/**
 * Proxies authenticated POST requests from the client to snap servers.
 * The client sends a pre-signed JFS compact string; this route forwards it.
 */
export async function POST(request: NextRequest) {
  try {
    const { target, body } = await request.json();

    if (!target || typeof target !== 'string') {
      return NextResponse.json({ error: 'Missing target URL' }, { status: 400 });
    }

    if (!isValidHttpsUrl(target)) {
      return NextResponse.json({ error: 'Invalid target URL. HTTPS required.' }, { status: 400 });
    }

    if (!body || typeof body !== 'string') {
      return NextResponse.json({ error: 'Missing JFS body' }, { status: 400 });
    }

    const startTime = Date.now();
    console.log('[snap/submit] POSTing to:', target);

    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: SNAP_MEDIA_TYPE,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });

    const json = await response.json();
    console.log(`[snap/submit] Response ${response.status} from ${target} in ${Date.now() - startTime}ms`);

    if (!response.ok) {
      return NextResponse.json(
        { error: json.error || `Server error (${response.status})` },
        { status: response.status }
      );
    }

    return NextResponse.json({ snap: json });
  } catch (error) {
    console.error('Error in snap submit route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const maxDuration = 10;
