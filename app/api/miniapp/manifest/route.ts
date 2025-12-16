import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export type MiniAppManifest = {
  name: string;
  iconUrl: string;
  splashImageUrl?: string;
  splashBackgroundColor?: string;
  homeUrl: string;
  webhookUrl?: string;
};

// Only allow http/https URLs
function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchMiniAppManifestUncached(url: string): Promise<MiniAppManifest | null> {
  const startTime = Date.now();
  console.log('[miniapp/manifest] Fetching manifest for:', url);

  try {
    // Construct the well-known manifest URL
    const manifestUrl = new URL('/.well-known/farcaster.json', url).href;
    console.log('[miniapp/manifest] Fetching from:', manifestUrl);

    const response = await fetch(manifestUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HerocastBot/1.0; +https://herocast.xyz)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.log(
        `[miniapp/manifest] Fetch failed with status ${response.status} for ${manifestUrl} in ${Date.now() - startTime}ms`
      );
      return null;
    }

    const data = await response.json();
    console.log(`[miniapp/manifest] Successfully fetched manifest in ${Date.now() - startTime}ms`);

    // Validate required fields
    if (!data.name || !data.iconUrl || !data.homeUrl) {
      console.log('[miniapp/manifest] Invalid manifest: missing required fields (name, iconUrl, or homeUrl)');
      return null;
    }

    // Return the manifest with proper typing
    return {
      name: data.name,
      iconUrl: data.iconUrl,
      splashImageUrl: data.splashImageUrl,
      splashBackgroundColor: data.splashBackgroundColor,
      homeUrl: data.homeUrl,
      webhookUrl: data.webhookUrl,
    };
  } catch (error) {
    console.error(`[miniapp/manifest] Error fetching manifest for ${url} after ${Date.now() - startTime}ms:`, error);
    return null;
  }
}

// Create cached version with unstable_cache - cache for 7 days
const getCachedMiniAppManifest = (url: string) =>
  unstable_cache(() => fetchMiniAppManifestUncached(url), [`miniapp-manifest-${url}`], {
    revalidate: 604800, // 7 days in seconds
    tags: ['miniapp-manifest'],
  })();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Validate URL format and ensure it's an HTTP(S) URL
    if (!isValidHttpUrl(url)) {
      console.log(`[miniapp/manifest] Invalid URL format: ${url}`);
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const manifest = await getCachedMiniAppManifest(url);

    // Return the manifest (null if fetch failed)
    return NextResponse.json({ manifest });
  } catch (error) {
    console.error('Error in miniapp manifest route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const maxDuration = 10;
